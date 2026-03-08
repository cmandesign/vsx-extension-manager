import { Router } from "express";
import { queryExtensions } from "../services/marketplace-client.js";
import { rewriteUrls, getBaseUrl } from "../services/url-rewriter.js";
import type { ExtensionQueryResponse } from "../types/marketplace.js";

const router = Router();

router.post("/_apis/public/gallery/extensionquery", async (req, res, next) => {
  try {
    const { data, headers } = await queryExtensions(req.body);
    const upstream = data as ExtensionQueryResponse;
    const count = upstream.results?.[0]?.extensions?.length ?? 0;
    console.log(`  ↳ Query returned ${count} extension(s)`);
    const rewritten = rewriteUrls(upstream, getBaseUrl(req));

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
