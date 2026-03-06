import express from "express";
import healthRouter from "./routes/health.js";
import galleryRouter from "./routes/gallery.js";
import assetsRouter from "./routes/assets.js";

const app = express();

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
