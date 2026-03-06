import { Router } from "express";
import { queryExtensions } from "../services/marketplace-client.js";
import { rewriteUrls } from "../services/url-rewriter.js";
import type { ExtensionQueryResponse } from "../types/marketplace.js";

const router = Router();

router.post("/_apis/public/gallery/extensionquery", async (req, res, next) => {
  try {
    const upstream = (await queryExtensions(req.body)) as ExtensionQueryResponse;
    const rewritten = rewriteUrls(upstream);
    res.json(rewritten);
  } catch (err) {
    next(err);
  }
});

export default router;
