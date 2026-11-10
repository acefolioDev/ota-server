import { consoleLogger, healthRoutes, start } from "@elpod/core";
import { app, config } from "./app";

const { server } = await start(app, {
  listen: config.port,
  logger: consoleLogger(),
  configure: (elysia) => healthRoutes(elysia),
});

console.log(`  listening on http://localhost:${server.server?.port}\n`);
