import { Router } from "express";
import { queryExtensions } from "../services/marketplace-client.js";
import { rewriteUrls, getBaseUrl } from "../services/url-rewriter.js";
import { dbAvailable } from "../db/connection.js";
import { getPolicyMode, getBulkListStatus } from "../services/policy-service.js";
import { getRules, filterExtensions } from "../services/rule-engine.js";
import type { Extension, ExtensionQueryResponse } from "../types/marketplace.js";

const router = Router();

router.post("/_apis/public/gallery/extensionquery", async (req, res, next) => {
  try {
    const { data, headers } = await queryExtensions(req.body);
    const upstream = data as ExtensionQueryResponse;
    const count = upstream.results?.[0]?.extensions?.length ?? 0;
    console.log(`  ↳ Query returned ${count} extension(s)`);
    const rewritten = rewriteUrls(upstream, getBaseUrl(req));

    // Apply policy filtering if DB is available
    if (dbAvailable && rewritten.results?.[0]?.extensions) {
      try {
        const extensions = rewritten.results[0].extensions as Extension[];
        const [policyMode, rules] = await Promise.all([getPolicyMode(), getRules()]);
        const extIds = extensions.map((ext) =>
          `${ext.publisher.publisherName}.${ext.extensionName}`.toLowerCase()
        );
        const policyListMap = await getBulkListStatus(extIds);
        const filtered = filterExtensions(extensions, rules, policyMode, policyListMap);
        rewritten.results[0].extensions = filtered;
        console.log(`  ↳ Policy filtered: ${count} → ${filtered.length} extension(s)`);
      } catch (err) {
        console.error("Policy filtering failed, returning unfiltered:", (err as Error).message);
      }
    }

    // Forward upstream response headers
    for (const [key, val] of Object.entries(headers)) {
      res.setHeader(key, val);
    }
    res.json(rewritten);
  } catch (err) {
    next(err);
  }
});

export default router;
