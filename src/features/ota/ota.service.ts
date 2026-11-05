import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
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

interface PendingPublish {
  id: string;
  createdAt: string;
  input: PublishUpdateInput;
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

  async storeAsset(filename: string, contents: Uint8Array): Promise<boolean> {
    const match = /^([A-Za-z0-9_-]{43})\.[a-z0-9]{1,10}$/.exec(filename);
    if (!match) return false;

    const hash = createHash("sha256").update(contents).digest("base64url");
    if (hash !== match[1]) return false;

    const storageRoot = resolve(process.env["OTA_STORAGE_DIR"] ?? "storage");
    const directory = resolve(storageRoot, "assets");
    const destination = resolve(directory, filename);
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(destination, contents, { flag: "wx" });
      return true;
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) throw error;

      const existing = await readFile(destination);
      return createHash("sha256").update(existing).digest("base64url") === hash;
    }
  }

  async publish(input: PublishUpdateInput) {
    const pending: PendingPublish = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      input,
    };
    await this.writePendingPublish(pending);
    const update = await this.commitPublish(pending);
    await this.removePendingPublish(pending.id);
    return update;
  }

  async listPendingPublishes() {
    const directory = pendingPublishesDirectory();
    let filenames: string[];
    try {
      filenames = await readdir(directory);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) return [];
      throw error;
    }

    const pending = await Promise.all(
      filenames
        .filter((filename) => /^[0-9a-f-]{36}\.json$/.test(filename))
        .map(async (filename) => {
          const item = await this.readPendingPublish(filename.slice(0, -5));
          return {
            id: item.id,
            createdAt: item.createdAt,
            appSlug: item.input.appSlug,
            runtimeVersion: item.input.runtimeVersion,
            platform: item.input.platform,
            channel: item.input.channel,
          };
        }),
    );
    return pending.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async retryPendingPublish(id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    let pending: PendingPublish;
    try {
      pending = await this.readPendingPublish(id);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) return null;
      throw error;
    }

    const update = await this.commitPublish(pending);
    await this.removePendingPublish(pending.id);
    return update;
  }

  private async commitPublish(pending: PendingPublish) {
    const { input } = pending;
    const projectId = input.projectId ?? null;
    let appId: string;
    try {
      const app = await this.database.prisma.orm.public.App
        .where({ slug: input.appSlug })
        .upsert({
          create: { slug: input.appSlug, projectId },
          update: projectId ? { projectId } : {},
        });
      appId = app.id;
    } catch (error) {
      logPublishFailure("app-upsert", input, error);
      throw error;
    }

    let update: Awaited<ReturnType<typeof this.database.prisma.orm.public.Update.create>>;
    try {
      const updateData = {
        appId,
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
      };
      update = await this.database.prisma.orm.public.Update
        .where({ id: pending.id })
        .upsert({
          create: { id: pending.id, ...updateData },
          update: updateData,
        });
    } catch (error) {
      logPublishFailure("update-create", input, error);
      throw error;
    }

    return update;
  }

  private async writePendingPublish(pending: PendingPublish) {
    const directory = pendingPublishesDirectory();
    await mkdir(directory, { recursive: true });
    const temporary = resolve(directory, `${pending.id}.tmp`);
    const destination = resolve(directory, `${pending.id}.json`);
    await writeFile(temporary, JSON.stringify(pending), { flag: "wx" });
    await rename(temporary, destination);
  }

  private async readPendingPublish(id: string): Promise<PendingPublish> {
    const contents = await readFile(
      resolve(pendingPublishesDirectory(), `${id}.json`),
      "utf8",
    );
    const pending = JSON.parse(contents) as PendingPublish;
    if (
      pending.id !== id ||
      typeof pending.createdAt !== "string" ||
      !isPublishInput(pending.input)
    ) {
      throw new Error(`Pending OTA publish ${id} is invalid`);
    }
    return pending;
  }

  private async removePendingPublish(id: string) {
    try {
      await unlink(resolve(pendingPublishesDirectory(), `${id}.json`));
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
    }
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

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
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

function logPublishFailure(
  phase: "app-upsert" | "update-create",
  input: PublishUpdateInput,
  error: unknown,
): void {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const errorCode =
    typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;
  console.error("[ota] update publish failed", {
    phase,
    appSlug: input.appSlug,
    runtimeVersion: input.runtimeVersion,
    platform: input.platform,
    channel: input.channel,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: errorMessage.replace(
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi,
      "[REDACTED_DATABASE_URL]",
    ),
    ...(errorCode ? { errorCode } : {}),
  });
}

function pendingPublishesDirectory(): string {
  return resolve(process.env["OTA_STORAGE_DIR"] ?? "storage", "pending-publishes");
}

function isPublishInput(value: unknown): value is PublishUpdateInput {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input["appSlug"] === "string" &&
    (input["projectId"] === undefined || typeof input["projectId"] === "string") &&
    typeof input["runtimeVersion"] === "string" &&
    (input["platform"] === "ios" || input["platform"] === "android") &&
    typeof input["channel"] === "string" &&
    isExpoAsset(input["launchAsset"]) &&
    Array.isArray(input["assets"]) &&
    input["assets"].every(isExpoAsset) &&
    typeof input["extra"] === "object" &&
    input["extra"] !== null &&
    !Array.isArray(input["extra"])
  );
}
