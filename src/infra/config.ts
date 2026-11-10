import { defineConfig, env, token, type ConfigSource } from "@elpod/core";

const definition = {
  port: env.number("PORT", { default: 3000, min: 1, max: 65_535 }),
  databaseUrl: env.secret("DATABASE_URL", { required: true }),
  adminToken: env.secret("OTA_ADMIN_TOKEN", { required: true }),
  storageDir: env.string("OTA_STORAGE_DIR", { default: "storage" }),
};

export type AppConfig = {
  port: number;
  databaseUrl: string;
  adminToken: string;
  storageDir: string;
};

export const APP_CONFIG = token<AppConfig>("APP_CONFIG");

export function loadConfig(source?: ConfigSource): AppConfig {
  return defineConfig(definition, source);
}
