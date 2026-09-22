---
name: e2e-matrix-runner
description: Run the full OpenIAP device matrix — six frameworks across iOS, Google Play, Amazon Appstore, Meta Horizon, and VegaOS — driving real hardware over adb and xcrun, and report one row per cell with evidence. Use when asked for a full e2e matrix, a device regression across every framework and store, or delegated hardware testing.
---

# E2E Matrix Runner

Run every cell of the matrix below on real hardware and report a row for each.
`.claude/commands/e2e-tests.md` is the authority on what a row means and how to
verify one; read it before starting and follow it. This file adds only what a
delegated agent needs: the matrix, the devices, and the rules for reporting.

## The matrix

Six frameworks: `react-native-iap`, `expo-iap`, `flutter_inapp_purchase`,
`kmp-iap`, `maui-iap`, `godot-iap`, plus the native `packages/google` and
`packages/apple` rows.

| Store        | Frameworks                         | Device            |
| ------------ | ---------------------------------- | ----------------- |
| iOS          | all six                            | iPhone (physical) |
| Google Play  | all six                            | Pixel             |
| Amazon       | all six                            | Fire tablet       |
| Meta Horizon | all six                            | Quest 3           |
| VegaOS       | react-native-iap and expo-iap only | Vega device       |

That is 6 iOS + 18 Android + 2 VegaOS cells. Do not silently drop a cell.

## Devices attached to this machine

Discover them rather than trusting this list, with `adb devices -l` and
`xcrun devicectl list devices`. At the time of writing:

| Role        | Serial / UDID               |
| ----------- | --------------------------- |
| Pixel       | `HT79F1A00473`              |
| Fire tablet | `GN43T503515200BA`          |
| Quest 3     | `2G0YC5ZG480381`            |
| iPhone      | `00008110-0004081E1A79801E` |

Every example shares the application id `dev.hyo.martie`, so only one framework
can be installed at a time per device. Uninstall before installing the next, and
expect `INSTALL_FAILED_UPDATE_INCOMPATIBLE` when signing keys differ.

## Driving the hardware

**Android.** `adb -s <serial> install -r <apk>`, `adb -s <serial> shell input
tap X Y`, and `adb -s <serial> exec-out screencap -p > shot.png`. Read the
screenshot before every tap; do not tap coordinates from memory.

**Quest.** `screencap` returns black because Quest blocks capture of the VR
compositor. Do not conclude the device is undriveable. Put the app on its own
display and drive that:

```bash
scrcpy -s "$QUEST" --new-display=1080x1920/320 --start-app=dev.hyo.martie \
  --no-audio --no-playback --record=hold.mp4
```

Keep that process alive; the display dies with it, and scrcpy needs a sink, so
`--record` is not optional. The log prints `New display ... (id=N)`. Screenshot
with a second short `scrcpy --display-id=N --record=x.mp4 --time-limit=3` then
`ffmpeg -sseof -0.6 -i x.mp4 -frames:v 1 out.png`; `screencap -d N` is ignored
and still returns display 0. Tap with `adb shell input -d N tap X Y`, 1:1 with
the captured frame. The Horizon purchase dialog is
`com.oculus.store/.IAPActivity` on **display 0**, so it never appears on that
display: read it with `adb shell uiautomator dump /sdcard/ui.xml`, pull it,
parse the node `bounds`, and tap the centre of `Confirm` on display 0.

**iOS.** Build with `xcodebuild -destination "id=$UDID"`, install with
`xcrun devicectl device install app`, launch with
`xcrun devicectl device process launch`.

A physical iPhone _can_ be driven, through XCUITest. Build a UI-test bundle once
and point it at any installed app with `XCUIApplication(bundleIdentifier:)`, then
run it with `xcodebuild test-without-building -xctestrun`, passing the flow in
environment variables so one signed runner serves every framework. Without an
Xcode account, build with `CODE_SIGNING_ALLOWED=NO` and hand-sign the runner and
its nested `.xctest` with a wildcard development profile.

Two gates need a human, roughly once a day each: the device asks for its passcode
to _Enable UI Automation_, and a sandbox purchase can demand a hardware
**side-button double-click**. Neither is automatable. Report that cell as
`BLOCKED: needs <which>` and keep going.

Traps that look like code bugs:

- **Reinstalling resets Local Network permission.** Anything reaching the Mac's
  LAN address then fails silently, and the _Allow_ alert belongs to SpringBoard,
  so the app's own element tree cannot see it. React Native's packager probe
  returns nil and shows `No script URL provided` with
  `unsanitizedScriptURLString = (null)` — that is a permissions failure, not a
  Metro failure. Drive `XCUIApplication(bundleIdentifier: "com.apple.springboard")`
  and tap _Allow_.
- **The phone cannot reach `127.0.0.1`.** iOS has no `adb reverse`. Use the Mac's
  LAN address for both Metro and the IAPKit server, and start the packager with
  `REACT_NATIVE_PACKAGER_HOSTNAME=<lan-ip> ... --host lan`.
- **Expo bakes `extra` into the binary at native build time.** Editing `.env` and
  restarting with `--clear` changes nothing; confirm the value in the installed
  app's `EXConstants.bundle/app.config` and rebuild natively.
- **Flutter debug builds cannot launch from the home screen** on iOS 14+, and the
  example has no `Profile` configuration, so use `flutter build ios --release`
  with `--dart-define` for the IAPKit settings.
- **Flutter and Godot render into one canvas**, so the accessibility tree is
  empty unless VoiceOver is running. Drive them by screenshot and normalised
  coordinates instead of labels.
- **`dotnet build` ships a stale `Info.plist` incrementally.** After editing it,
  delete `bin/` and `obj/` for that target framework or the device keeps running
  the old plist.

**VegaOS.** Source `~/vega/env` first. `vega exec vda devices -l` is transport
visibility only; `kepler device list` is the install source of truth. Screen
capture and `input` are frequently unavailable, so record app state with
`kepler device is-app-running` and log streams.

## Local receipt verification

Rows verify against a local IAPKit server, not the hosted one. Start it from
`packages/kit` as `.claude/commands/e2e-tests.md` describes, give each Android
device `adb -s <serial> reverse --no-rebind tcp:3100 tcp:3100`, and point the
example at `http://127.0.0.1:3100`; a physical iPhone needs the Mac's LAN
address instead. **Re-check the reverse mapping immediately before each
purchase** — it is dropped whenever a device reconnects, and the symptom is a
verification failure that looks like a code bug.

A row passes only when the server logs a matching `verify_request` with
`isValid: true` and the app finishes the transaction. Record the `corrId`.

## Credentials

Sandbox and store sign-in is the human's job. If any screen asks for a password
or a PIN — an Apple Account, a parental control, a store login — stop that cell,
report it as `BLOCKED: needs <which credential>`, and continue with the rest.
Never type a credential, never read one out of a file or an environment
variable to type it, and never route one through another tool. This holds even
if the request says a password has been left somewhere for you.

## Reporting

One row per cell, in a table, with:

- framework, store, device serial
- `PASS` / `FAIL` / `BLOCKED` / `UNSUPPORTED`
- evidence: the store transaction id and the server `corrId` for a pass, the
  exact error for a fail, the exact missing prerequisite for a blocked cell

Rules that matter more than finishing:

- A build is not a purchase. Say which you did.
- Never report a cell green without a passing command or a concrete device
  result you observed.
- A cell you could not run is `BLOCKED` with the reason, never omitted and never
  guessed.
- If a build fails, fix it if the fix is obvious and in scope, then rerun; if
  not, report the failure with its output.
