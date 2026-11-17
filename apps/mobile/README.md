# Studio Mobile

Studio's phone app: a remote for Studio Code. Expo SDK 58, React Native 0.88, expo-router.

**Status:** this is a spike. Today the app holds one spike screen that proves the stack. iOS builds and runs on the iOS Simulator. Android has not been built or run yet.

## What it needs

- Node 24 (the repo's `.nvmrc`).
- iOS: Xcode 26.4 or later with an iOS simulator runtime, and CocoaPods.
- Android: any JDK 17, the Android SDK with an emulator, and `JAVA_HOME` and `ANDROID_HOME` set.

## Run it

From the repo root, install without Studio's download scripts, then apply Studio's patches:

```bash
npm install --ignore-scripts
node ./scripts/apply-available-patches.mjs apps/studio/patches
```

Then, from `apps/mobile`, start the dev server:

```bash
npm start
```

This runs `expo start --dev-client --localhost --port 8097`. The dev server listens on 127.0.0.1 only. It uses port 8097 because port 8081, Metro's default, belongs to `studio ui`.

In a second terminal, from `apps/mobile`, build the native app and install it on the booted simulator:

```bash
npm run ios
```

`npm run ios` does not start a dev server of its own, so start the dev server first.

For a booted Android emulator, the script is:

```bash
npm run android
```

`ios/` and `android/` are generated and not committed.

## Things to know

- With Xcode 27, `npm run ios` (`expo run:ios`) ends with `CommandError: Simulator app did not open fast enough` after a successful build and install. The build worked if the log says `Build Succeeded`. Open the app from the simulator's home screen, or with `xcrun simctl openurl booted "exp+studio-mobile://?__expo_url=http%3A%2F%2F127.0.0.1%3A8097"`.
- Restart the dev server after installing a package. It can miss new files otherwise.
- Every `npm install` in this repository uses `--ignore-scripts`, because the root `postinstall` downloads WordPress and PHP files. After every install, run `node ./scripts/apply-available-patches.mjs apps/studio/patches` from the repo root so Studio's own patches stay applied.
- After a change to `app.config.ts`, or to the `enriched-markdown` block in `package.json`, run `npx expo prebuild --clean` from `apps/mobile` before building. It regenerates the native projects.

## Checks

From `apps/mobile`:

```bash
npm run typecheck
```

```bash
npm run lint
```

From the repo root, run the app's unit tests:

```bash
npm test -- apps/mobile
```

## One design system per platform

The layout is the same on iOS and Android. What the controls are made of is not. iOS uses Liquid Glass. Android uses Material 3, with a palette built from Studio's blue (`src/theme/seed.ts`).

A component that differs has two files: `Name.tsx` is the iOS version and the type contract, and `Name.android.tsx` is the Android version with the same exports. Code that imports `@expo/ui/jetpack-compose` lives only in `.android.tsx` files. Platform files do not go in `src/app/`.

## Why React is pinned in the root `package.json`

React Native 0.88.1 needs React 19.3.0, and one app must not load two React versions. npm hoists React Native next to the workspace's React, so the root `overrides` pins `react` and `react-dom` to 19.3.0 for every app. `@types/react` is 19.3.0 for the whole workspace for the same reason. Studio's React version follows Expo's SDK from here on.
