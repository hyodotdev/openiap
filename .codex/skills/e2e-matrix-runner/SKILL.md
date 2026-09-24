---
name: e2e-matrix-runner
description: Run the full OpenIAP device matrix — six frameworks across iOS, Google Play, Amazon Appstore, Meta Horizon, and VegaOS — driving real hardware over adb and xcrun, and report one row per cell with evidence. Use when asked for a full e2e matrix, a device regression across every framework and store, or delegated hardware testing.
---

# E2E Matrix Runner

Run every cell of the matrix below on real hardware and report a row for each.
`.claude/commands/e2e-tests.md` is the authority on what a row means and how to
verify one; read it before starting and follow it. This file adds only what a
delegated agent needs: the matrix, the devices, and the rules for reporting.

## The matrix (pinned scope — do not renegotiate per run)

Six frameworks: `react-native-iap`, `expo-iap`, `flutter_inapp_purchase`,
`kmp-iap`, `maui-iap`, `godot-iap`, plus the native `packages/google`
(Android) and `packages/apple` (iOS) rows.

| Store        | Frameworks                         | Device            | Depth                        |
| ------------ | ---------------------------------- | ----------------- | ---------------------------- |
| iOS          | all six + `packages/apple`         | iPhone (physical) | device purchase flow each    |
| Google Play  | all six + `packages/google`        | Pixel             | device purchase flow each    |
| Amazon       | all six + `packages/google`        | Fire tablet       | device purchase flow each    |
| Meta Horizon | all six + `packages/google`        | Quest 3           | build + install + launch; purchase only when the checkout UI is visibly test/sandbox |
| VegaOS       | react-native-iap and expo-iap only | Vega device       | build + install + launch; purchase attempt when device input allows |

That is 7 iOS + 21 Android/Horizon + 2 VegaOS cells. Do not silently drop a
cell. Known exceptions, reported as `UNSUPPORTED` with the reason, never
omitted: Godot has no Horizon flavor in its Android plugin, so the
Godot/Horizon cell cannot build.

## Standing approvals for E2E runs

- Sandbox/test purchases on Play, Amazon, and iOS are pre-approved: tap the
  purchase sheet, type the pinned sandbox password below, and finish the
  transaction without asking.
- Horizon checkout is real money: take the `Confirm` tap only when its UI is
  visibly marked test or sandbox. Otherwise report build + launch coverage.
- VegaOS: run at least one purchase attempt when device input and tester UI
  are available.

## Devices attached to this machine

Discover them rather than trusting this list, with `adb devices -l` and
`xcrun devicectl list devices`. At the time of writing:

| Role        | Serial / UDID               |
| ----------- | --------------------------- |
| Pixel       | `HT79F1A00473`              |
| Fire tablet | `GN43T503515200BA`          |
| Quest 3     | `2G0YC5ZG480381`            |
| Vega device | `G0733M085512021G`          |
| iPhone      | `00008110-0004081E1A79801E` |

The iPhone UDID has changed mid-session before (re-enumeration); re-check it
after any `device was not found` error instead of retrying the stale id. The
Mac's LAN address (the iPhone's IAPKit/Metro origin) also changes between
networks — confirm with `ipconfig getifaddr en1` (fallback `en0`) each run.

Every example shares the application id `dev.hyo.martie`, so only one framework
can be installed at a time per device. Uninstall before installing the next, and
expect `INSTALL_FAILED_UPDATE_INCOMPATIBLE` when signing keys differ. This
applies to iOS too: all six example apps share the bundle id, so install,
purchase, and move to the next framework strictly one at a time.

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
and still returns display 0.

Verified limitation (Quest 3, Horizon OS, scrcpy 3.x): touch injection on the
virtual display is silently ignored — `adb shell input -d N tap`, explicit
`input touchscreen -d N tap`, and monkey-script `tap(x,y)` all leave the frame
bit-identical (compare md5 before/after). Key events (`input -d N keyevent`)
do reach the app, which is enough for an RN redbox `R,R` reload but not for
navigating product UI. Do not burn the run re-proving this; one md5-compare
per OS upgrade is enough.

Consequences: drive each Horizon app as install + launch + render-screenshot
(launch with `am start --display N -n <launcher-activity>`, resolving the
activity per framework — Flutter uses
`io.flutter.embedding.android.FlutterActivity`, MAUI a `crc...MainActivity`).
RN/Expo debug builds need their Metro (`adb reverse tcp:8081`, one packager at
a time) and a cold start if the first bundle load stalls on black. Moving the
app to display 0 does not help: 2D apps land in VR panels (`mHasSurface=false`)
and `uiautomator dump` fails with `null root node`. Report in-app
connect/fetch/purchase as `BLOCKED: no touch injection on Quest virtual
display` with the launch screenshot as the install/launch evidence. The
`com.oculus.store/.IAPActivity` display-0 dialog path stays valid only if a
purchase can be triggered at all — without input it cannot, so Horizon
purchase cells are `BLOCKED` by default, never guessed.

**iOS.** Build with `xcodebuild -destination "id=$UDID"`, install with
`xcrun devicectl device install app`, launch with
`xcrun devicectl device process launch`. Never use iPhone Mirroring for
debugging or purchases: the phone stays in the user's hand, and Mirror refuses
to connect while it is in use. Drive the physical iPhone directly instead.

A physical iPhone _can_ be driven, through XCUITest. Build a UI-test bundle once
and point it at any installed app with `XCUIApplication(bundleIdentifier:)`, then
run it with `xcodebuild test-without-building -xctestrun`, passing the flow in
environment variables so one signed runner serves every framework. Without an
Xcode account, build with `CODE_SIGNING_ALLOWED=NO` and hand-sign the runner and
its nested `.xctest` with a wildcard development profile.

Shortcut when the custom runner is not at hand: `maestro-runner` drives a
physical iPhone over its bundled WebDriverAgent with Maestro YAML flows as-is.
Verified working on this machine (Korea's iPhone, iOS 27, team PRDQGB267K):

```bash
export PATH="$HOME/.maestro-runner/bin:$PATH"
maestro-runner --platform ios --device "$IOS_UDID" --team-id PRDQGB267K \
  test flow.yaml
```

Rules for this path, all verified the hard way:

- Do NOT pass `--wda-bundle-id`: a custom bundle forces a rebuild that fails
  signing (`No Accounts`, stale wildcard profile). The default bundle reuses
  the good cache under `~/.maestro-runner/cache/wda-builds/`.
- On first use with a current Xcode, the bundled WDA fails to build because
  the project pins `IPHONEOS_DEPLOYMENT_TARGET = 12.0` (below Xcode's 15.0
  floor). Patch once in the user-local checkout and rerun:
  `sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = 12\.0/IPHONEOS_DEPLOYMENT_TARGET = 15.0/g' ~/.maestro-runner/drivers/ios/WebDriverAgent/WebDriverAgent.xcodeproj/project.pbxproj`
- `takeScreenshot` only saves plain filenames (`shot.png` lands under the
  run's `assets/` dir). Absolute paths like `/tmp/x.png` fetch fine over WDA
  but fail to save (`no such file or directory`) while the step still passes —
  a silent evidence loss. Always confirm the PNG exists before claiming a
  visual check.
- A flow `test/...` writes `reports/<timestamp>/` with `report.json`
  (`status: passed`), `junit-report.xml`, and per-command assets. The suite
  exit code is unreliable alone; read `report.json` for the verdict.

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

## Credentials (pinned — standing user override)

The TestFlight/sandbox Apple Account password is pinned: `Password12!`. When a
sandbox purchase sheet asks for it, type it and continue the cell without
asking. This is a shared test account, so no redaction or secrecy handling is
needed in transcripts, logs, or screenshots.

What stays human-only: the device passcode for _Enable UI Automation_, the
hardware side-button double-click, a parental-control PIN, and any real-money
Horizon checkout. If one of those blocks a cell, report it as
`BLOCKED: needs <which>` and keep going. Never invent or reuse the pinned
password for any other account.

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
