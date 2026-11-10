# Set up this OTA server for a new or existing app

This guide takes one app from an empty server to a JavaScript update installed on a device. It covers a new Expo app, an existing Expo app, and a React Native CLI app that already owns its `ios/` and `android/` projects.

The phone never talks to the database. `expo-updates` asks this server for a manifest, downloads the bundle and assets named in that manifest, and reloads the app. Publishing is a separate command that runs on your machine and uploads those files through the admin API.

The sample app in [examples/miki](../examples/miki/README.md) is a React Native CLI app already wired this way. Use it as a reference, not as a template you copy into another product.

## What an update can change

An update can replace JavaScript and assets that are compatible with the native binary already installed on the device.

An update cannot add a native module, change permissions, change the app icon, or change anything compiled into the iOS or Android binary. Those changes need a new store or enterprise build and, when they are incompatible with the previous binary, a new runtime version.

Debug builds that load JavaScript from Metro do not use this server. Expo Go does not use this server. Test with a release or internal-distribution binary that has `expo-updates` enabled.

## Values that must match

Pick these once. The native binary, the publish command, and the manifest request all use the same four values.

| Value | Example | Where it lives |
|---|---|---|
| Server origin | `https://ota.example.com` | `PUBLIC_URL` on the server. No path and no trailing slash. |
| App slug | `my-app` | Expo `slug`, the `?app=` query on the manifest URL, and `--app` when publishing. |
| Runtime version | `1.0.0` | A concrete string in the native binary and `--runtime-version`. |
| Channel | `production` | Native request header `expo-channel-name` and `--channel`. |

The manifest URL the binary stores is:

```text
https://ota.example.com/api/manifest?app=my-app
```

Replace the host and slug with yours. iOS and Android are published separately, so a release for one platform is invisible to the other. A different slug, runtime version, or channel is also invisible to that binary.

Do not put `OTA_ADMIN_TOKEN` or `DATABASE_URL` in the app. The token is only for the publisher and the admin dashboard.

This server returns JSON manifests and does not sign them. Leave Expo code signing off in the app. A client that requires a signature receives HTTP `406`.

## 1. Run the server

You need Bun 1.4 or newer and PostgreSQL 15 or newer.

```sh
cp .env.example .env
```

Set these in `.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the API process. |
| `OTA_ADMIN_TOKEN` | Long random secret. Generate it with `openssl rand -hex 32`. |
| `PUBLIC_URL` | Origin that phones can reach, for example `https://ota.example.com`. Asset URLs are built from this value. |
| `OTA_STORAGE_DIR` | Directory for uploaded bundles. Defaults to `storage`. It must survive deploys and be visible to every API instance. |

For a new local database:

```sh
bun install
bun run contract:emit
bun run db:init
bun run build
bun run start
```

During development, run `bun run dev` and `bun run dashboard:dev` in two terminals. The dashboard is at `/admin/`. The manifest route is `/api/manifest`.

A migration-managed deployment, including Railway, should apply the committed migrations with `bun run db:migrate` instead of `db:init`. Do not run `db:init` against a database that already has data. Railway volume, domain, and pre-deploy steps are in [Deploy the OTA server on Railway](./railway-deployment.md).

Check that the process is up:

```sh
curl --fail --show-error --include 'https://ota.example.com/health/live'
```

Expect HTTP `200` and `{"status":"ok"}`. Open `https://ota.example.com/admin/` and sign in with `OTA_ADMIN_TOKEN`. Before the first publish, a manifest request returns `406` because no release exists yet.

`PUBLIC_URL` must be the same origin the phone will use. `localhost` on a physical phone is the phone, not your computer. For a local server, use a reachable host and set `PUBLIC_URL` to that host before publishing.

## 2. Prepare the app

Install `expo-updates` in the app, point it at the manifest URL, and ship a new native binary. JavaScript in the app does not choose the server URL. The native build embeds it, and `expo-updates` sends the request.

### Expo app, new or existing

From the app directory:

```sh
npx expo install expo-updates
```

Set the slug, a concrete runtime version, and the update URL in `app.json` or `app.config.js`:

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "https://ota.example.com/api/manifest?app=my-app",
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0,
      "requestHeaders": {
        "expo-channel-name": "production"
      }
    }
  }
}
```

If the project uses prebuild or EAS and does not keep custom native edits, rebuild so this config is embedded. Do not leave an `updates.url` that still points at `u.expo.dev`. That host is EAS Update, not this server.

`runtimeVersion` must be a concrete string when you publish. A policy such as `{"policy": "appVersion"}` has to be resolved, and the resulting string passed to the publisher with `--runtime-version`.

Build and install a native binary after this change. An EAS preview build is enough for a test:

```sh
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Confirm the installed build contains your URL, runtime version, and channel. Changing `app.json` after the binary is built does nothing until you rebuild.

### React Native CLI app, new or existing

React Native CLI has no update client of its own. This path installs Expo modules and `expo-updates` into the existing native projects, then rebuilds. It does not switch the app to Expo Go or EAS Update.

Commit or back up the native projects first. `npx install-expo-modules` rewrites the Podfile, Gradle files, Metro and Babel config, and the iOS and Android startup classes. A stock CLI app usually accepts that. An app with a custom app delegate, product flavors, a monorepo Metro config, or an older React Native version often needs the manual Expo install for that React Native version. Fix `pod install`, the Android release build, and `npx expo export` before publishing. The server cannot correct a failed native install.

From the app directory:

```sh
npx install-expo-modules@latest
npx expo install expo-updates
npx pod-install
```

Add an `expo` block to `app.json`. A checked-in native project does not apply that block by itself. You still edit `Expo.plist` and `AndroidManifest.xml`. The block is what `npx expo export` and the publisher read.

```json
{
  "name": "My RN App",
  "displayName": "My RN App",
  "expo": {
    "name": "My RN App",
    "slug": "my-app",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "https://ota.example.com/api/manifest?app=my-app",
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0,
      "requestHeaders": {
        "expo-channel-name": "production"
      }
    },
    "plugins": ["expo-updates"]
  }
}
```

On iOS, merge these keys into the app target's `Expo.plist` and make sure that file is in the target's resources:

```xml
<key>EXUpdatesEnabled</key>
<true/>
<key>EXUpdatesURL</key>
<string>https://ota.example.com/api/manifest?app=my-app</string>
<key>EXUpdatesRuntimeVersion</key>
<string>1.0.0</string>
<key>EXUpdatesCheckOnLaunch</key>
<string>ALWAYS</string>
<key>EXUpdatesLaunchWaitMs</key>
<integer>0</integer>
<key>EXUpdatesRequestHeaders</key>
<dict>
  <key>expo-channel-name</key>
  <string>production</string>
</dict>
```

On Android, add the runtime version to `android/app/src/main/res/values/strings.xml`:

```xml
<string name="expo_runtime_version">1.0.0</string>
```

Inside `<application>` in `android/app/src/main/AndroidManifest.xml`, add one of each key. Do not duplicate an existing `meta-data` name:

```xml
<meta-data
    android:name="expo.modules.updates.ENABLED"
    android:value="true" />
<meta-data
    android:name="expo.modules.updates.EXPO_UPDATE_URL"
    android:value="https://ota.example.com/api/manifest?app=my-app" />
<meta-data
    android:name="expo.modules.updates.EXPO_RUNTIME_VERSION"
    android:value="@string/expo_runtime_version" />
<meta-data
    android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH"
    android:value="ALWAYS" />
<meta-data
    android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS"
    android:value="0" />
<meta-data
    android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY"
    android:value="{&quot;expo-channel-name&quot;:&quot;production&quot;}" />
```

The Android metadata names can change between Expo SDK versions. Compare them with the [bare `expo-updates` install guide](https://docs.expo.dev/bare/installing-updates/) for the version you installed. Production needs HTTPS.

Confirm the publisher can export the app before you build a release:

```sh
npx expo config --json
npx expo export --platform ios --output-dir dist-ios
npx expo export --platform android --output-dir dist-android
```

Then build and install with the app's normal release workflow, for example `npx react-native run-ios --mode Release` or `npx react-native run-android --mode release`. A debug install that stays connected to Metro is not a test of this setup.

If the app already uses another update client, such as CodePush or Hot Updater, remove that client before adding `expo-updates`. The two native loaders conflict.

## 3. Publish a release

Run the publisher from this repository, not from the app. It needs `PUBLIC_URL` and `OTA_ADMIN_TOKEN` in the environment. It does not need `DATABASE_URL`. The script runs `npx expo export` in the app, uploads each file to the server, and records the release.

From a machine that can reach the server:

```sh
export PUBLIC_URL="https://ota.example.com"
export OTA_ADMIN_TOKEN="the-server-token"
```

On Railway, `railway run` injects those two variables from the linked service. The app directory must be available on the machine that runs the command.

Publish iOS:

```sh
bun run publish:update -- \
  --project-dir ../my-app \
  --app my-app \
  --platform ios \
  --runtime-version 1.0.0 \
  --channel production
```

Publish Android with the same command and `--platform android`.

`--app` defaults to the Expo `slug`. `--runtime-version` defaults to a string `runtimeVersion` in the Expo config. Pass both explicitly so a publish cannot drift from the binary. A successful run prints the app, platform, runtime, channel, asset count, and update id.

If the release record fails after the files have uploaded, open `/admin/` and use **Retry publish** under **Unpublished updates**. The retry reuses the uploaded files.

Install the native binary once before the update you want to observe. Then change JavaScript, publish again with the same slug, runtime version, and channel, and let the already-installed app download that second release. A bundle that was inside the binary you just installed does not prove the phone can reach the server.

## 4. Check the release before opening the app

Request the manifest with the same slug, platform, runtime version, and channel that are in the binary:

```sh
curl --fail-with-body --show-error --include \
  --get 'https://ota.example.com/api/manifest' \
  --data-urlencode 'app=my-app' \
  --header 'expo-protocol-version: 1' \
  --header 'expo-platform: ios' \
  --header 'expo-runtime-version: 1.0.0' \
  --header 'expo-channel-name: production' \
  --header 'accept: application/expo+json, application/json, multipart/mixed'
```

Expect HTTP `200` and JSON with `id`, `runtimeVersion`, `launchAsset`, and `assets`. Copy `launchAsset.url` from that body and request it. Expect HTTP `200`. Repeat with `expo-platform: android` after publishing Android.

The phone's native module performs this same request. There is no `fetch` to the OTA server in application JavaScript. `Updates.checkForUpdateAsync()` asks `expo-updates` to load the manifest URL stored in the binary. `Updates.fetchUpdateAsync()` downloads `launchAsset` and `assets`. `Updates.reloadAsync()` restarts onto the downloaded bundle and does not call the server.

## 5. Apply the update on a device

1. Install the release binary and open it once. Confirm the original UI.
2. Change a visible JavaScript string. Do not change native code or the runtime version.
3. Publish that platform again.
4. Force-close and reopen the app. With check-on-launch set to `ALWAYS`, the client checks during startup. The downloaded update can apply on that launch or the next one, depending on `expo-updates`.
5. Confirm the changed UI. Local data should still be there.

A manual check is optional. Launch checks work without it. This is the call the sample app uses:

```tsx
import * as Updates from "expo-updates";

export async function checkForOtaUpdate(): Promise<void> {
  if (!Updates.isEnabled) {
    throw new Error("This build does not have expo-updates enabled");
  }

  const update = await Updates.checkForUpdateAsync();
  if (!update.isAvailable) return;

  const fetched = await Updates.fetchUpdateAsync();
  if (fetched.isNew) {
    await Updates.reloadAsync();
  }
}
```

`Updates.isEnabled` is often false in a debug build. Trust the result from the release binary. The Miki versions of this flow are `examples/miki/src/hooks/useOtaUpdates.ts` and the launch call in `examples/miki/src/AppRoot.tsx`.

## 6. Channels, rollout, and rollback

Use a non-production channel on an internal binary before you publish to `production`. The channel is fixed in the native binary, so an internal build that should track `staging` must be built with that channel. Publishing with `--channel staging` does not reach a binary whose header says `production`.

Open `https://ota.example.com/admin/` and enter `OTA_ADMIN_TOKEN`. The dashboard lists apps and releases. **Save rollout** sets the percentage from 0 to 100. **Roll back** deactivates a release. The server then serves the newest remaining active release for the same app, platform, runtime version, and channel, or `406` when none remains.

A rollout uses `expo-installation-id` or `expo-device-id` when the request includes one. Otherwise it uses the first `x-forwarded-for` address or `x-real-ip`. The standard `expo-updates` client does not send an installation id by itself, so phones behind one NAT can share a bucket. A release at 0% is never selected. A release at 100% is eligible for every client. Clients outside a newer partial rollout can still receive an older active release.

The same actions exist on the admin API:

- `GET /api/admin/apps`
- `GET /api/admin/pending-updates`
- `POST /api/admin/pending-updates/:id/retry`
- `PATCH /api/admin/updates/:id/rollout` with `{"rollout": 0..100}`
- `POST /api/admin/updates/:id/rollback`

Send `Authorization: Bearer <OTA_ADMIN_TOKEN>`. A missing token returns `401`. A server with no token configured returns `503`.

## 7. Ship the next native build

Keep the runtime version when the new binary can still run the JavaScript you publish for the previous binary.

Change the runtime version when native code or native dependencies change incompatibly. Publish subsequent updates with the new runtime version, and leave the old releases in place for users who have not installed the new binary. Rebuild and redistribute the app after any change to the manifest URL, channel, or runtime version. Those values are compiled into the binary.

Keep every published asset for as long as an installed release might request it. Deleting files from `OTA_STORAGE_DIR/assets` breaks clients that still point at those URLs.

## Troubleshooting

| What you see | What to check |
|---|---|
| Manifest `400` | Send protocol version `1`, platform `ios` or `android`, and a non-empty runtime version. |
| Manifest `406` | An active release must match the slug, platform, runtime version, and channel. Code signing must be off. |
| Manifest `500` | Database connectivity and migrations. Read the API logs. |
| Manifest `200`, asset download fails | `PUBLIC_URL` must be the public HTTPS origin. The file must still be in `OTA_STORAGE_DIR/assets`. |
| App never checks | Rebuild after native config changes. Confirm `EXUpdatesEnabled`, the URL, runtime version, channel, and a release build. |
| `Updates.isEnabled` is false | The running build is a debug build or the native module is not in this binary. |
| `expo export` fails | Expo modules and an Expo `slug` must be installed. Fix the export in the app directory before publishing. |
| App says it is up to date | A newer active release must exist for this exact app, platform, runtime version, and channel, and the device must reach the server. |
| Native change did not appear | Expected. Ship a new binary. |
| Admin API `503` | Set `OTA_ADMIN_TOKEN` and restart the server. |

## Related docs

- [Expo client details, rollout behavior, and admin API checks](./README.md)
- [React Native CLI native file edits](./react-native-cli-ota.md)
- [Railway deployment](./railway-deployment.md)
- [End-to-end smoke test with the Miki sample](./testing-ota-updates.md)
- [Expo modules in an existing React Native project](https://docs.expo.dev/bare/installing-expo-modules/)
- [Install `expo-updates` in a bare project](https://docs.expo.dev/bare/installing-updates/)
- [Expo Updates protocol v1](https://docs.expo.dev/technical-specs/expo-updates-1/)
