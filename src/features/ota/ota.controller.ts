import type { ElpodElysia } from "@elpod/core";
import { t } from "elysia";
import { OtaAdminService } from "./ota-admin.service";
import { OtaAssetService } from "./ota-asset.service";
import { OtaManifestService } from "./ota-manifest.service";
import { OtaPublishService } from "./ota-publish.service";

const expoAssetSchema = t.Object({
  hash: t.Optional(t.String()),
  key: t.String({ minLength: 1 }),
  contentType: t.String({ minLength: 1 }),
  fileExtension: t.Optional(t.String()),
  url: t.String({ minLength: 1 }),
});

export class OtaController {
  static readonly needs = [
    OtaManifestService,
    OtaPublishService,
    OtaAssetService,
    OtaAdminService,
  ] as const;

  constructor(
    private readonly manifest: Pick<OtaManifestService, "resolve">,
    private readonly publish: Pick<
      OtaPublishService,
      "listPendingPublishes" | "publish" | "retryPendingPublish"
    >,
    private readonly assets: Pick<OtaAssetService, "serveAsset" | "storeAsset">,
    private readonly admin: Pick<
      OtaAdminService,
      "authorizeAdmin" | "listApps" | "rollback" | "setRollout"
    >,
  ) {}

  routes(app: ElpodElysia) {
    return app
      .get("/manifest", async ({ headers, query, set }) => {
        set.headers["expo-protocol-version"] = "1";
        set.headers["expo-sfv-version"] = "0";
        set.headers["expo-manifest-filters"] = "";
        set.headers["expo-server-defined-headers"] = "";
        set.headers["cache-control"] = "private, max-age=0";
        set.headers["content-type"] = "application/json";

        const result = await this.manifest.resolve({
          appSlug: query.app,
          headers,
        });
        if (!result.ok) {
          set.status = result.status;
          return { error: result.error };
        }
        return result.manifest;
      })
      .get("/assets/:filename", ({ params }) => this.assets.serveAsset(params.filename))
      .get("/admin/apps", async ({ headers, set }) => {
        const auth = this.authorize(headers.authorization, set);
        if (auth) return auth;
        return this.admin.listApps();
      })
      .get("/admin/pending-updates", async ({ headers, set }) => {
        const auth = this.authorize(headers.authorization, set);
        if (auth) return auth;
        return this.publish.listPendingPublishes();
      })
      .post("/admin/pending-updates/:id/retry", async ({ headers, params, set }) => {
        const auth = this.authorize(headers.authorization, set);
        if (auth) return auth;
        const update = await this.publish.retryPendingPublish(params.id);
        if (!update) {
          set.status = 404;
          return { error: "Pending update not found" };
        }
        set.status = 201;
        return { id: update.id, createdAt: update.createdAt };
      })
      .post(
        "/admin/updates",
        async ({ body, headers, set }) => {
          const auth = this.authorize(headers.authorization, set);
          if (auth) return auth;
          const update = await this.publish.publish(body);
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
        const stored = await this.assets.storeAsset(params.filename, request);
        if (stored === "too-large") {
          set.status = 413;
          return { error: "Asset exceeds the 100 MiB upload limit" };
        }
        if (stored === "bad-filename") {
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
          const update = await this.admin.setRollout(params.id, body.rollout);
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
        const update = await this.admin.rollback(params.id);
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
    const result = this.admin.authorizeAdmin(authorization);
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
