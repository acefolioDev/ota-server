# Deploy the OTA server on Railway

This repository is configured to build with its root `Dockerfile`. The API, admin dashboard, and Expo asset endpoints run in one Railway service; PostgreSQL runs as a separate Railway service. A Railway Volume keeps uploaded update assets available across deploys.

## 1. Create a Railway project and database

1. Push this repository to a Git provider supported by Railway.
2. In Railway, create a project and add a **PostgreSQL** service.
3. Add a service from this repository and connect it to the same Railway project/environment.
4. Confirm Railway detects the root `Dockerfile` and uses Docker to build the service.
5. In the OTA service's variables, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (replace `Postgres` if your database service has a different name) |
   | `OTA_ADMIN_TOKEN` | A long, randomly generated secret |
   | `OTA_STORAGE_DIR` | `/app/storage` |
   | `PUBLIC_URL` | Your public HTTPS origin, for example `https://my-ota.up.railway.app` |

   Generate the admin token outside this repository (for example, `openssl rand -hex 32`) and add it using Railway's variable UI. Never commit it, put it in your React Native app, or expose it in build logs.

   `DATABASE_URL` must be the **private** PostgreSQL service URL reference above, not `DATABASE_PUBLIC_URL`. The API and database should communicate over Railway's private network.

   If you have not created a public domain yet, set it up in the next step, then enter that exact HTTPS origin in `PUBLIC_URL`. Do not include `/api` or a trailing path.

## 2. Add persistent asset storage and a public domain

1. Attach a Railway **Volume** to the OTA service and set its mount path to `/app/storage`.
2. Keep the service at **one replica** while using this volume. Railway volumes are attached to a service instance and are not shared across replicas. The app expects the mounted directory to contain an `assets/` subdirectory; it creates this directory on the first upload.
3. Generate a Railway public domain in the OTA service's **Settings → Networking** (or attach your own HTTPS domain).
4. Set `PUBLIC_URL` to that domain, e.g. `https://my-ota.up.railway.app`, and redeploy/restart the service after changing variables.

The admin asset upload endpoint writes publisher uploads and failed publish retry records into the service's mounted volume. This allows you to run the Expo export on your workstation while keeping assets and pending release metadata on Railway's persistent storage. Do not remove the volume or its files while clients may still need old release assets.

## 3. Configure Railway deploy settings

In the OTA service's **Settings → Deploy**:

- **Healthcheck Path:** `/health/live`
- **Pre-deploy Command:** `bun run db:migrate`
- **Pre-deploy Timeout:** allow enough time for your database migrations (300 seconds is a reasonable initial value).

The pre-deploy command applies the committed Prisma migration packages before Railway activates the new API deployment. It does not need the asset volume. If the migration command fails, Railway should leave the new deploy inactive; inspect the deployment logs and database migration status before retrying.

This repository includes a baseline and the OTA schema migration. For a newly provisioned Railway PostgreSQL database, the migration process applies the schema from those committed migration packages. If pointing at an existing database, **do not run the baseline against it blindly**: check its schema and Prisma migration marker first, then choose a migration/adoption path that matches the actual database.

Railway's config-as-code `railway.toml`/`railway.json` format is being retired, so this guide uses the Railway service settings UI rather than pinning deployment behavior to that legacy format.

## 4. Deploy and verify the service

Trigger a deploy from Railway or push a commit to the connected branch. Inspect both the build and pre-deploy logs. The application starts with `bun run start` from the Docker image and listens on Railway's injected `PORT`.

Once the deployment is active, test the liveness endpoint:

```sh
curl --fail --show-error --include \
  'https://my-ota.up.railway.app/health/live'
```

Expect HTTP `200` and `{"status":"ok"}`. Open `https://my-ota.up.railway.app/admin/` and authenticate with the server-side `OTA_ADMIN_TOKEN`. The unauthenticated admin API should return `401` (or `503` if the token is not configured):

```sh
curl --include 'https://my-ota.up.railway.app/api/admin/apps'
```

The manifest endpoint requires a matching app and published release, so a `406` before the first publish is expected. Both dashboard and manifest API use the same public Railway domain.

## 5. Publish from your workstation to Railway

Install Bun locally and have the Expo app project available on your machine. Link the OTA repository directory to the correct Railway project and environment:

```sh
railway link
```

Run the publisher through `railway run`. Railway injects the linked service's `PUBLIC_URL` and `OTA_ADMIN_TOKEN` into the local publish process. The script runs `npx expo export` on your workstation, uploads each content-addressed asset, and submits release metadata through the protected admin API. The Railway service writes the release to PostgreSQL using its private database connection; the publisher does not need `DATABASE_URL`:

```sh
railway run bun run publish:update -- \
  --project-dir ../my-expo-app \
  --platform ios \
  --runtime-version 1.0.0 \
  --channel production
```

Repeat for Android:

```sh
railway run bun run publish:update -- \
  --project-dir ../my-expo-app \
  --platform android \
  --runtime-version 1.0.0 \
  --channel production
```

Replace the project path, concrete runtime version, app slug (if needed), and channel with values from the native app build. For a different Expo config slug, pass `--app <slug>`. The publisher defaults the app slug from Expo config and reads `extra.eas.projectId` when configured.

Confirm the publisher environment targets the Railway service/environment with its production `PUBLIC_URL` and `OTA_ADMIN_TOKEN`. `OTA_STORAGE_DIR` is needed by the running Railway API; local publish doesn't write into that local path because it uploads through the server.

If a release-record request fails after the asset uploads, the server keeps its release metadata in the persistent volume. Open `/admin/`, connect with `OTA_ADMIN_TOKEN`, and use **Retry publish** under **Unpublished updates**. The retry reuses the already-uploaded assets. A failed publish from before this retry feature was deployed is not recoverable in the dashboard; rerun the publisher once after deploying the feature to create a retryable record.

## 6. Verify a published release and asset

Request a manifest using the same app slug, platform, runtime version, and channel used to publish:

```sh
curl --fail-with-body --show-error --include \
  --get 'https://my-ota.up.railway.app/api/manifest' \
  --data-urlencode 'app=my-app' \
  --header 'expo-protocol-version: 1' \
  --header 'expo-platform: ios' \
  --header 'expo-runtime-version: 1.0.0' \
  --header 'expo-channel-name: production' \
  --header 'accept: application/expo+json, application/json, multipart/mixed'
```

Expect HTTP `200`, protocol headers, and a JSON manifest with an `id`, `runtimeVersion`, `launchAsset.url`, and `assets`. Request the exact `launchAsset.url` from that response; it should return HTTP `200` with the bundle content. A `406` normally means the app, platform, runtime, or channel does not match an active release.

Then install a native build configured for that Railway URL/channel/runtime and test fetching the update from the app. For React Native client configuration, see [the client integration and testing guide](./README.md).

## Operations and limitations

- **Storage:** Railway's local volume is attached to one service instance; run one replica. For horizontally scaled APIs, move asset serving to a shared object store/CDN and update the storage implementation to match.
- **Backups:** Configure PostgreSQL backups and a separate backup/retention plan for the asset volume. A database backup without matching bundles/assets cannot serve old manifests.
- **Deploys with a volume:** Railway may have a short restart gap during deploys because the volume cannot be mounted by concurrent deployments.
- **Secrets:** Only the dashboard, asset publisher, and service operators need `OTA_ADMIN_TOKEN`. Expo clients do not.
- **Code signing:** The service currently does not sign manifests. Do not enable Expo Updates code-signing verification in the client until the backend supports it.
- **Update compatibility:** OTA updates cannot deliver native code changes. Publish only for a runtime version supported by the installed native binary.

## Troubleshooting

| Symptom | Check |
|---|---|
| Docker build fails | Confirm Railway is building from the repository root and that `Dockerfile`, `bun.lock`, and `package.json` are included. |
| Pre-deploy migration fails | Read the Railway pre-deploy logs, confirm the private `DATABASE_URL`, and inspect Prisma migration status. Do not initialize/reset a populated database. |
| Railway health check fails | Confirm the server starts, uses the injected `PORT`, and `/health/live` returns `200`. |
| Manifest returns `406` | Check the release is active and app slug, platform, channel, and runtime version match exactly. |
| Admin API request returns `401` | Confirm `railway run` is linked to the correct environment and receives the same `OTA_ADMIN_TOKEN` as the running server. |
| Admin API request returns `404`/`5xx` | Check that the latest server version is deployed, and verify public networking, `PUBLIC_URL`, and service logs. |
| Published manifest references unavailable files | Confirm the Railway volume is mounted at `/app/storage`, `OTA_STORAGE_DIR=/app/storage`, and the service has not lost its volume. |
| Deploy succeeds but old bundles stop loading | Verify the storage volume persists and retain all assets referenced by releases that clients could still request. |

## Railway references

- [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)
- [Railway volumes](https://docs.railway.com/volumes)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)
- [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)
- [Railway variables](https://docs.railway.com/variables/reference)
