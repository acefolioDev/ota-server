# OTA updates in a bare React Native CLI app

This guide connects a React Native CLI app (one that owns its `ios/` and `android/` projects) to this self-hosted OTA service. It uses Expo's `expo-updates` native client and Expo Updates v1 protocol; it does not use EAS Update as the update server.

> **Important:** React Native CLI does not have OTA updates built in. You must add Expo modules and `expo-updates`, configure both native projects, and ship a new native binary before this server can deliver JavaScript updates. OTA cannot change native code, native dependencies, permissions, or other parts of the installed binary.

## What you need

- A React Native CLI app with working iOS and Android native builds.
- A deployed OTA server with its database migration applied, public HTTPS domain, and persistent asset storage. For this deployment, the server URL is `https://ota-server.up.railway.app`.
- Access to build and install new iOS and Android binaries.
- A release identifier (the Expo app `slug`), a concrete runtime version, and a channel name. The values in this guide are examples; keep the values in the native builds and publish commands identical.
- Bun and this OTA server repository for publishing.

Do not put the server's `OTA_ADMIN_TOKEN` or database URL in the mobile app. The publisher uses them to upload assets and record a release.

## 1. Add Expo modules to the existing React Native project

Commit or back up your native project before changing its Podfile, Gradle files, app delegate, or native configuration. From the React Native app directory, follow Expo's current [Expo modules installation instructions](https://docs.expo.dev/bare/installing-expo-modules/). For a standard React Native CLI project, Expo recommends:

```sh
npx install-expo-modules@latest
```

Then install the Updates library using the version compatible with the installed Expo package:

```sh
npx expo install expo-updates
npx pod-install
```

If automatic Expo module installation fails, follow the manual instructions for the React Native version used by your project. Expo's native integration requirements vary by React Native version and project customization. Ensure Expo CLI is configured for Metro bundling as described in the installation guide; this server's publisher uses `npx expo export`.

## 2. Configure the app identity and update values

Choose values once and use them consistently:

| Setting | Example | Must match |
|---|---|---|
| App slug | `my-rn-app` | `?app=` in the native URL and `--app` when publishing |
| Runtime version | `1.0.0` | Native binary and `--runtime-version` |
| Channel | `production` | Native request header and `--channel` |
| Manifest URL | `https://ota-server.up.railway.app/api/manifest?app=my-rn-app` | Both native platform configurations |

Add or update the Expo config in the React Native project root. For example, `app.json`:

```json
{
  "expo": {
    "name": "My RN App",
    "slug": "my-rn-app",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "https://ota-server.up.railway.app/api/manifest?app=my-rn-app",
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

This app config documents the intended values and is useful to Expo CLI and the publisher. A bare React Native app does **not** automatically apply `app.json` changes to native projects unless you use a config-plugin/prebuild workflow. For a project that keeps native projects checked in, set the corresponding values in `Expo.plist` and `AndroidManifest.xml` as shown below. Do not run `eas update:configure` and leave its default `u.expo.dev` URL; this project uses the self-hosted manifest URL.

### iOS native configuration

In the `Expo.plist` included in the iOS app target (commonly under `ios/<AppName>/Supporting/`), set the server URL, runtime version, launch behavior, and channel. Merge these keys into the existing plist rather than replacing unrelated entries:

```xml
<key>EXUpdatesEnabled</key>
<true/>
<key>EXUpdatesURL</key>
<string>https://ota-server.up.railway.app/api/manifest?app=my-rn-app</string>
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

Ensure `Expo.plist` is added to the iOS app target's resources. The exact location and integration steps depend on the app's native project; follow the [Expo Updates installation guide for bare projects](https://docs.expo.dev/bare/installing-updates/) for the full iOS setup.

### Android native configuration

In `android/app/src/main/res/values/strings.xml`, add a runtime version resource:

```xml
<string name="expo_runtime_version">1.0.0</string>
```

Inside the `<application>` element in `android/app/src/main/AndroidManifest.xml`, add or update the Expo Updates metadata. Merge with existing entries; do not create duplicate metadata keys:

```xml
<meta-data
    android:name="expo.modules.updates.EXPO_UPDATE_URL"
    android:value="https://ota-server.up.railway.app/api/manifest?app=my-rn-app" />
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

The Android keys and native integration can change between Expo SDK versions. Compare your project with the [Expo Updates installation guide for bare projects](https://docs.expo.dev/bare/installing-updates/) and follow the instructions for your installed `expo-updates` version. Production must use HTTPS; do not enable cleartext HTTP traffic for a public deployment.

## 3. Build and install a new native app

Updates configuration is embedded into each native app at build time. After installing and configuring `expo-updates`, build and install a new iOS and/or Android app using your existing signing/release workflow. A JavaScript-only Metro development session is not an OTA test.

Use a release or internal distribution binary with the Expo Updates native module enabled. Debug builds often load JavaScript from Metro instead of the update server. Install the newly built binary on a device or emulator, open it once, and confirm the app works before publishing.

Record the exact runtime version and channel embedded in each binary. Increment or change the runtime version when native code or native dependencies change incompatibly, and ship a new binary for those changes. Keep the same runtime version only for compatible JavaScript and asset updates.

## 4. Publish platform bundles

First make sure `npx expo config --json` and `npx expo export --platform ios --output-dir dist` work from the React Native app directory. The project needs an Expo config with a `slug`; Metro/Expo CLI must be able to bundle the app and its assets. Fix export errors in the app before publishing.

From the OTA server repository, publish one platform at a time:

```sh
railway run bun run publish:update -- \
  --project-dir ../my-react-native-app \
  --app my-rn-app \
  --platform ios \
  --runtime-version 1.0.0 \
  --channel production
```

```sh
railway run bun run publish:update -- \
  --project-dir ../my-react-native-app \
  --app my-rn-app \
  --platform android \
  --runtime-version 1.0.0 \
  --channel production
```

Replace the project path and example values. Run these commands in a Railway-linked environment that provides the OTA service's `DATABASE_URL`, `PUBLIC_URL`, and `OTA_ADMIN_TOKEN`; or provide the equivalent secure variables locally. Never put secrets in source control or the client. The publisher exports the selected platform, uploads hashed bundles/assets to the server, and inserts the release record in PostgreSQL.

Publishing a platform does not publish the other platform. The client also will not receive a release with a different app slug, runtime version, or channel.

## 5. Verify the release before testing the app

Request the manifest for the same values embedded in the binary. This test deliberately uses `ios`; change it to `android` to check that release too:

```sh
curl --fail-with-body --show-error --include \
  --get 'https://ota-server.up.railway.app/api/manifest' \
  --data-urlencode 'app=my-rn-app' \
  --header 'expo-protocol-version: 1' \
  --header 'expo-platform: ios' \
  --header 'expo-runtime-version: 1.0.0' \
  --header 'expo-channel-name: production' \
  --header 'accept: application/expo+json, application/json, multipart/mixed'
```

Expect HTTP `200` and a JSON manifest with `id`, `runtimeVersion`, `launchAsset`, and `assets`. Fetch the exact `launchAsset.url` from that response; it must return HTTP `200`. A `406` means no active release matched the requested app, platform, runtime version, and channel (or the client requested unsupported code signing). A `500` indicates a server/database error; inspect Railway logs.

## 6. Test downloading and applying an update

1. Install and launch the new native binary before publishing a test update.
2. Make a visible JavaScript-only change, such as changing a label or displayed version.
3. Publish that platform again with the **same** app slug, runtime version, and channel.
4. On the device, force-close and reopen the app. With `EXUpdatesCheckOnLaunch` set to `ALWAYS`, the update should be checked on launch. Depending on the library's launch behavior, the downloaded update may be applied on a subsequent launch.
5. Confirm the changed UI appears. Also check the server manifest and launch asset URLs from the device's network if it does not update.

An optional in-app manual check can use `expo-updates`:

```tsx
import * as Updates from "expo-updates";

export async function checkForOtaUpdate(): Promise<void> {
  if (!Updates.isEnabled) {
    throw new Error("Expo Updates is disabled in this native build");
  }

  const result = await Updates.checkForUpdateAsync();
  if (!result.isAvailable) return;

  const fetched = await Updates.fetchUpdateAsync();
  if (fetched.isNew) {
    await Updates.reloadAsync();
  }
}
```

Call this from a development-only or internal testing UI, and surface errors to the tester. `Updates.isEnabled` may be false in a debug build; validate with a release-like native binary. Do not expose an admin or publish token to JavaScript.

## 7. Rollout and rollback

Use the admin dashboard to lower or raise a release's rollout percentage, or roll back the release. Test first with a non-production channel and binary. The channel in the native request header must equal the channel used for publishing.

This server currently does not implement manifest code signing. Do not configure the client to require Expo code signing unless server-side signing is added; a signed-manifest expectation is rejected with HTTP `406`.

## Troubleshooting

| Symptom | Check |
|---|---|
| Manifest returns `406` | App slug, platform, exact runtime version, channel, and active release must match. |
| Manifest returns `500` | Check Railway runtime logs and database connectivity/migrations. |
| Manifest is `200`, asset download fails | Check the asset URL is public HTTPS, the Railway volume is mounted, and the uploaded file exists. |
| App never checks for updates | Rebuild after native config changes; verify `EXUpdatesEnabled`, URL, runtime version, channel, and release build behavior. |
| `expo export` fails | Make sure Expo modules/CLI Metro integration is installed and the project has valid Expo app config. |
| Native module/permission changed | OTA cannot deliver native changes. Build and distribute a new app binary with a compatible runtime version. |
| App reports it is up to date | Confirm a newer active update exists for that exact app/platform/runtime/channel and that the app can reach the server. |

## References

- [Expo modules in an existing React Native project](https://docs.expo.dev/bare/installing-expo-modules/)
- [Install `expo-updates` in an existing React Native project](https://docs.expo.dev/bare/installing-updates/)
- [Using Expo Update without other Expo Services](https://docs.expo.dev/eas-update/standalone-service/)
- [Expo Updates v1 protocol](https://docs.expo.dev/technical-specs/expo-updates-1/)
- [Existing Expo app client and server testing guide](./README.md)
