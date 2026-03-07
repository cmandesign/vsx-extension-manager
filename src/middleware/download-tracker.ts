import type { Request, Response, NextFunction } from "express";
import { trackDownload } from "../services/stats-service.js";

export function downloadTracker(req: Request, res: Response, next: NextFunction): void {
  // Track after response is sent (non-blocking)
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const { publisher, extension, version } = req.params;
      const assetType = String(req.params.assetType || "vspackage");
      const userId = res.locals.user?.id || null;

      if (publisher && extension && version) {
        trackDownload(String(publisher), String(extension), String(version), assetType, userId).catch((err: Error) => {
          console.error("Failed to track download:", err.message);
        });
      }
    }
  });
  next();
}
