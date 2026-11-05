import { $ } from "bun";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import type { ExpoAsset } from "../src/features/ota/ota.types";

type Platform = "ios" | "android";
type JsonRecord = Record<string, unknown>;

interface PublishOptions {
  projectDir: string;
  appSlug?: string;
  projectId?: string;
  runtimeVersion?: string;
  platform: Platform;
  channel: string;
}

interface PublishedFile {
  asset: ExpoAsset;
}

const usage = `Usage:
  bun run scripts/publish-update.ts --platform <ios|android> [options]

Options:
  --project-dir <path>       Expo project directory (default: current directory)
  --app <slug>               App slug (default: resolved Expo config slug)
  --project-id <uuid>        Expo project ID (default: extra.eas.projectId)
  --runtime-version <value>  Runtime version (default: a string in Expo config)
  --channel <name>           Release channel (default: production)
  --help                     Show this help
`;

function parseOptions(args: string[]): PublishOptions | null {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") {
      console.log(usage);
      return null;
    }
    if (!argument?.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument ?? ""}`);
    }
    const [key, inlineValue] = argument.split("=", 2);
    if (!key) throw new Error(`Unsupported option: ${argument}`);
    const value = inlineValue ?? args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    if (!["--project-dir", "--app", "--project-id", "--runtime-version", "--platform", "--channel"].includes(key)) {
      throw new Error(`Unsupported option: ${key}`);
    }
    values.set(key, value);
    if (inlineValue === undefined) index += 1;
  }

  const platform = values.get("--platform");
  if (platform !== "ios" && platform !== "android") {
    throw new Error("--platform must be ios or android");
  }
  return {
    projectDir: resolve(values.get("--project-dir") ?? process.cwd()),
    appSlug: values.get("--app"),
    projectId: values.get("--project-id"),
    runtimeVersion: values.get("--runtime-version"),
    platform,
    channel: values.get("--channel") ?? "production",
  };
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonRecord;
}

function parseJson(text: string, label: string): JsonRecord {
  try {
    return asRecord(JSON.parse(text), label);
  } catch (error) {
    throw new Error(`Could not read ${label}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

function collectPaths(value: unknown, result: Set<string>): void {
  if (typeof value === "string") {
    result.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, result);
    return;
  }
  if (typeof value !== "object" || value === null) return;

  const record = value as JsonRecord;
  for (const field of ["path", "file", "files", "assetFiles"]) {
    if (field in record) collectPaths(record[field], result);
  }
}

async function recursivelyListFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Expo export contains a symbolic link, which is not supported: ${path}`);
    }
    if (entry.isDirectory()) {
      files.push(...(await recursivelyListFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function safeExportPath(root: string, relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  const absolute = resolve(root, normalized);
  if (
    normalized.startsWith("/") ||
    normalized.split("/").includes("..") ||
    !absolute.startsWith(`${root}${sep}`)
  ) {
    throw new Error(`Invalid file path in Expo export metadata: ${relativePath}`);
  }
  return absolute;
}

function contentTypeFor(path: string): string {
  const extension = extname(path).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".hbc": "application/javascript",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "application/javascript",
    ".json": "application/json",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".otf": "font/otf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return contentTypes[extension] ?? "application/octet-stream";
}

async function storeFile(
  source: string,
  publicOrigin: string,
  adminToken: string,
): Promise<PublishedFile> {
  const bytes = await readFile(source);
  if (bytes.byteLength > 100 * 1024 * 1024) {
    throw new Error(`Asset exceeds the 100 MiB upload limit: ${source}`);
  }
  const hash = createHash("sha256").update(bytes).digest("base64url");
  const rawExtension = extname(source).toLowerCase();
  const extension = /^\.[a-z0-9]{1,10}$/.test(rawExtension) ? rawExtension : ".bin";
  const filename = `${hash}${extension}`;
  const response = await fetch(`${publicOrigin}/api/admin/assets/${filename}`, {
    method: "PUT",
    headers: {
      authorization: "Bearer " + adminToken,
      "content-type": contentTypeFor(source),
    },
    body: bytes,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Could not upload asset ${filename} (HTTP ${response.status})${body ? `: ${body}` : ""}`,
    );
  }

  const url = `${publicOrigin}/api/assets/${filename}`;
  return {
    asset: {
      hash,
      key: hash,
      contentType: contentTypeFor(source),
      ...(extension === ".bin" ? {} : { fileExtension: extension }),
      url,
    },
  };
}

async function publishUpdate(
  publicOrigin: string,
  adminToken: string,
  input: {
    appSlug: string;
    projectId?: string;
    runtimeVersion: string;
    platform: Platform;
    channel: string;
    launchAsset: ExpoAsset;
    assets: ExpoAsset[];
    extra: Record<string, unknown>;
  },
): Promise<string> {
  const response = await fetch(`${publicOrigin}/api/admin/updates`, {
    method: "POST",
    headers: {
      authorization: "Bearer " + adminToken,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Could not publish update (HTTP ${response.status})${body ? `: ${body}` : ""}`,
    );
  }

  const result = parseJson(await response.text(), "publish response");
  const id = stringValue(result["id"]);
  if (!id) throw new Error("Publish response does not contain an update ID");
  return id;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options) return;
  const adminToken = process.env["OTA_ADMIN_TOKEN"];
  if (!adminToken) throw new Error("OTA_ADMIN_TOKEN is required to publish updates");
  const configuredPublicUrl = process.env["PUBLIC_URL"];
  if (!configuredPublicUrl) throw new Error("PUBLIC_URL is required to publish updates through the OTA server");
  let publicOrigin: string;
  try {
    const parsedUrl = new URL(configuredPublicUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("PUBLIC_URL must use HTTP or HTTPS");
    }
    publicOrigin = parsedUrl.origin;
  } catch (error) {
    throw new Error(`Invalid PUBLIC_URL: ${configuredPublicUrl}`, { cause: error });
  }
  const projectStat = await stat(options.projectDir);
  if (!projectStat.isDirectory()) throw new Error(`Expo project directory is not a directory: ${options.projectDir}`);

  await $`cd ${options.projectDir} && npx expo export --platform ${options.platform} --output-dir dist`;
  const expoConfigText = await $`cd ${options.projectDir} && npx expo config --json`.text();
  const expoConfig = parseJson(expoConfigText, "resolved Expo config");
  const outputDirectory = resolve(options.projectDir, "dist");
  const metadataPath = resolve(outputDirectory, "metadata.json");
  const exportMetadata = parseJson(await readFile(metadataPath, "utf8"), "dist/metadata.json");
  const fileMetadata = asRecord(exportMetadata["fileMetadata"], "fileMetadata");
  const platformMetadata = asRecord(fileMetadata[options.platform], `${options.platform} file metadata`);
  const bundleMetadata = platformMetadata["bundle"];
  const bundle =
    typeof bundleMetadata === "string"
      ? { file: bundleMetadata }
      : asRecord(bundleMetadata, "bundle metadata");
  const bundlePathValue = stringValue(bundle["file"]);
  if (!bundlePathValue) throw new Error("Expo metadata does not contain a bundle file");

  const allFiles = await recursivelyListFiles(outputDirectory);
  const indexedFiles = new Map(
    allFiles.map((file) => [relative(outputDirectory, file).replaceAll("\\", "/"), file]),
  );
  const bundlePath = safeExportPath(outputDirectory, bundlePathValue);
  if (!indexedFiles.has(relative(outputDirectory, bundlePath).replaceAll("\\", "/"))) {
    throw new Error(`Expo bundle file is missing: ${bundlePathValue}`);
  }

  const assetPaths = new Set<string>();
  collectPaths(platformMetadata["assets"], assetPaths);
  collectPaths(bundle["assets"], assetPaths);
  const resolvedAssets = new Set<string>();
  for (const assetPath of assetPaths) {
    const path = safeExportPath(outputDirectory, assetPath);
    const indexedPath = relative(outputDirectory, path).replaceAll("\\", "/");
    if (indexedFiles.has(indexedPath) && path !== bundlePath && !path.endsWith(".map")) {
      resolvedAssets.add(path);
    }
  }
  if (resolvedAssets.size === 0) {
    for (const [exportPath, path] of indexedFiles) {
      if (exportPath.startsWith("assets/") && !exportPath.endsWith(".map")) {
        resolvedAssets.add(path);
      }
    }
  }

  const launch = await storeFile(bundlePath, publicOrigin, adminToken);
  const launchAsset = { ...launch.asset };
  delete launchAsset.fileExtension;
  const assets: ExpoAsset[] = [];
  for (const assetPath of resolvedAssets) {
    const stored = await storeFile(assetPath, publicOrigin, adminToken);
    assets.push(stored.asset);
  }

  const appSlug = options.appSlug ?? stringValue(expoConfig["slug"]);
  if (!appSlug) throw new Error("Pass --app or set a slug in the Expo config");
  const expoExtra = expoConfig["extra"];
  const eas = typeof expoExtra === "object" && expoExtra !== null
    ? (expoExtra as JsonRecord)["eas"]
    : undefined;
  const easProjectId =
    typeof eas === "object" && eas !== null
      ? stringValue((eas as JsonRecord)["projectId"])
      : undefined;
  const projectId = options.projectId ?? easProjectId;
  const runtimeVersion =
    options.runtimeVersion ?? stringValue(expoConfig["runtimeVersion"]);
  if (!runtimeVersion) {
    throw new Error(
      "Pass --runtime-version; Expo runtime version policies must be resolved to a concrete version before publishing",
    );
  }

  const updateId = await publishUpdate(publicOrigin, adminToken, {
    appSlug,
    projectId,
    runtimeVersion,
    platform: options.platform,
    channel: options.channel,
    launchAsset,
    assets,
    extra: {
      expoClient: expoConfig,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  });

  console.log(
    `Published ${appSlug} ${options.platform} runtime ${runtimeVersion} to ${options.channel} (${assets.length} assets, update ${updateId}).`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`OTA publish failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error) {
      if ("code" in error && typeof error.code === "string") {
        console.error(`Code: ${error.code}`);
      }
      if ("why" in error && typeof error.why === "string") {
        console.error(`Why: ${error.why}`);
      }
      if ("fix" in error && typeof error.fix === "string") {
        console.error(`Fix: ${error.fix}`);
      }
    }
    process.exitCode = 1;
  }
}
