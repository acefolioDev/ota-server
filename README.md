# Self-hosted Expo OTA updates

This service runs on Bun with Elpod/Elysia, PostgreSQL through Prisma 8, and a Preact/Vite admin dashboard.

For Expo app configuration, publishing, and testing, see the [Expo client integration guide](./docs/README.md). For bare React Native CLI native setup, see the [React Native CLI OTA guide](./docs/react-native-cli-ota.md).
For Railway deployment, PostgreSQL migrations, persistent asset storage, and remote publishing, see the [Railway deployment guide](./docs/railway-deployment.md).
The sample bare React Native notes app is in [examples/miki](./examples/miki/README.md).

## Configure and run

1. Install Bun 1.4+ and PostgreSQL 15+.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL`, a long random `OTA_ADMIN_TOKEN`, and the public HTTPS origin in `PUBLIC_URL`.
3. Generate the current Prisma artifacts. For a new local database, apply the contract directly:

   ```sh
   bun install
   bun run contract:emit
   bun run db:init
   ```

   Migration-managed deployments should apply the committed baseline and schema change with `bun run db:migrate`. Never initialize an existing database; first verify its Prisma marker/contract and review the migration plan.
4. Build and start the API and dashboard:

   ```sh
   bun run build
   bun run start
   ```

   The dashboard is at `/admin/`; the Expo Updates manifest endpoint is `/api/manifest`.
   During development, run `bun run dev` and `bun run dashboard:dev` in separate terminals.

`OTA_STORAGE_DIR` defaults to `storage` and must be a persistent, shared directory for the publisher and every API instance. The backend serves immutable files from its `assets/` subdirectory. A production deployment with multiple instances should mount shared storage or use a CDN/object store that serves the same content-addressed URLs.

## Publish an update

Run the publisher from this repository and point it at an Expo project. The Expo project must have the Expo CLI available through `npx expo`, and its runtime version must exactly match a native build:

```sh
bun run publish:update -- \
  --project-dir ../my-expo-app \
  --platform ios \
  --runtime-version 1.2.0 \
  --channel production
```

`--app` defaults to the resolved Expo config `slug`; `--project-id` defaults to `extra.eas.projectId`; `--runtime-version` defaults to a concrete string `runtimeVersion`. Runtime-version policies must be resolved and passed explicitly. Run the command separately for iOS and Android. The script runs `npx expo export --platform <platform> --output-dir dist`, reads the platform export metadata, hashes bundle/assets with base64url SHA-256, stores immutable files, and publishes the manifest record.

Set `PUBLIC_URL` to the running server's reachable origin and set `OTA_ADMIN_TOKEN` for authenticated asset uploads. The publisher uploads hashed assets to the server's `/api/admin/assets/:filename` endpoint before writing the release to PostgreSQL. `OTA_STORAGE_DIR` is used by the API server for persistent asset storage; retain stored files while any installed client may still request a release.

## Configure an Expo client

Point `updates.url` at this server's `/api/manifest` endpoint. Set the app's runtime version as usual, and use the standard Expo request headers `expo-protocol-version: 1`, `expo-platform`, and `expo-runtime-version`. For multiple apps, send `expo-project-id` matching the `--project-id` used when publishing, or add `?app=<slug>` to the URL. A single-app installation can omit the app identifier.

The server reads `expo-channel-name` to select a release channel (default `production`). Staged rollouts use a stable client bucket derived from `expo-installation-id` or `expo-device-id`; when neither is sent, the first `x-forwarded-for` address (or `x-real-ip`) is used. Configure trusted proxy headers and ensure clients behind a shared proxy use a stable installation/device ID for meaningful per-device percentages.

The server returns JSON manifests and does not currently sign manifests. Clients configured to require Expo code signing receive `406` until server-side signing is configured.

## Admin API

The dashboard uses `OTA_ADMIN_TOKEN` as a bearer token. Management requests are disabled with `503` until this secret is configured.

- `GET /api/admin/apps` — applications and releases
- `PATCH /api/admin/updates/:id/rollout` — body: `{"rollout": 0..100}`
- `POST /api/admin/updates/:id/rollback` — deactivate a release; the next eligible active release is served

The dashboard is served from `/admin/` after `bun run build`. In development, Vite proxies `/api` to the Bun server.
