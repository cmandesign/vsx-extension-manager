import { Router } from "express";
import { Readable } from "node:stream";
import { fetchAsset } from "../services/marketplace-client.js";
import { config } from "../config.js";

const router = Router();

// Proxy asset downloads (rewritten URL pattern)
router.get("/assets/:publisher/:extension/:version/assetbyname/:assetType", async (req, res, next) => {
  try {
    const { publisher, extension, version, assetType } = req.params;

    const upstreamUrl = `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${extension}/${version}/assetbyname/${assetType}`;
    console.log(`  ↳ Fetching upstream: ${upstreamUrl}`);

    await streamAsset(upstreamUrl, res);
  } catch (err) {
    next(err);
  }
});

// Proxy vspackage downloads (alternative URL pattern used by some VS Code versions)
router.get(
  "/_apis/public/gallery/publishers/:publisher/vsextensions/:extension/:version/vspackage",
  async (req, res, next) => {
    try {
      const { publisher, extension, version } = req.params;
      const upstreamUrl = `${config.upstreamUrl}/_apis/public/gallery/publishers/${publisher}/vsextensions/${extension}/${version}/vspackage`;
      console.log(`  ↳ Fetching upstream: ${upstreamUrl}`);

      await streamAsset(upstreamUrl, res);
    } catch (err) {
      next(err);
    }
  }
);

async function streamAsset(upstreamUrl: string, res: import("express").Response) {
  const upstream = await fetchAsset(upstreamUrl);

  res.status(upstream.status);
  for (const [key, val] of Object.entries(upstream.headers)) {
    res.setHeader(key, val);
  }

  if (upstream.body) {
    const nodeStream = Readable.fromWeb(upstream.body as import("stream/web").ReadableStream);
    nodeStream.pipe(res);
  } else {
    res.end();
  }
}

export default router;
