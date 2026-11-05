import type { ElpodElysia } from "@elpod/core";
import { t } from "elysia";
import { OtaService } from "./ota.service";

export class OtaController {
  static readonly inject = [OtaService] as const;

  constructor(private readonly service: OtaService) {}

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
