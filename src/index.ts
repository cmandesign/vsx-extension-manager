import app from "./app.js";
import { config } from "./config.js";
import { initDatabase } from "./db/init.js";

async function main() {
  // Initialize database (create tables, seed admin user)
  try {
    await initDatabase();
  } catch (err) {
    console.error("Failed to initialize database:", (err as Error).message);
    console.error("Make sure MySQL is running and accessible");
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`VSX Extension Manager proxy listening on port ${config.port}`);
    console.log(`Upstream: ${config.upstreamUrl}`);
    console.log(`Public URL: ${config.publicBaseUrl}`);
    console.log(`UI: http://localhost:${config.port}`);
    console.log(`Admin: http://localhost:${config.port}/admin/dashboard`);
  });
}

main();
