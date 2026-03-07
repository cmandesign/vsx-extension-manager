import { Router } from "express";
import { queryExtensions } from "../services/marketplace-client.js";
import { rewriteUrls } from "../services/url-rewriter.js";
import type { ExtensionQueryResponse } from "../types/marketplace.js";

const router = Router();

router.post("/_apis/public/gallery/extensionquery", async (req, res, next) => {
  try {
    const upstream = (await queryExtensions(req.body)) as ExtensionQueryResponse;
    const count = upstream.results?.[0]?.extensions?.length ?? 0;
    console.log(`  ↳ Query returned ${count} extension(s)`);
    const rewritten = rewriteUrls(upstream);
    res.setHeader("Content-Type", "application/json;api-version=3.0-preview.1");
    res.json(rewritten);
  } catch (err) {
    next(err);
  }
});

export default router;
