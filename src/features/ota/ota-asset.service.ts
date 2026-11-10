import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { APP_CONFIG, type AppConfig } from "@infra/config";
import { isNodeError } from "./ota.utils";

const MAX_ASSET_UPLOAD_BYTES = 100 * 1024 * 1024;

export type StoredAsset = "stored" | "too-large" | "bad-filename";

export class OtaAssetService {
  static readonly needs = [APP_CONFIG] as const;

  constructor(private readonly config: AppConfig) {}

  async storeAsset(filename: string, request: Request): Promise<StoredAsset> {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_ASSET_UPLOAD_BYTES) {
      return "too-large";
    }

    const contents = await readRequestBody(request, MAX_ASSET_UPLOAD_BYTES);
    if (!contents) return "too-large";

    const match = /^([A-Za-z0-9_-]{43})\.[a-z0-9]{1,10}$/.exec(filename);
    if (!match) return "bad-filename";

    const hash = createHash("sha256").update(contents).digest("base64url");
    if (hash !== match[1]) return "bad-filename";

    const directory = resolve(this.storageRoot(), "assets");
    const destination = resolve(directory, filename);
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(destination, contents, { flag: "wx" });
      return "stored";
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) throw error;
      const existing = await readFile(destination);
      return createHash("sha256").update(existing).digest("base64url") === hash
        ? "stored"
        : "bad-filename";
    }
  }

  async serveAsset(filename: string): Promise<Response> {
    if (!/^[A-Za-z0-9_-]{43}\.[a-z0-9]{1,10}$/.test(filename)) {
      return new Response("Not found", { status: 404 });
    }

    const file = Bun.file(resolve(this.storageRoot(), "assets", filename));
    if (!(await file.exists())) return new Response("Not found", { status: 404 });

    return new Response(file, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": contentTypeFor(filename),
        "x-content-type-options": "nosniff",
      },
    });
  }

  private storageRoot(): string {
    return resolve(this.config.storageDir);
  }
}

async function readRequestBody(request: Request, maxBytes: number): Promise<Uint8Array | null> {
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
