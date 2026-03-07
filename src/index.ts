import app from "./app.js";
import { config } from "./config.js";

app.listen(config.port, () => {
  console.log(`VSX Extension Manager proxy listening on port ${config.port}`);
  console.log(`Upstream: ${config.upstreamUrl}`);
  console.log(`Public URL: ${config.publicBaseUrl}`);
});
