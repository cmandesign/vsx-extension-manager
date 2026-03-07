import "dotenv/config";

export interface Config {
  port: number;
  upstreamUrl: string;
  publicBaseUrl: string;
  logLevel: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  sessionSecret: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || "3000", 10),
  upstreamUrl: (process.env.UPSTREAM_URL || "https://marketplace.visualstudio.com").replace(
    /\/$/,
    ""
  ),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  logLevel: process.env.LOG_LEVEL || "info",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "vsx",
    password: process.env.DB_PASSWORD || "vsx_password",
    database: process.env.DB_NAME || "vsx_manager",
  },
  sessionSecret: process.env.SESSION_SECRET || "change-me-in-production",
};
