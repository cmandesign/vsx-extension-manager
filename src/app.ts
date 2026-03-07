import express from "express";
import healthRouter from "./routes/health.js";
import galleryRouter from "./routes/gallery.js";
import assetsRouter from "./routes/assets.js";

const app = express();

// CORS — allow VS Code (vscode-file:// origin) to reach the proxy
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Parse JSON bodies (large limit for marketplace query payloads)
app.use(express.json({ limit: "5mb" }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`→ ${new Date().toISOString()} ${req.method} ${req.url}`);
  res.on("close", () => {
    const duration = Date.now() - start;
    console.log(`← ${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Routes
app.use(healthRouter);
app.use(galleryRouter);
app.use(assetsRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Error:", err.message);
    res.status(502).json({ error: "Upstream request failed", message: err.message });
  }
);

export default app;
