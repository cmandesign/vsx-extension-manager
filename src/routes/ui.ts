import { Router } from "express";
import { queryExtensions } from "../services/marketplace-client.js";
import { rewriteUrls, getBaseUrl } from "../services/url-rewriter.js";
import { dbAvailable } from "../db/connection.js";
import { getPolicyMode, getBulkListStatus, addToList, removeFromListByExtensionId } from "../services/policy-service.js";
import type { ListType } from "../services/policy-service.js";
import { getRules, filterExtensions, isExtensionAllowed } from "../services/rule-engine.js";
import type { Extension, ExtensionQueryResponse } from "../types/marketplace.js";

const router = Router();

// Browse extensions page (unified: regular users see filtered, admins see policy controls)
router.get("/", async (req, res) => {
  const search = (req.query.search as string) || "";
  const page = parseInt(req.query.page as string) || 1;
  const showBlocked = req.query.show_blocked === "1";
  const pageSize = 12;

  let extensions: Extension[] = [];
  let totalCount = 0;
  const blockedExtIds = new Set<string>();
  let policyMode = "blacklist";
  let policyStatus = new Map<string, ListType>();
  const isAdmin = res.locals.user?.role === "admin";

  try {
    if (search || page >= 1) {
      const queryBody = {
        filters: [
          {
            criteria: [
              { filterType: 8, value: "Microsoft.VisualStudio.Code" },
              ...(search ? [{ filterType: 10, value: search }] : []),
            ],
            pageNumber: page,
            pageSize,
            sortBy: search ? 6 : 4, // 6 = relevance, 4 = install count
            sortOrder: 0,
          },
        ],
        assetTypes: [],
        flags: 0x200 | 0x2 | 0x1 | 0x80, // IncludeFiles | IncludeStatistics | IncludeVersions | IncludeAssetUri
      };

      const { data } = await queryExtensions(queryBody);
      const response = data as ExtensionQueryResponse;
      const rewritten = rewriteUrls(response, getBaseUrl(req));

      extensions = (rewritten.results?.[0]?.extensions || []) as Extension[];
      const metadata = rewritten.results?.[0]?.resultMetadata as Array<{ metadataType: string; metadataItems: Array<{ name: string; count: number }> }> || [];
      const countMeta = metadata.find((m) => m.metadataType === "ResultCount");
      totalCount = countMeta?.metadataItems?.[0]?.count || extensions.length;

      // Apply policy filtering if DB is available
      if (dbAvailable) {
        try {
          const [mode, rules] = await Promise.all([getPolicyMode(), getRules()]);
          policyMode = mode;
          const extIds = extensions.map((ext) =>
            `${ext.publisher.publisherName}.${ext.extensionName}`.toLowerCase()
          );
          const policyListMap = await getBulkListStatus(extIds);
          policyStatus = policyListMap;

          // Identify blocked extensions
          for (const ext of extensions) {
            const extId = `${ext.publisher.publisherName}.${ext.extensionName}`.toLowerCase();
            const listEntry = policyListMap.get(extId) || null;
            if (!isExtensionAllowed(ext, rules, mode, listEntry)) {
              blockedExtIds.add(extId);
            }
          }

          // Non-admin: always filter. Admin: filter unless showBlocked is checked
          if (!showBlocked || !isAdmin) {
            extensions = filterExtensions(extensions, rules, mode, policyListMap);
            totalCount = extensions.length;
          }
        } catch (err) {
          console.error("Policy filtering failed, showing unfiltered:", (err as Error).message);
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch extensions:", (err as Error).message);
  }

  res.render("browse", {
    extensions,
    search,
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    showBlocked: isAdmin ? showBlocked : false,
    blockedExtIds: Array.from(blockedExtIds),
    isAdmin,
    policyMode,
    policyStatus,
    success: (req.query.success as string) || null,
  });
});

// Handle policy actions from browse page (admin only)
router.post("/extensions/policy", async (req, res) => {
  if (res.locals.user?.role !== "admin") {
    res.redirect("/");
    return;
  }

  const { extension_id, list_type, action, search: formSearch, page: formPage, show_blocked: formShowBlocked } = req.body;

  if (action === "remove") {
    await removeFromListByExtensionId(extension_id);
  } else if (action === "add" && (list_type === "whitelist" || list_type === "blacklist")) {
    await addToList(extension_id, list_type, res.locals.user?.id || null);
  }

  const params = new URLSearchParams();
  if (formSearch) params.set("search", formSearch);
  if (formPage && formPage !== "1") params.set("page", formPage);
  if (formShowBlocked === "1") params.set("show_blocked", "1");
  params.set("success", `"${extension_id}" ${action === "remove" ? "removed from list" : "added to " + list_type}`);
  res.redirect(`/?${params.toString()}`);
});

// Extension detail page
router.get("/extension/:publisher/:name", async (req, res) => {
  const { publisher, name } = req.params;

  try {
    const queryBody = {
      filters: [
        {
          criteria: [
            { filterType: 7, value: `${publisher}.${name}` },
          ],
          pageNumber: 1,
          pageSize: 1,
          sortBy: 0,
          sortOrder: 0,
        },
      ],
      assetTypes: [],
      flags: 0x200 | 0x2 | 0x1 | 0x80 | 0x100, // IncludeFiles | IncludeStatistics | IncludeVersions | IncludeAssetUri | IncludeVersionProperties
    };

    const { data } = await queryExtensions(queryBody);
    const response = data as ExtensionQueryResponse;
    const rewritten = rewriteUrls(response, getBaseUrl(req));
    const extension = rewritten.results?.[0]?.extensions?.[0] as Extension | undefined;

    if (!extension) {
      res.status(404).render("layout", {
        title: "Not Found",
        body: "<div class='container mt-5'><h2>Extension not found</h2></div>",
      });
      return;
    }

    // Check if this extension is allowed by policy
    if (dbAvailable) {
      try {
        const [policyMode, rules] = await Promise.all([getPolicyMode(), getRules()]);
        const extId = `${extension.publisher.publisherName}.${extension.extensionName}`.toLowerCase();
        const policyListMap = await getBulkListStatus([extId]);
        const allowed = filterExtensions([extension], rules, policyMode, policyListMap);
        if (allowed.length === 0) {
          res.status(403).render("layout", {
            title: "Blocked",
            body: "<div class='container mt-5'><h2>This extension is blocked by policy</h2><p><a href='/'>Back to browse</a></p></div>",
          });
          return;
        }
      } catch (err) {
        console.error("Policy check failed, allowing access:", (err as Error).message);
      }
    }

    res.render("extension", { extension });
  } catch (err) {
    console.error("Failed to fetch extension:", (err as Error).message);
    res.status(500).render("layout", {
      title: "Error",
      body: "<div class='container mt-5'><h2>Failed to load extension</h2></div>",
    });
  }
});

export default router;
