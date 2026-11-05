import { expect, test } from "bun:test";
import { isExpoAsset, isInRollout, parseStoredJson } from "./ota.utils";

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

test("Expo assets require the protocol's key, content type, and URL", () => {
  expect(isExpoAsset({ key: "hash", contentType: "image/png", url: "https://cdn/image.png" })).toBe(true);
  expect(isExpoAsset({ key: "hash", contentType: "image/png" })).toBe(false);
});
