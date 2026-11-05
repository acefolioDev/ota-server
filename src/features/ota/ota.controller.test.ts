import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { OtaService } from "./ota.service";
import type { ExpoAsset } from "./ota.types";
import { OtaController } from "./ota.controller";

type PublishInput = Parameters<OtaService["publish"]>[0];
const validAuthorization = ["Bearer", "unit-test-token"].join(" ");

const launchAsset: ExpoAsset = {
  key: "bundle-hash",
  contentType: "application/javascript",
  url: "https://ota.example.com/api/assets/bundle.hbc",
};

function createTestApp(
  publish: (input: PublishInput) => Promise<{ id: string; createdAt: Date }>,
  options: {
    pending?: Array<{
      id: string;
      createdAt: string;
      appSlug: string;
      runtimeVersion: string;
      platform: "ios" | "android";
      channel: string;
    }>;
    retryPendingPublish?: (id: string) => Promise<{ id: string; createdAt: Date } | null>;
  } = {},
) {
  const service = {
    authorizeAdmin: (authorization: string | undefined) =>
      authorization === validAuthorization ? "authorized" as const : "unauthorized" as const,
    getManifest: async () => null,
    listApps: async () => [],
    listPendingPublishes: async () => options.pending ?? [],
    publish: async (input: PublishInput) => publish(input),
    rollback: async () => null,
    retryPendingPublish: options.retryPendingPublish ?? (async () => null),
    serveAsset: async () => new Response("Not found", { status: 404 }),
    setRollout: async () => null,
    storeAsset: async () => true,
  };
  return new OtaController(service).routes(new Elysia());
}

const publishBody = {
  appSlug: "miki",
  runtimeVersion: "1.0.0",
  platform: "android" as const,
  channel: "production",
  launchAsset,
  assets: [],
  extra: { expoClient: { name: "Miki" } },
};

test("admin update publish creates an update through the service", async () => {
  let publishedInput: PublishInput | undefined;
  const app = createTestApp(async (input) => {
    publishedInput = input;
    return { id: "update-id", createdAt: new Date("2026-11-05T00:00:00.000Z") };
  });

  const response = await app.handle(new Request("http://localhost/admin/updates", {
    method: "POST",
    headers: {
      authorization: validAuthorization,
      "content-type": "application/json",
    },
    body: JSON.stringify(publishBody),
  }));

  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({
    id: "update-id",
    createdAt: "2026-11-05T00:00:00.000Z",
  });
  expect(publishedInput).toEqual(publishBody);
});

test("admin update publish requires authentication", async () => {
  let publishCalled = false;
  const app = createTestApp(async () => {
    publishCalled = true;
    return { id: "update-id", createdAt: new Date() };
  });

  const response = await app.handle(new Request("http://localhost/admin/updates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(publishBody),
  }));

  expect(response.status).toBe(401);
  expect(publishCalled).toBe(false);
});

test("admin pending updates can be listed", async () => {
  const pending = [{
    id: "pending-id",
    createdAt: "2026-11-05T00:00:00.000Z",
    appSlug: "miki",
    runtimeVersion: "1.0.0",
    platform: "android" as const,
    channel: "production",
  }];
  const app = createTestApp(async () => ({ id: "unused", createdAt: new Date() }), { pending });
  const response = await app.handle(new Request("http://localhost/admin/pending-updates", {
    headers: { authorization: validAuthorization },
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(pending);
});

test("admin pending update retry publishes and returns the release ID", async () => {
  let retriedId: string | undefined;
  const app = createTestApp(
    async () => ({ id: "unused", createdAt: new Date() }),
    {
      retryPendingPublish: async (id) => {
        retriedId = id;
        return { id: "release-id", createdAt: new Date("2026-11-05T00:00:00.000Z") };
      },
    },
  );
  const response = await app.handle(new Request(
    "http://localhost/admin/pending-updates/pending-id/retry",
    {
      method: "POST",
      headers: { authorization: validAuthorization },
    },
  ));
  expect(response.status).toBe(201);
  expect(retriedId).toBe("pending-id");
  expect(await response.json()).toEqual({
    id: "release-id",
    createdAt: "2026-11-05T00:00:00.000Z",
  });
});
