import express from "express";
import session from "express-session";
import mysqlSessionStore from "express-mysql-session";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { pool } from "./db/connection.js";
import { optionalUser } from "./middleware/auth.js";
import { downloadTracker } from "./middleware/download-tracker.js";

import healthRouter from "./routes/health.js";
import galleryRouter from "./routes/gallery.js";
import assetsRouter from "./routes/assets.js";
import authRouter from "./routes/auth.js";
import uiRouter from "./routes/ui.js";
import adminRouter from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

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
app.use(express.urlencoded({ extended: true }));

// Session middleware
const MySQLStore = mysqlSessionStore(session as any);
const sessionStore = new MySQLStore({
  createDatabaseTable: false, // We create it in init.ts
  schema: {
    tableName: "sessions",
    columnNames: {
      session_id: "session_id",
      expires: "expires",
      data: "data",
    },
  },
}, pool as any);

app.use(
  session({
    store: sessionStore,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Attach user to all requests
app.use(optionalUser);

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

// API Routes (VS Code proxy - keep these first so they don't conflict with UI)
app.use(healthRouter);
app.use(galleryRouter);

// Download tracking on asset routes
app.use(downloadTracker);
app.use(assetsRouter);

// UI Routes
app.use(authRouter);
app.use(adminRouter);
app.use(uiRouter);

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
