import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PublishUpdateInput } from "./ota.types";
import { isExpoAsset, isNodeError } from "./ota.utils";
import { OtaRepo } from "./ota.repo";

interface PendingPublish {
  id: string;
  createdAt: string;
  input: PublishUpdateInput;
}

interface PublishedUpdate {
  id: string;
  createdAt: Date;
}

export class OtaPublishService {
  static readonly needs = [OtaRepo] as const;

  constructor(private readonly repo: OtaRepo) {}

  async publish(input: PublishUpdateInput): Promise<PublishedUpdate> {
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

  async retryPendingPublish(id: string): Promise<PublishedUpdate | null> {
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

  private async commitPublish(pending: PendingPublish): Promise<PublishedUpdate> {
    const { input } = pending;
    const projectId = input.projectId ?? null;
    let appId: string;
    try {
      const app = await this.repo.upsertApp(input.appSlug, projectId);
      appId = app.id;
    } catch (error) {
      logPublishFailure("app-upsert", input, error);
      throw error;
    }

    try {
      const update = await this.repo.upsertUpdate(pending.id, {
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
      });
      return { id: update.id, createdAt: update.createdAt };
    } catch (error) {
      logPublishFailure("update-create", input, error);
      throw error;
    }
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
    const contents = await readFile(resolve(pendingPublishesDirectory(), `${id}.json`), "utf8");
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

function logPublishFailure(
  phase: "app-upsert" | "update-create",
  input: PublishUpdateInput,
  error: unknown,
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
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
