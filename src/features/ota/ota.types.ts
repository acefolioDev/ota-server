export interface ExpoAsset {
  hash?: string;
  key: string;
  contentType: string;
  fileExtension?: string;
  url: string;
}

export interface ExpoManifest {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: ExpoAsset;
  assets: ExpoAsset[];
  metadata: Record<string, string>;
  extra: Record<string, unknown>;
}

export interface PublishUpdateInput {
  appSlug: string;
  projectId?: string;
  runtimeVersion: string;
  platform: "ios" | "android";
  channel: string;
  launchAsset: ExpoAsset;
  assets: ExpoAsset[];
  extra: Record<string, unknown>;
}

export interface ExpoRequestHeaders {
  readonly "expo-protocol-version"?: string;
  readonly "expo-platform"?: string;
  readonly "expo-runtime-version"?: string;
  readonly accept?: string;
  readonly "expo-expect-signature"?: string;
  readonly "expo-project-id"?: string;
  readonly "expo-channel-name"?: string;
  readonly "expo-installation-id"?: string;
  readonly "expo-device-id"?: string;
  readonly "x-forwarded-for"?: string;
  readonly "x-real-ip"?: string;
}

export type ManifestResult =
  | { ok: true; manifest: ExpoManifest }
  | { ok: false; status: 400 | 406; error: string };
