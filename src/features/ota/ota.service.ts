import { randomUUID, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { DbProvider } from "@infra/db.provider";
import type { ExpoAsset, ExpoManifest } from "./ota.types";
import { isExpoAsset, isInRollout, parseStoredJson } from "./ota.utils";

interface ManifestRequest {
  appSlug?: string;
  projectId?: string;
  runtimeVersion: string;
  platform: string;
  channel?: string;
  installationId?: string;
  forwardedFor?: string;
  realIp?: string;
}

interface StoredApp {
  id: string;
  slug: string;
  projectId: string | null;
}

interface PublishUpdateInput {
  appSlug: string;
  projectId?: string;
  runtimeVersion: string;
  platform: "ios" | "android";
  channel: string;
  launchAsset: ExpoAsset;
  assets: ExpoAsset[];
  extra: Record<string, unknown>;
}

export class OtaService {
  static readonly inject = [DbProvider] as const;

  constructor(private readonly database: DbProvider) {}

  async getManifest(input: ManifestRequest): Promise<ExpoManifest | null> {
    const app = await this.findApp(input.projectId, input.appSlug);
    if (!app) return null;

    const channel = input.channel?.trim() || "production";
    const updates = await this.database.prisma.orm.public.Update
      .where({
        appId: app.id,
        runtimeVersion: input.runtimeVersion,
        platform: input.platform,
        channel,
        isActive: true,
      })
      .orderBy((update) => update.createdAt.desc())
      .all();

    const clientId =
      input.installationId?.trim() ||
      input.forwardedFor?.split(",")[0]?.trim() ||
      input.realIp?.trim() ||
      "";
    const selected = updates
      .filter((update) => isInRollout(app.id, clientId, update.rollout))
      .at(0);

    if (!selected) return null;

    const storedLaunchAsset = parseStoredJson<unknown>(
      selected.launchAsset,
      "launchAsset",
    );
    const launchAsset = isExpoAsset(storedLaunchAsset)
      ? storedLaunchAsset
      : selected.bundleUrl
        ? isHttpUrl(selected.bundleUrl)
          ? {
            key: selected.id,
            contentType: "application/javascript",
            url: selected.bundleUrl,
            }
          : null
        : null;
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

  async listApps() {
    const apps = await this.database.prisma.orm.public.App
      .select("id", "slug", "projectId", "createdAt")
      .all();
    const updates = await this.database.prisma.orm.public.Update
      .select(
        "id",
        "appId",
        "runtimeVersion",
        "platform",
        "channel",
        "rollout",
        "isActive",
        "createdAt",
      )
      .orderBy((update) => update.createdAt.desc())
      .all();

    return apps
      .map((app) => ({
        ...app,
        updates: updates
          .filter((update) => update.appId === app.id)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      }))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async setRollout(updateId: string, rollout: number) {
    const updated = await this.database.prisma.orm.public.Update
      .where({ id: updateId })
      .update({ rollout });
    return updated ?? null;
  }

  async rollback(updateId: string) {
    const updated = await this.database.prisma.orm.public.Update
      .where({ id: updateId })
      .update({ isActive: false });
    return updated ?? null;
  }

  async publish(input: PublishUpdateInput) {
    const projectId = input.projectId ?? null;
    const app = await this.database.prisma.orm.public.App
      .where({ slug: input.appSlug })
      .upsert({
        create: { slug: input.appSlug, projectId },
        update: projectId ? { projectId } : {},
      });

    const id = randomUUID();
    const update = await this.database.prisma.orm.public.Update.create({
      id,
      appId: app.id,
      runtimeVersion: input.runtimeVersion,
      platform: input.platform,
      channel: input.channel,
      bundleUrl: input.launchAsset.url,
      launchAsset: JSON.stringify(input.launchAsset),
      assets: JSON.stringify(input.assets),
      metadata: JSON.stringify({
        app: input.appSlug,
        channel: input.channel,
        platform: input.platform,
      }),
      extra: JSON.stringify(input.extra),
      rollout: 100,
      isActive: true,
    });

    return update;
  }

  async serveAsset(filename: string): Promise<Response> {
    if (!/^[A-Za-z0-9_-]{43}\.[a-z0-9]{1,10}$/.test(filename)) {
      return new Response("Not found", { status: 404 });
    }

    const storageRoot = resolve(process.env["OTA_STORAGE_DIR"] ?? "storage");
    const file = Bun.file(resolve(storageRoot, "assets", filename));
    if (!(await file.exists())) return new Response("Not found", { status: 404 });

    return new Response(file, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": contentTypeFor(filename),
        "x-content-type-options": "nosniff",
      },
    });
  }

  authorizeAdmin(authorization: string | undefined): "authorized" | "unauthorized" | "unconfigured" {
    const expected = process.env["OTA_ADMIN_TOKEN"];
    if (!expected) return "unconfigured";
    if (!authorization?.startsWith("Bearer ")) return "unauthorized";

    const actual = Buffer.from(authorization.slice("Bearer ".length));
    const expectedBytes = Buffer.from(expected);
    if (
      actual.byteLength !== expectedBytes.byteLength ||
      !timingSafeEqual(actual, expectedBytes)
    ) {
      return "unauthorized";
    }
    return "authorized";
  }

  private async findApp(projectId?: string, appSlug?: string): Promise<StoredApp | null> {
    if (appSlug) {
      const bySlug = await this.database.prisma.orm.public.App
        .where({ slug: appSlug })
        .first();
      if (bySlug) {
        if (projectId && bySlug.projectId && bySlug.projectId !== projectId) return null;
        return bySlug;
      }
    }
    if (projectId) {
      const byProjectId = await this.database.prisma.orm.public.App
        .where({ projectId })
        .first();
      if (byProjectId) return byProjectId;
      return null;
    }

    const apps = await this.database.prisma.orm.public.App
      .select("id", "slug", "projectId")
      .all();
    return apps.length === 1 ? apps[0] ?? null : null;
  }
}

function contentTypeFor(filename: string): string {
  const extension = filename.split(".").at(-1)?.toLowerCase();
  const contentTypes: Record<string, string> = {
    avif: "image/avif",
    gif: "image/gif",
    heic: "image/heic",
    hbc: "application/javascript",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "application/javascript",
    json: "application/json",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    otf: "font/otf",
    png: "image/png",
    svg: "image/svg+xml",
    ttf: "font/ttf",
    woff: "font/woff",
    woff2: "font/woff2",
    webp: "image/webp",
  };
  return (extension && contentTypes[extension]) || "application/octet-stream";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
