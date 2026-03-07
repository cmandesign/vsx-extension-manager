import app from "./app.js";
import { config } from "./config.js";
import { dbAvailable } from "./db/connection.js";
import { initDatabase } from "./db/init.js";

async function main() {
  // Initialize database (non-fatal - app works as proxy without it)
  await initDatabase();

  app.listen(config.port, () => {
    console.log(`VSX Extension Manager listening on port ${config.port}`);
    console.log(`Upstream: ${config.upstreamUrl}`);
    console.log(`Public URL: ${config.publicBaseUrl}`);
    console.log(`Browse: http://localhost:${config.port}`);
    if (dbAvailable) {
      console.log(`Admin: http://localhost:${config.port}/admin/dashboard`);
      console.log(`Login: http://localhost:${config.port}/login (admin/admin)`);
    } else {
      console.log("Database unavailable - running in proxy-only mode");
    }
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
