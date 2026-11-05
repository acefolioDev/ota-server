# Test whether OTA updates work

This is a manual end-to-end smoke test for this server and an app using Expo's `expo-updates` client. It verifies publishing, manifest lookup, asset delivery, and downloading/applying an update in a native app. It does not test native-code changes: those require a new app binary.

For app setup and native configuration, see the [Expo client integration guide](./README.md) or the [React Native CLI guide](./react-native-cli-ota.md). The [Miki sample app](../examples/miki/README.md) includes a **Check updates** button for the client-side test.

## Before you start

- Have a running server with its database migrated, a reachable HTTPS URL, persistent asset storage, and `PUBLIC_URL` plus `OTA_ADMIN_TOKEN` available to the publisher. The publisher sends release metadata through the server API and does not connect directly to PostgreSQL.
- Choose an app slug, platform, exact runtime version, and channel. These must match the installed native build and the publish command.
- Use a release-like native build with `expo-updates` enabled. Do not use Expo Go or a debug build that loads JavaScript from Metro.
- Install and launch the native build **before** publishing the test update. This proves that the update arrives over the OTA path rather than being included in the original binary.

The commands below use the Miki sample app and Railway deployment. Replace the server URL and values with your own. Run commands from the OTA server repository root.

## 1. Confirm the server is reachable

```sh
curl --fail --show-error --include \
  'https://ota-server.up.railway.app/health/live'
```

Expect HTTP `200` and `{"status":"ok"}`. Open the installed app and confirm its original UI appears. In Miki, note the current subheading: `Little thoughts, kept close.`

## 2. Make a visible JavaScript-only change

In `examples/miki/App.tsx`, change the displayed subheading to a unique test value, for example:

```tsx
<Text style={styles.subheading}>OTA test: update received.</Text>
```

Do not change native files, native dependencies, or the runtime version for this test. The changed text is a marker that lets you distinguish the downloaded update from the original binary.

## 3. Publish the changed bundle

Publish for the platform you installed. This example uses Android:

```sh
railway run bun run publish:update -- \
  --project-dir examples/miki \
  --app miki \
  --platform android \
  --runtime-version 1.0.0 \
  --channel production
```

For iOS, use `--platform ios`. Publishing one platform does not publish the other. The publisher must finish successfully; it exports the app, uploads the content-addressed assets, and records an active release.

## 4. Check the manifest and bundle over HTTP

Request a manifest using the same app, platform, runtime version, and channel as the native build:

```sh
curl --fail-with-body --show-error --include \
  --get 'https://ota-server.up.railway.app/api/manifest' \
  --data-urlencode 'app=miki' \
  --header 'expo-protocol-version: 1' \
  --header 'expo-platform: android' \
  --header 'expo-runtime-version: 1.0.0' \
  --header 'expo-channel-name: production' \
  --header 'accept: application/expo+json, application/json, multipart/mixed'
```

Expect HTTP `200` and a JSON manifest with an update `id`, `runtimeVersion: "1.0.0"`, and a `launchAsset.url`. Copy the exact `launchAsset.url` from the response and request it:

```sh
curl --fail-with-body --show-error --output /dev/null \
  --write-out 'Launch asset HTTP %{http_code}\n' \
  'PASTE_THE_EXACT_LAUNCH_ASSET_URL_HERE'
```

Expect `Launch asset HTTP 200`. If the manifest request returns `406`, verify the app slug, platform, runtime version, channel, and active release. If the manifest is `200` but the asset request fails, check that `PUBLIC_URL` is reachable and the server still has the uploaded asset in persistent storage.

## 5. Fetch and apply the update in the installed app

With the device or emulator able to reach the manifest and asset URLs:

1. In Miki, tap **Check updates**. In another app, use its manual `expo-updates` check if available, or force-close and reopen it to trigger the configured launch check.
2. Wait for the app to reload after downloading the update.
3. Confirm the screen now shows `OTA test: update received.` without reinstalling or rebuilding the native app.
4. If the app stores user data locally, confirm the data is still present after the update.

If the test update was published before installing the native binary, install the binary first and publish a *new* JavaScript change. Updates already embedded in or fetched by an app are not evidence that a later server publish can be downloaded.

## What counts as a pass?

The OTA path works end to end when all of the following are true:

- The publisher completes successfully.
- A request with the installed build's app, platform, runtime version, and channel gets HTTP `200` and returns the newly published manifest.
- The manifest's launch asset URL returns HTTP `200`.
- The already-installed native app downloads the release and displays the unique changed text after reloading.

A successful `curl` manifest request alone only proves that the server can select a release; it does not prove that the app can download or apply it.

## Troubleshooting

| Result | Check |
|---|---|
| Publisher fails | Confirm the project path and Expo export work, and that `PUBLIC_URL` and `OTA_ADMIN_TOKEN` target the running OTA service. Check the service's database migration/deployment logs if the API reports a database error. |
| Manifest returns `400` | Include protocol version `1`, platform `ios` or `android`, and a non-empty runtime-version header. |
| Manifest returns `406` | Match the published app slug, platform, runtime version, and channel exactly; confirm an active release exists. The server does not currently support manifest code signing. |
| Manifest returns `200`, launch asset does not | Check the exact asset URL, public URL, shared/persistent storage, and server logs. |
| App says it is up to date | Confirm a newer release was published for this platform and that the installed binary has the same runtime version and channel. Check connectivity to the manifest from the device. |
| App check fails or no update appears | Use a release-like build with `expo-updates` enabled, not a Metro-connected debug build. Confirm the device can reach both manifest and asset URLs, then inspect the error shown by the app. |
| JavaScript update appears, native change does not | Expected: OTA updates only replace compatible JavaScript and assets. Build and install a new native binary for native changes. |
