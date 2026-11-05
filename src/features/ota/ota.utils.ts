import { createHash } from "node:crypto";
import type { ExpoAsset } from "./ota.types";

export function isInRollout(appId: string, clientId: string, rollout: number): boolean {
  if (rollout >= 100) return true;
  if (rollout <= 0 || !clientId) return false;

  const digest = createHash("sha256")
    .update(`${appId}:${clientId}`)
    .digest();
  return digest.readUInt32BE(0) % 100 < rollout;
}

export function parseStoredJson<T>(value: string, field: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Stored OTA ${field} is not valid JSON`, { cause: error });
  }
}

export function isExpoAsset(value: unknown): value is ExpoAsset {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset["key"] === "string" &&
    asset["key"].length > 0 &&
    typeof asset["contentType"] === "string" &&
    asset["contentType"].length > 0 &&
    typeof asset["url"] === "string" &&
    asset["url"].length > 0 &&
    (asset["hash"] === undefined ||
      (typeof asset["hash"] === "string" && asset["hash"].length > 0)) &&
    (asset["fileExtension"] === undefined ||
      (typeof asset["fileExtension"] === "string" && asset["fileExtension"].length > 0))
  );
}
