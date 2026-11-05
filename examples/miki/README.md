# Miki

Miki is a local-first notes app scaffolded with the React Native Community CLI. It stores notes on-device using AsyncStorage and uses Expo `expo-updates` to check this repository's self-hosted Expo Updates v1 server.

The app has three JavaScript screens—Notes, Pinned, and Settings—with a separate note editor. `App.tsx` is only the entry point; screens, reusable components, note storage, and the OTA update hook live under `src/`. Each screen component is kept under 250 lines. This UI structure uses the dependencies already in the project and does not require adding a native API or navigation package.

## Requirements

- Node.js 22.11 or newer (required by the generated React Native 0.88.1 template).
- Xcode and CocoaPods for iOS; Android Studio and an Android SDK for Android.
- A device or emulator for native testing.

## Install and run

Dependencies and native libraries are declared in `package.json`:

- `expo` and `expo-updates` provide the native Expo Updates client.
- `@react-native-async-storage/async-storage` persists notes locally.
- `react-native-safe-area-context` handles device safe areas.

Install dependencies and run Metro:

```sh
npm install
npx pod-install
npm start
```

The install hook applies the two pinned Swift compatibility patches in `patches/` for the Expo SDK 58 dependencies. Keep these patches when installing from a clean checkout, and review them when upgrading Expo.

`npx pod-install` is required on macOS after a fresh clone or native dependency change.

In another terminal:

```sh
npm run android
# or
npm run ios
```

Use a release-like native build to test OTA. A debug build connected to Metro does not verify the production OTA path.

For local release builds, use `npx react-native run-android --mode release` or `npx react-native run-ios --mode Release`. The generated Android template uses its debug keystore for the sample release variant; configure your own signing credentials before distributing a real Android release.

## OTA configuration

The app is configured with:

- App slug: `miki`
- Runtime version: `1.0.0`
- Channel: `production`
- Manifest URL: `https://ota-server.up.railway.app/api/manifest?app=miki`

These settings are mirrored in `app.json`, Android's `AndroidManifest.xml`, and iOS `Expo.plist`. If you change the app slug, runtime version, channel, or server URL, update both native platform configurations and rebuild/reinstall the app. Never add the OTA admin token or database credentials to this project.

## Publish a test update

From the OTA server repository root, with the Railway CLI linked to the OTA service/environment:

```sh
railway run bun run publish:update -- \
  --project-dir examples/miki \
  --app miki \
  --platform android \
  --runtime-version 1.0.0 \
  --channel production
```

Run again with `--platform ios` to publish the iOS bundle. Change a visible JavaScript string in `App.tsx`, publish the matching platform, then open the installed release build and tap **Check updates** or relaunch it. The app downloads and applies an available compatible update.

Check the manifest separately:

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

An active matching release returns `200`; `406` means there is not yet a matching release or one of its app/platform/runtime/channel values differs.

## Checks

```sh
npm run typecheck
npm test -- --runInBand
npx expo export --platform android --output-dir dist-android
npx expo export --platform ios --output-dir dist-ios
```

The server publisher uses its own `dist` output directory by default; run optional export checks from this app directory only.

## React Native CLI commands

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
