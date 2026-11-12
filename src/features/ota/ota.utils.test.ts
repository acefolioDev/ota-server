import { expect, test } from "bun:test";
import {
  isExpoAsset,
  isInRollout,
  parseStoredJson,
  releaseWasSupersededByRollback,
  selectRollbackTarget,
} from "./ota.utils";

test("rollout percentages include every client at 100 and none at 0", () => {
  expect(isInRollout("app", "device", 100)).toBe(true);
  expect(isInRollout("app", "", 0)).toBe(false);
  expect(isInRollout("app", "device", 0)).toBe(false);
});

test("rollout assignment is stable for the same app and client", () => {
  const assignment = isInRollout("app", "device", 50);
  expect(isInRollout("app", "device", 50)).toBe(assignment);
});

test("stored JSON parse failures identify the corrupt field", () => {
  expect(() => parseStoredJson("{", "assets")).toThrow("OTA assets");
});

test("rollback selects the newest existing release that was not rolled back", () => {
  const older = release("older", true, "2026-11-01T00:00:00.000Z");
  const rolledBack = release("rolled-back", false, "2026-11-02T00:00:00.000Z");
  const current = release("current", true, "2026-11-03T00:00:00.000Z");

  expect(selectRollbackTarget(current, [current, rolledBack, older])?.id).toBe("older");
});

test("rollback leaves a newer active release in place", () => {
  const current = release("current", true, "2026-11-01T00:00:00.000Z");
  const newer = release("newer", true, "2026-11-03T00:00:00.000Z");

  expect(selectRollbackTarget(current, [current, newer])).toBeNull();
});

test("a restored release needs a newer manifest when a rollback is newer than it", () => {
  const restored = release("restored", true, "2026-11-01T00:00:00.000Z");
  const rolledBack = release("rolled-back", false, "2026-11-03T00:00:00.000Z");

  expect(releaseWasSupersededByRollback(restored, [rolledBack])).toBe(true);
  expect(releaseWasSupersededByRollback(rolledBack, [restored])).toBe(false);
});

test("rollback has no target when every earlier release was rolled back", () => {
  const current = release("current", true, "2026-11-03T00:00:00.000Z");
  const rolledBack = release("rolled-back", false, "2026-11-02T00:00:00.000Z");

  expect(selectRollbackTarget(current, [current, rolledBack])).toBeNull();
});

function release(id: string, isActive: boolean, createdAt: string) {
  return { id, isActive, createdAt: new Date(createdAt) };
}

test("Expo assets require the protocol's key, content type, and URL", () => {
  expect(isExpoAsset({ key: "hash", contentType: "image/png", url: "https://cdn/image.png" })).toBe(true);
  expect(isExpoAsset({ key: "hash", contentType: "image/png" })).toBe(false);
});
