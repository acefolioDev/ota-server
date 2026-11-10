export interface Release {
  id: string;
  appId: string;
  runtimeVersion: string;
  platform: string;
  channel: string;
  rollout: number;
  isActive: boolean;
  createdAt: string;
}

export interface AppRecord {
  id: string;
  slug: string;
  projectId: string | null;
  createdAt: string;
  updates: Release[];
}

export interface PendingPublish {
  id: string;
  createdAt: string;
  appSlug: string;
  runtimeVersion: string;
  platform: string;
  channel: string;
}

export interface ApiError {
  error?: string;
}
