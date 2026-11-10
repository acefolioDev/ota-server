# Use this OTA server from an Expo React Native app

This guide covers connecting an Expo app that uses `expo-updates` to this server, publishing and checking an update, and testing rollback. These instructions apply to Expo apps using Expo's Updates protocol; they do not enable OTA updates for arbitrary native React Native apps without `expo-updates`.

For a single walkthrough that covers the server, a new or existing Expo app, and a React Native CLI app, see the [complete setup guide](./complete-setup.md).
For React Native CLI apps that own their native `ios/` and `android/` projects, see the dedicated [React Native CLI OTA setup guide](./react-native-cli-ota.md), which covers Expo modules installation and native configuration.
For a focused end-to-end smoke test of publishing, manifest and asset delivery, and applying an update in an installed app, see [Test whether OTA updates work](./testing-ota-updates.md).

## What you need

- A running OTA server with its database migration applied.
- A public HTTPS URL for production. A phone or simulator must be able to reach both the manifest URL and every asset URL returned in its manifest.
- Expo CLI in the app project (`npx expo ...`) and a native iOS or Android build with `expo-updates` installed.
- A known, concrete runtime version for the native build and the OTA bundle. An update with a different runtime version will not be served to that build.

The server's manifest route is `https://ota.example.com/api/manifest`. Its publishing CLI creates content-addressed asset URLs using `PUBLIC_URL` and uploads files to the server, which stores them under `OTA_STORAGE_DIR/assets`. Set the public URL, persistent asset storage, and `OTA_ADMIN_TOKEN` on the server before publishing. Do not remove published assets while clients could still request their release.

## 1. Install and configure Expo Updates

From the Expo app project:

```sh
npx expo install expo-updates
```

Set `updates.url`, a concrete `runtimeVersion`, the update channel, and the app slug in `app.json` (or your app config). For example:

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "https://ota.example.com/api/manifest?app=my-app",
      "requestHeaders": {
        "expo-channel-name": "production"
      }
    }
  }
}
```

Replace the example host, slug, channel, and runtime with your values. For local development, the URL must still be reachable from the device. `localhost` on a physical phone refers to the phone, not your computer; use a reachable development host and set the server's `PUBLIC_URL` to that same reachable origin.

The `app` query parameter identifies which app's releases to look up. It should equal the Expo `slug` (or the `--app` value you pass to the publisher). This lets the client identify the app without a custom project-ID header. The server defaults to the `production` channel when `expo-channel-name` is absent, but setting the channel explicitly avoids ambiguity.

`expo-updates` supplies the Expo protocol headers, including the platform and runtime version, from the native build configuration. The channel header is configured at build time through `updates.requestHeaders`. Set the same channel when publishing.

If you maintain a bare React Native project rather than using Expo's app config/prebuild workflow, configure the Expo Updates URL, runtime version, and request headers in the native iOS `Expo.plist` and Android manifest as described in the [Expo standalone Updates guide](https://docs.expo.dev/eas-update/standalone-service/).

### Runtime versions and native builds

`runtimeVersion` represents native compatibility, not the JavaScript app version alone. Use the same concrete string in the built app and publisher command. A change to native modules, permissions, or other native code generally requires a new native build and an appropriately changed runtime version; OTA updates only replace compatible JavaScript and assets.

Build and install a native app after changing its Updates configuration. A typical internal test build can use your existing EAS Build or native build workflow. Do not use Expo Go to validate a standalone app's production update configuration; test an installed development/preview/production native build with `expo-updates` enabled.

For example, with EAS Build:

```sh
eas build --profile preview --platform ios
# or
eas build --profile preview --platform android
```

Ensure that the build actually embeds the `updates.url`, `runtimeVersion`, and channel configuration from your app config. If changing native configuration or the runtime version, rebuild and reinstall the native app before testing the new values.

## 2. Publish an update

From the OTA server repository, publish the platform bundle using the same concrete runtime version and channel embedded in the installed app:

```sh
bun run publish:update -- \
  --project-dir ../my-expo-app \
  --platform ios \
  --runtime-version 1.0.0 \
  --channel production
```

Publish Android separately:

```sh
bun run publish:update -- \
  --project-dir ../my-expo-app \
  --platform android \
  --runtime-version 1.0.0 \
  --channel production
```

The command exports the requested platform, reads Expo's export metadata, hashes and uploads the launch bundle and referenced assets, then submits an active release to the server admin API. It uses the Expo config slug unless `--app <slug>` is supplied. When `extra.eas.projectId` exists in the Expo config, it is linked automatically; `--project-id <uuid>` can override it. The client can use the `?app=<slug>` URL above regardless of whether a project ID is configured.

The publisher needs the server's `PUBLIC_URL` and `OTA_ADMIN_TOKEN`; it uploads assets and submits release metadata through the authenticated server API. The server writes the release to PostgreSQL using its own database connection, so the publisher does not need the database URL. `PUBLIC_URL` must be the externally reachable asset origin, not `localhost`, for devices outside the server host. Never expose `OTA_ADMIN_TOKEN` in the React Native app; it is only for management and publishing.

## 3. Check that the server has a matching release

Use the app slug, platform, exact runtime version, and channel configured in the installed native build:

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

Change the platform to `android` to check the Android release. A successful response is JSON containing `id`, `createdAt`, `runtimeVersion`, `launchAsset`, `assets`, `metadata`, and `extra`; response headers include protocol version `1`, SFV version `0`, and `cache-control: private, max-age=0`. If you receive `406`, check that the app slug, channel, platform, runtime version, and active release all match.

Copy the `launchAsset.url` from a successful manifest and request it directly:

```sh
curl --fail-with-body --show-error --output /dev/null --write-out 'HTTP %{http_code}\n' \
  'https://ota.example.com/api/assets/<content-hash>.hbc'
```

Use the exact URL from your response; the file extension varies with the export. An asset request should return `HTTP 200`. If the manifest works but this request fails on a device, check `PUBLIC_URL`, network access, and persistent asset storage.

The route also accepts an app project ID in the `expo-project-id` request header. For this setup, `?app=my-app` is simpler and avoids relying on custom native headers.

## 4. Test fetching and applying the update in the app

`expo-updates` checks for updates automatically according to its native configuration. For a test screen or a manual “Check for updates” action, call the API from JavaScript:

```tsx
import * as Updates from "expo-updates";
import { Alert, Button } from "react-native";

export function CheckForOtaUpdateButton() {
  async function checkForUpdate() {
    if (!Updates.isEnabled) {
      Alert.alert("Updates unavailable", "This native build does not have OTA updates enabled.");
      return;
    }

    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert("You're up to date");
        return;
      }

      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) {
        await Updates.reloadAsync();
      }
    } catch (error) {
      Alert.alert(
        "Update check failed",
        error instanceof Error ? error.message : "Could not check for an update.",
      );
    }
  }

  return <Button title="Check for updates" onPress={checkForUpdate} />;
}
```

Render the screen in a build where `expo-updates` is enabled. After publishing, open the installed app and trigger the check. If `Updates.checkForUpdateAsync()` reports no update, recheck the native build's channel/runtime values and confirm that the matching server manifest returns `200` with curl. If fetching fails after a manifest succeeds, verify that the device can reach every URL in the manifest, not just the API host.

For a realistic first-launch test, install the native build before publishing, force-close and reopen the app after publishing, and allow its configured update check to run. To test fetching in the foreground, use the button above, then reload after `fetchUpdateAsync()` reports a new update.

## 5. Test the dashboard, rollout, and rollback

Open `https://ota.example.com/admin/`, enter the server's `OTA_ADMIN_TOKEN`, and connect. The token must remain on the server and should never be included in the app bundle.

The dashboard lists apps and releases with their platform, runtime, channel, active state, rollout percentage, and publish time. Use the slider and **Save rollout** to update the selected release. Use **Roll back** to deactivate it. The server then returns the newest remaining active release matching the same app, channel, platform, and runtime; it returns `406` if no eligible release remains.

You can also verify admin-token enforcement directly:

```sh
# No token: expected 401 (or 503 if OTA_ADMIN_TOKEN is not configured).
curl --include 'https://ota.example.com/api/admin/apps'

# Valid token: expected 200 and an apps/releases JSON response.
curl --include \
  --header 'Authorization: Bearer <OTA_ADMIN_TOKEN>' \
  'https://ota.example.com/api/admin/apps'
```

Keep the admin token out of shell history and shared logs in real deployments.

### Important rollout behavior

Rollout selection is stable for the same app/client identifier. The server uses `expo-installation-id` or `expo-device-id` if a request supplies one; otherwise it falls back to the first `x-forwarded-for` address or `x-real-ip`. Those installation/device headers are not required Expo Updates protocol headers, so do not assume the standard Expo client sends them automatically. Without one, devices behind the same NAT/proxy may share a rollout assignment. Configure and trust proxy IP forwarding correctly, or add a supported stable client-ID mechanism before relying on per-device percentage rollouts. Test a percentage rollout with explicit IDs using separate curl requests:

```sh
curl --silent --show-error --include \
  --get 'https://ota.example.com/api/manifest' \
  --data-urlencode 'app=my-app' \
  --header 'expo-protocol-version: 1' \
  --header 'expo-platform: ios' \
  --header 'expo-runtime-version: 1.0.0' \
  --header 'expo-channel-name: production' \
  --header 'expo-installation-id: test-device-a'
```

Use another value such as `test-device-b` for another deterministic assignment. A release at `0%` is never selected; at `100%` it is eligible for every client. Since clients receive the newest eligible active release, an earlier active release is available to clients outside a newer staged rollout.

## Troubleshooting

| Symptom | Check |
|---|---|
| `400` from `/api/manifest` | The request must include protocol version `1`, platform `ios` or `android`, and a non-empty runtime-version header. |
| `406` from `/api/manifest` | Confirm a release is active and that its slug/app ID, channel, platform, and runtime version exactly match the request. Also confirm the client is not configured to require code signing. |
| `404` for a bundle or image | Confirm the copied URL is correct, the publisher and API share `OTA_STORAGE_DIR`, and the file still exists. |
| App installs but never downloads an update | Rebuild after changing native Updates configuration; confirm the device can reach the manifest and asset URLs; check the runtime version/channel. |
| `503` from `/api/admin/apps` | Set `OTA_ADMIN_TOKEN` in the server environment and restart the server. |
| Dashboard shows no releases | Publish the correct platform/runtime/channel and check the API response for `GET /api/admin/apps`. |
| Update contains native-module changes | OTA cannot install native code. Ship and install a new native binary, and use a runtime version compatible with that binary. |

This server currently serves JSON manifests and does not implement manifest code signing. A client configured with `expo-updates` code-signing verification will receive `406`; configure signing on the server before enabling it in the native app.

## Further reading

- [Expo Updates configuration and JavaScript API](https://docs.expo.dev/versions/latest/sdk/updates/)
- [Expo Updates protocol v1](https://docs.expo.dev/technical-specs/expo-updates-1/)
- [Expo Updates without Expo services](https://docs.expo.dev/eas-update/standalone-service/)
- [Expo app configuration: `updates`](https://docs.expo.dev/versions/latest/config/app/#updates)
