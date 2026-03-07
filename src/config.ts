import "dotenv/config";

export interface Config {
  port: number;
  upstreamUrl: string;
  publicBaseUrl: string;
  logLevel: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || "3000", 10),
  upstreamUrl: (process.env.UPSTREAM_URL || "https://marketplace.visualstudio.com").replace(
    /\/$/,
    ""
  ),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  logLevel: process.env.LOG_LEVEL || "info",
};
