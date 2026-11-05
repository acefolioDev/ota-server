import type { ElpodElysia } from "@elpod/core";
import { t } from "elysia";
import { OtaService } from "./ota.service";

type OtaControllerService = Omit<
  Pick<
    OtaService,
    | "authorizeAdmin"
    | "getManifest"
    | "listApps"
    | "publish"
    | "rollback"
    | "serveAsset"
    | "setRollout"
    | "storeAsset"
  >,
  "publish"
> & {
  publish(
    input: Parameters<OtaService["publish"]>[0],
  ): Promise<Pick<Awaited<ReturnType<OtaService["publish"]>>, "id" | "createdAt">>;
};

export class OtaController {
  static readonly inject = [OtaService] as const;

  constructor(private readonly service: OtaControllerService) {}

  routes(app: ElpodElysia) {
    return app
      .get("/manifest", async ({ headers, query, set }) => {
        set.headers["expo-protocol-version"] = "1";
        set.headers["expo-sfv-version"] = "0";
        set.headers["expo-manifest-filters"] = "";
        set.headers["expo-server-defined-headers"] = "";
        set.headers["cache-control"] = "private, max-age=0";
        set.headers["content-type"] = "application/json";

        if (headers["expo-protocol-version"] !== "1") {
          set.status = 400;
          return { error: "expo-protocol-version must be 1" };
        }

        const platform = headers["expo-platform"];
        const runtimeVersion = headers["expo-runtime-version"]?.trim();
        if (platform !== "ios" && platform !== "android") {
          set.status = 400;
          return { error: "expo-platform must be ios or android" };
        }
        if (!runtimeVersion) {
          set.status = 400;
          return { error: "expo-runtime-version is required" };
        }

        const accept = headers["accept"]?.toLowerCase();
        if (
          accept &&
          !accept.includes("application/json") &&
          !accept.includes("*/*")
        ) {
          set.status = 406;
          return { error: "This server only supports JSON manifests" };
        }

        if (headers["expo-expect-signature"]) {
          set.status = 406;
          return { error: "Manifest code signing is not configured on this server" };
        }

        const manifest = await this.service.getManifest({
          appSlug: query.app,
          projectId: headers["expo-project-id"],
          runtimeVersion,
          platform,
          channel: headers["expo-channel-name"],
          installationId:
            headers["expo-installation-id"] ?? headers["expo-device-id"],
          forwardedFor: headers["x-forwarded-for"],
          realIp: headers["x-real-ip"],
        });
        if (!manifest) {
          set.status = 406;
          return { error: "No active update matches this app, channel, platform, and runtime" };
        }
        return manifest;
      })
      .get("/assets/:filename", ({ params }) =>
        this.service.serveAsset(params.filename),
      )
      .get("/admin/apps", async ({ headers, set }) => {
        const auth = this.authorize(headers.authorization, set);
        if (auth) return auth;
        return this.service.listApps();
      })
      .post(
        "/admin/updates",
        async ({ body, headers, set }) => {
          const auth = this.authorize(headers.authorization, set);
          if (auth) return auth;

          const update = await this.service.publish(body);
          set.status = 201;
          return { id: update.id, createdAt: update.createdAt };
        },
        {
          body: t.Object({
            appSlug: t.String({ minLength: 1 }),
            projectId: t.Optional(t.String({ minLength: 1 })),
            runtimeVersion: t.String({ minLength: 1 }),
            platform: t.Union([t.Literal("ios"), t.Literal("android")]),
            channel: t.String({ minLength: 1 }),
            launchAsset: expoAssetSchema,
            assets: t.Array(expoAssetSchema),
            extra: t.Record(t.String(), t.Any()),
          }),
        },
      )
      .put("/admin/assets/:filename", async ({ headers, params, request, set }) => {
        const auth = this.authorize(headers.authorization, set);
        if (auth) return auth;

        const contentLength = Number(headers["content-length"]);
        if (Number.isFinite(contentLength) && contentLength > MAX_ASSET_UPLOAD_BYTES) {
          set.status = 413;
          return { error: "Asset exceeds the 100 MiB upload limit" };
        }

        const contents = await readRequestBody(request, MAX_ASSET_UPLOAD_BYTES);
        if (!contents) {
          set.status = 413;
          return { error: "Asset exceeds the 100 MiB upload limit" };
        }

        const stored = await this.service.storeAsset(params.filename, contents);
        if (!stored) {
          set.status = 400;
          return { error: "Asset filename must contain its matching base64url SHA-256 hash" };
        }
        set.status = 201;
        return { filename: params.filename, stored: true };
      })
      .patch(
        "/admin/updates/:id/rollout",
        async ({ body, headers, params, set }) => {
          const auth = this.authorize(headers.authorization, set);
          if (auth) return auth;
          const update = await this.service.setRollout(params.id, body.rollout);
          if (!update) {
            set.status = 404;
            return { error: "Update not found" };
          }
          return { id: params.id, rollout: body.rollout };
        },
        {
          body: t.Object({
            rollout: t.Integer({ minimum: 0, maximum: 100 }),
          }),
        },
      )
      .post("/admin/updates/:id/rollback", async ({ headers, params, set }) => {
        const auth = this.authorize(headers.authorization, set);
        if (auth) return auth;
        const update = await this.service.rollback(params.id);
        if (!update) {
          set.status = 404;
          return { error: "Update not found" };
        }
        return { id: params.id, isActive: false };
      });
  }

  private authorize(
    authorization: string | undefined,
    set: { status?: number | string },
  ) {
    const result = this.service.authorizeAdmin(authorization);
    if (result === "authorized") return null;
    set.status = result === "unconfigured" ? 503 : 401;
    return {
      error:
        result === "unconfigured"
          ? "OTA_ADMIN_TOKEN is not configured"
          : "A valid bearer token is required",
    };
  }
}

const MAX_ASSET_UPLOAD_BYTES = 100 * 1024 * 1024;
const expoAssetSchema = t.Object({
  hash: t.Optional(t.String()),
  key: t.String({ minLength: 1 }),
  contentType: t.String({ minLength: 1 }),
  fileExtension: t.Optional(t.String()),
  url: t.String({ minLength: 1 }),
});

async function readRequestBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const contents = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    contents.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return contents;
}
