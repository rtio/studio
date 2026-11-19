# Studio Mobile

Studio's phone app: a remote for Studio Code. Expo SDK 58, React Native 0.88, expo-router.

**Status:** pairing, the drawer, reading and writing a chat. The app pairs with `studio remote`, lists the computer's sites and chats, keeps them live, and shows the open chat as the agent works: its reply as it is written, its steps, its questions. It sends messages, queues them while the agent works, stops a run, answers the agent's questions and starts a new chat for a site. The drawer shows which chats need the person and which are working, and a long press on a message copies, edits, sends again or shares it. It runs on the iOS Simulator, on an Android emulator and on an iPhone paired with a real Studio over Wi-Fi.

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
- asks every 15 seconds, without its token, who answers at the paired address, and reconnects when nobody or another computer does;
- opens the stream again when no data arrived for 5 minutes, because a stream on a dead network route is silent;
- reconnects when it comes back from the background;
- waits 1 second before a new try, then double each time, up to 30 seconds, and drops a try that has not opened after 20 seconds.

Before each try the app reads `/.well-known/studio/remote` without its token and compares the instance id with the paired one. It sends the token only when they match, and it reads the sites and chats only while the link is live. This keeps the token from another device that got the paired address. It is not a defense against an attacker: the id is not a secret and the connection is plain HTTP.

## The open chat

The phone builds the transcript with the same code as Studio's own chat view, which lives in `packages/agent/protocol/transcript/`. It reads the chat with `GET /api/sessions/:id` when the chat opens, and again each time the computer saves something new in it: the computer writes the prompt, each message, each tool result, a question and the end of a turn to the chat file before it sends the event that tells about it. Reads asked for within 400 ms are one read, because each read downloads the whole chat. Between those reads, the reply the agent is writing comes from the event stream, drawn at most every 50 ms.

What the phone does not show:

- the result of a tool step, only its one-line label: results can be long, and some hold secrets, such as the password of a site the agent created;
- images: an image in the agent's text is never requested; an image on its own line, and a screenshot, show as their description;
- links other than `http` and `https`, and links to the computer's own `localhost`, which would reach the phone itself. The text cannot be selected, and iOS shows no link menu or preview on a long press: both would get around this rule.

## Sending, stopping, answering

The phone follows the rules of Studio's own composer, with the same run-state reducer (`packages/agent/protocol/transcript/run-state.ts`). The phone's side is `src/data/run-control.ts`.

- A message goes out only while the chat is idle. While the agent works, a question waits or earlier messages wait, it joins a queue shown above the composer, and the first one goes out when the run's process has exited. The computer refuses a message to a busy chat with the same error it gives for a broken one, so the phone never relies on the answer.
- A send carries a random turn id, so the computer passes the prompt to the agent in a file and not on its command line.
- Stop asks the agent to stop; a second Stop kills it. If a question is open, the phone first answers it with "stopped without an answer": the agent waits for the answer and not for the stop.
- The answers of a batch of questions go in one request, once each question has one: the computer takes one answer per batch. A tap answers a single-choice question; a multiple-choice one takes its picks with Done. When the agent offers its own "Other", the composer takes the answer.
- A new chat is made for the site in the header, then the first message goes to it.
- The queue lives in memory only. Studio on the computer has its own queue; the two do not see each other.
- Each chat keeps its own draft, in memory only; the screen with no chat open keeps one per site. A send that fails puts its text back in the chat it was for, unless something new was typed there since. The drafts go when the phone forgets the computer.
- When Stop gets no answer for 5 seconds, the composer says so and offers Force stop.

## Around the chat

- The drawer puts chats with a question waiting under "Needs you" and running chats under "Working", with the time since the run started; the rest follow under "Chats". The running turn in a chat says "Working for 0:42". The start time comes from the computer (`startedAt` in the list of active runs, or the time of the `run.started` event), so it is right after a reconnect.
- A long press on a message offers Copy, Edit (puts its text in the composer), Send again (only while the link is live) for the person's messages, and Copy and Share for a finished reply. A message with images, files or a note on the page offers Copy alone: the composer takes text only. iOS uses the system action sheet, Android a Material bottom sheet.
- With no chat open, the screen offers the sites as chips and, once a site is picked, four starter prompts. A prompt fills the composer; it does not send.
- The phone taps back when a message goes out, when a question waits and when a turn ends: one pattern when it ended well, another when it failed, nothing when someone stopped it. Settings has a switch for it.
- When the link is not live, one line above the composer says why, with Try again, or Details when another computer answers. The composer keeps its text and does not send.
- Settings shows the link's state and, while it is not live, when it last was. Copy diagnostics copies the app version, the computer's name and address, the link's state, when it was last live and the last problem. It never copies the token.

## Work without Studio

A spinner, a question or live text needs an agent run. For work on the app there is a stand-in server with made-up sites and chats and a loop of events. In "Add a blog" it plays a whole run: the prompt, a streamed reply with a step, a question that is answered on the computer, and a final reply. It logs any request for the image in that reply, which the app must never make.

It also takes what the phone sends. A message starts a short run in that chat; with a `?` in it, the agent first asks two questions (one with its own "Other", one with several picks). Answers, Stop and new chats work as on the computer, including the 500 for a message to a busy chat and a stopped run leaving the list of active runs at once. The loop leaves alone a chat the phone runs in. What the phone sent is lost when the server stops.

It takes made-up screenshots of its sites: a header in the site's color and a block whose color changes each time a run in one of the site's chats ends. A run the phone started also sends `preview.reload`. Shop has no stored screenshot. Set `FAKE_REMOTE_SCREENSHOT=no-browser` or `FAKE_REMOTE_SCREENSHOT=failed` to make every screenshot fail for that reason.

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
- A Release build for a real iPhone swaps React Native's prebuilt core, Hermes and Expo's prebuilt modules to their release flavor, and the next simulator build can keep them: it then fails to link, or the app dies at launch. Each swap is keyed on a marker file, `ios/Pods/React-Core-prebuilt/.last_build_configuration`, `ios/Pods/hermes-engine/.last_build_configuration` and `ios/Pods/<Module>/artifacts/.last_build_configuration`. Write `Release` into the first two and `release` into the others, then build again: the build swaps them back to debug.
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
