import { expect, test } from "bun:test";
import { ConfigError, createTestApplication, provideValue } from "@elpod/core";
import { app } from "../app";
import { loadConfig } from "./config";
import { DbProvider } from "./db.provider";

const databaseUrl = "postgresql://db.example/ota";
const adminToken = "test-admin-token";

test("configuration defaults the port and storage directory", () => {
  const config = loadConfig({
    DATABASE_URL: databaseUrl,
    OTA_ADMIN_TOKEN: adminToken,
  });
  expect(config.port).toBe(3000);
  expect(config.storageDir).toBe("storage");
  expect(config.adminToken).toBe(adminToken);
});

test("configuration reports missing secrets together", () => {
  expect(() => loadConfig({})).toThrow(ConfigError);
});

test("admin routes require a bearer token", async () => {
  const testApp = await createTestApplication(app, {
    environment: "test",
    overrides: [provideValue(DbProvider, { prisma: {}, async dispose() {} } as DbProvider)],
  });
  try {
    const response = await testApp.request("/api/admin/apps");
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
        message: "A valid bearer token is required",
      },
    });
  } finally {
    await testApp.dispose();
  }
});
