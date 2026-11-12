import type { ExpoAsset, ExpoRequestHeaders, ManifestResult } from "./ota.types";
import { isExpoAsset, isInRollout, parseStoredJson } from "./ota.utils";
import { OtaRepo } from "./ota.repo";

interface StoredApp {
  id: string;
  projectId: string | null;
}

export class OtaManifestService {
  static readonly needs = [OtaRepo] as const;

  constructor(private readonly repo: OtaRepo) {}

  async resolve(input: {
    appSlug?: string;
    headers: ExpoRequestHeaders;
  }): Promise<ManifestResult> {
    const headers = input.headers;
    if (headers["expo-protocol-version"] !== "1") {
      return { ok: false, status: 400, error: "expo-protocol-version must be 1" };
    }

    const platform = headers["expo-platform"];
    const runtimeVersion = headers["expo-runtime-version"]?.trim();
    if (platform !== "ios" && platform !== "android") {
      return { ok: false, status: 400, error: "expo-platform must be ios or android" };
    }
    if (!runtimeVersion) {
      return { ok: false, status: 400, error: "expo-runtime-version is required" };
    }

    const accept = headers.accept?.toLowerCase();
    if (accept && !accept.includes("application/json") && !accept.includes("*/*")) {
      return { ok: false, status: 406, error: "This server only supports JSON manifests" };
    }
    if (headers["expo-expect-signature"]) {
      return {
        ok: false,
        status: 406,
        error: "Manifest code signing is not configured on this server",
      };
    }

    const manifest = await this.getManifest({
      appSlug: input.appSlug,
      projectId: headers["expo-project-id"],
      runtimeVersion,
      platform,
      channel: headers["expo-channel-name"],
      installationId: headers["expo-installation-id"] ?? headers["expo-device-id"],
      forwardedFor: headers["x-forwarded-for"],
      realIp: headers["x-real-ip"],
    });
    if (!manifest) {
      return {
        ok: false,
        status: 406,
        error: "No active update matches this app, channel, platform, and runtime",
      };
    }
    return { ok: true, manifest };
  }

  private async getManifest(input: {
    appSlug?: string;
    projectId?: string;
    runtimeVersion: string;
    platform: string;
    channel?: string;
    installationId?: string;
    forwardedFor?: string;
    realIp?: string;
  }) {
    const app = await this.findApp(input.projectId, input.appSlug);
    if (!app) return null;

    const channel = input.channel?.trim() || "production";
    const updates = await this.repo.listActiveUpdates({
      appId: app.id,
      runtimeVersion: input.runtimeVersion,
      platform: input.platform,
      channel,
    });
    const clientId =
      input.installationId?.trim() ||
      input.forwardedFor?.split(",")[0]?.trim() ||
      input.realIp?.trim() ||
      "";
    const matched = updates
      .filter((update) => isInRollout(app.id, clientId, update.rollout))
      .at(0);
    if (!matched) return null;
    const selected = await this.repo.promoteRestoredRelease(matched);

    const storedLaunchAsset = parseStoredJson<unknown>(selected.launchAsset, "launchAsset");
    const launchAsset = launchAssetFrom(selected.id, storedLaunchAsset, selected.bundleUrl);
    if (!launchAsset) {
      throw new Error(`Stored OTA update ${selected.id} has no usable launch asset URL`);
    }

    const storedAssets = parseStoredJson<unknown>(selected.assets, "assets");
    if (!Array.isArray(storedAssets) || !storedAssets.every(isExpoAsset)) {
      throw new Error(`Stored OTA update ${selected.id} contains invalid Expo assets`);
    }

    return {
      id: selected.id,
      createdAt: selected.createdAt.toISOString(),
      runtimeVersion: selected.runtimeVersion,
      launchAsset,
      assets: storedAssets,
      metadata: parseStoredJson<Record<string, string>>(selected.metadata, "metadata"),
      extra: parseStoredJson<Record<string, unknown>>(selected.extra, "extra"),
    };
  }

  private async findApp(projectId?: string, appSlug?: string): Promise<StoredApp | null> {
    if (appSlug) {
      const bySlug = await this.repo.findAppBySlug(appSlug);
      if (bySlug) {
        if (projectId && bySlug.projectId && bySlug.projectId !== projectId) return null;
        return bySlug;
      }
    }
    if (projectId) return this.repo.findAppByProjectId(projectId);

    const apps = await this.repo.listAppIdentities();
    return apps.length === 1 ? apps[0] ?? null : null;
  }
}

function launchAssetFrom(
  updateId: string,
  stored: unknown,
  bundleUrl: string | null,
): ExpoAsset | null {
  if (isExpoAsset(stored)) return stored;
  if (!bundleUrl || !isHttpUrl(bundleUrl)) return null;
  return {
    key: updateId,
    contentType: "application/javascript",
    url: bundleUrl,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
