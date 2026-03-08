import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { listUsers, createUser, updateUser, deleteUser } from "../services/user-service.js";
import { getTotalDownloads, getTopExtensions, getRecentDownloads, getDownloadsByDate } from "../services/stats-service.js";
import { getPolicyMode, setPolicyMode, getPolicyList, addToList, removeFromList, removeFromListByExtensionId, getBulkListStatus } from "../services/policy-service.js";
import { getRules, createRule, updateRule, deleteRule } from "../services/rule-engine.js";
import { queryExtensions } from "../services/marketplace-client.js";
import { rewriteUrls, getBaseUrl } from "../services/url-rewriter.js";
import type { ExtensionQueryResponse } from "../types/marketplace.js";

const router = Router();

// All admin routes require admin role
router.use("/admin", requireAdmin);

// Redirect /admin to /admin/dashboard
router.get("/admin", (_req, res) => {
  res.redirect("/admin/dashboard");
});

// Dashboard with download stats
router.get("/admin/dashboard", async (_req, res) => {
  const [totalDownloads, topExtensions, recentDownloads, downloadsByDate] = await Promise.all([
    getTotalDownloads(),
    getTopExtensions(10),
    getRecentDownloads(20),
    getDownloadsByDate(30),
  ]);

  res.render("admin/dashboard", {
    totalDownloads,
    topExtensions,
    recentDownloads,
    downloadsByDate,
  });
});

// User management page
router.get("/admin/users", async (_req, res) => {
  const users = await listUsers();
  res.render("admin/users", { users, error: null, success: null });
});

// Create user
router.post("/admin/users", async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    const users = await listUsers();
    res.render("admin/users", { users, error: "Username and password are required", success: null });
    return;
  }

  try {
    await createUser(username, password, role || "viewer");
    const users = await listUsers();
    res.render("admin/users", { users, error: null, success: `User "${username}" created` });
  } catch (err: unknown) {
    const users = await listUsers();
    const message = err instanceof Error && err.message.includes("Duplicate")
      ? "Username already exists"
      : "Failed to create user";
    res.render("admin/users", { users, error: message, success: null });
  }
});

// Update user
router.post("/admin/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { username, password, role } = req.body;

  try {
    await updateUser(id, { username: username || undefined, password: password || undefined, role: role || undefined });
  } catch {
    // ignore update errors
  }

  res.redirect("/admin/users");
});

// Delete user
router.post("/admin/users/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id);

  // Prevent deleting yourself
  if (res.locals.user?.id === id) {
    const users = await listUsers();
    res.render("admin/users", { users, error: "Cannot delete your own account", success: null });
    return;
  }

  await deleteUser(id);
  res.redirect("/admin/users");
});

// --- Policy Management ---

// Policy settings page
router.get("/admin/policy", async (_req, res) => {
  const [policyMode, policyList] = await Promise.all([
    getPolicyMode(),
    getPolicyList(),
  ]);
  res.render("admin/policy", { policyMode, policyList, error: null, success: null });
});

// Update policy mode
router.post("/admin/policy/mode", async (req, res) => {
  const { mode } = req.body;
  if (mode !== "blacklist" && mode !== "whitelist") {
    const [policyMode, policyList] = await Promise.all([getPolicyMode(), getPolicyList()]);
    res.render("admin/policy", { policyMode, policyList, error: "Invalid mode", success: null });
    return;
  }

  await setPolicyMode(mode);
  const policyList = await getPolicyList();
  res.render("admin/policy", { policyMode: mode, policyList, error: null, success: `Policy mode set to ${mode}` });
});

// Add extension to policy list
router.post("/admin/policy/list/add", async (req, res) => {
  const { extension_id, list_type } = req.body;

  if (!extension_id || (list_type !== "whitelist" && list_type !== "blacklist")) {
    const [policyMode, policyList] = await Promise.all([getPolicyMode(), getPolicyList()]);
    res.render("admin/policy", { policyMode, policyList, error: "Extension ID and valid list type required", success: null });
    return;
  }

  await addToList(extension_id, list_type, res.locals.user?.id || null);
  const [policyMode, policyList] = await Promise.all([getPolicyMode(), getPolicyList()]);
  res.render("admin/policy", { policyMode, policyList, error: null, success: `"${extension_id}" added to ${list_type}` });
});

// Remove extension from policy list
router.post("/admin/policy/list/:id/remove", async (req, res) => {
  const id = parseInt(req.params.id);
  await removeFromList(id);
  res.redirect("/admin/policy");
});

// --- Admin Extensions Browse ---

router.get("/admin/extensions", async (req, res) => {
  const search = (req.query.search as string) || "";
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = 12;

  let extensions: any[] = [];
  let totalCount = 0;
  const policyMode = await getPolicyMode();

  try {
    const queryBody = {
      filters: [
        {
          criteria: [
            { filterType: 8, value: "Microsoft.VisualStudio.Code" },
            ...(search ? [{ filterType: 10, value: search }] : []),
          ],
          pageNumber: page,
          pageSize,
          sortBy: search ? 6 : 4,
          sortOrder: 0,
        },
      ],
      assetTypes: [],
      flags: 0x200 | 0x2 | 0x1 | 0x80,
    };

    const { data } = await queryExtensions(queryBody);
    const response = data as ExtensionQueryResponse;
    const rewritten = rewriteUrls(response, getBaseUrl(req));

    extensions = rewritten.results?.[0]?.extensions || [];
    const metadata = rewritten.results?.[0]?.resultMetadata as Array<{ metadataType: string; metadataItems: Array<{ name: string; count: number }> }> || [];
    const countMeta = metadata.find((m) => m.metadataType === "ResultCount");
    totalCount = countMeta?.metadataItems?.[0]?.count || extensions.length;
  } catch (err) {
    console.error("Failed to fetch extensions:", (err as Error).message);
  }

  // Get policy status for all visible extensions
  const extIds = extensions.map((ext: any) =>
    `${ext.publisher?.publisherName || ""}.${ext.extensionName || ""}`.toLowerCase()
  );
  const policyStatus = await getBulkListStatus(extIds);

  res.render("admin/extensions", {
    extensions,
    search,
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    policyMode,
    policyStatus,
    error: (req.query.error as string) || null,
    success: (req.query.success as string) || null,
  });
});

// Add/remove extension from policy list (from admin browse)
router.post("/admin/extensions/policy", async (req, res) => {
  const { extension_id, list_type, action } = req.body;
  const search = (req.query.search as string) || "";
  const page = (req.query.page as string) || "1";

  if (action === "remove") {
    await removeFromListByExtensionId(extension_id);
  } else if (action === "add" && (list_type === "whitelist" || list_type === "blacklist")) {
    await addToList(extension_id, list_type, res.locals.user?.id || null);
  }

  const redirect = `/admin/extensions?search=${encodeURIComponent(search)}&page=${page}&success=${encodeURIComponent(`"${extension_id}" ${action === 'remove' ? 'removed from list' : 'added to ' + list_type}`)}`;
  res.redirect(redirect);
});

// --- Rule Management ---

router.get("/admin/rules", async (_req, res) => {
  const rules = await getRules();
  res.render("admin/rules", { rules, error: null, success: null });
});

router.post("/admin/rules", async (req, res) => {
  const { field, operator, value, action, priority, override_policy } = req.body;

  try {
    await createRule({
      field,
      operator,
      value,
      action,
      priority: parseInt(priority) || 0,
      override_policy: override_policy === "1",
      enabled: true,
    });
    const rules = await getRules();
    res.render("admin/rules", { rules, error: null, success: "Rule created" });
  } catch (err) {
    const rules = await getRules();
    res.render("admin/rules", { rules, error: `Failed to create rule: ${(err as Error).message}`, success: null });
  }
});

router.post("/admin/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { field, operator, value, action, priority, override_policy, enabled } = req.body;

  try {
    await updateRule(id, {
      field: field || undefined,
      operator: operator || undefined,
      value: value || undefined,
      action: action || undefined,
      priority: priority !== undefined ? parseInt(priority) : undefined,
      override_policy: override_policy === "1",
      enabled: enabled === "1",
    });
  } catch {
    // ignore update errors
  }

  res.redirect("/admin/rules");
});

router.post("/admin/rules/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id);
  await deleteRule(id);
  res.redirect("/admin/rules");
});

export default router;
