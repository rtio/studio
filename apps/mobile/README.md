# Studio Mobile

Studio's phone app: a remote for Studio Code. Expo SDK 58, React Native 0.88, expo-router.

**Status:** pairing and the drawer. The app pairs with `studio remote`, lists the computer's sites and chats, and keeps them live: site status, a spinner on a chat that is working, a dot on a chat that waits for an answer. The conversation itself is not built yet. It runs on the iOS Simulator and on an Android emulator. It has not run on a real phone.

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

The emulator cannot reach the computer's 127.0.0.1 by itself. Forward the dev server's port, then open the app on it:

```bash
adb reverse tcp:8097 tcp:8097
```

```bash
adb shell am start -a android.intent.action.VIEW -d "exp+studio-mobile://?__expo_url=http%3A%2F%2F127.0.0.1%3A8097" com.automattic.studio.mobile
```

`ios/` and `android/` are generated and not committed.

## Pair it with Studio

On the computer, from the repo root, build the CLI and start remote mode on loopback:

```bash
npm run cli:build
```

```bash
node apps/cli/dist/cli/main.mjs remote --host 127.0.0.1 --port 8098
```

It prints a QR code, an address and a pairing code. In the app, type the address and the code, or scan the QR code with a real phone. On a simulator you can open the pairing link instead: `studio-remote://pair?url=<address>&code=<code>&id=<instance id>`. The app shows the address and pairs after you tap Pair. The instance id is in `http://127.0.0.1:8098/.well-known/studio/remote`.

An Android emulator needs `adb reverse tcp:8098 tcp:8098` first.

Remote mode writes to Studio's config folder. To keep a development run away from your real Studio, set `DEV_CONFIG_DIR` and `STUDIO_PROCESS_MANAGER_HOME` to scratch folders before you start it.

## Live updates

While the app is paired it keeps one event stream open to the computer (`GET /api/events`). The computer sends no heartbeat and cannot replay events, so the app:

- reloads the sites, the chats and the active runs each time the stream opens;
- asks `GET /api/health` every 15 seconds while the stream is open, and reconnects when that fails;
- reconnects when it comes back to the front;
- waits 1 second before a new try, then double each time, up to 30 seconds.

Before each try the app reads `/.well-known/studio/remote` without its token and compares the instance id with the paired one. It sends the token only when they match.

## Work without Studio

A spinner or a question dot in the drawer needs an agent run. For work on the app there is a stand-in server with made-up sites and chats and a loop of events:

```bash
node scripts/fake-remote.mjs
```

It listens on `http://127.0.0.1:8099`. Pair with that address and the code `FAKE-FAKE-FAKE`. An Android emulator needs `adb reverse tcp:8099 tcp:8099` first.

## Colors

`src/theme/tokens.generated.ts` holds Studio's colors as hex values. A script reads them from `apps/ui/src/lib/theme/tokens.css` with a headless browser, because React Native cannot evaluate the CSS color functions Studio uses. After `tokens.css` changes, run this from `apps/mobile`:

```bash
npm run tokens
```

A unit test fails when the generated file is older than `tokens.css`.

## Things to know

- With Xcode 27, `npm run ios` (`expo run:ios`) ends with `CommandError: Simulator app did not open fast enough` after a successful build and install. The build worked if the log says `Build Succeeded`. Open the app from the simulator's home screen, or with `xcrun simctl openurl booted "exp+studio-mobile://?__expo_url=http%3A%2F%2F127.0.0.1%3A8097"`.
- `npm run android` ends by opening the app on port 8081 at the computer's network address, where this app has no dev server. The app then shows a connection error. Open it with the `adb` commands above.
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

Every Compose `Host` takes `seedColor={ STUDIO_SEED_COLOR }` and `colorScheme={ scheme }` from `useTheme()`. Without `colorScheme` the control follows the system and ignores the theme chosen in Settings.

## Why React is pinned in the root `package.json`

React Native 0.88.1 needs React 19.3.0, and one app must not load two React versions. npm hoists React Native next to the workspace's React, so the root `overrides` pins `react` and `react-dom` to 19.3.0 for every app. `@types/react` is 19.3.0 for the whole workspace for the same reason. Studio's React version follows Expo's SDK from here on.
