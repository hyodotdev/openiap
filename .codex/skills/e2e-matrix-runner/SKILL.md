---
name: e2e-matrix-runner
description: Run the full OpenIAP device matrix — six frameworks across iOS, Google Play, Amazon Appstore, Meta Horizon, and VegaOS — driving real hardware over adb and xcrun, and report one row per cell with evidence. Use when asked for a full e2e matrix, a device regression across every framework and store, or delegated hardware testing.
---

# E2E Matrix Runner

Run every cell of the matrix below on real hardware and report a row for each.
`.claude/commands/e2e-tests.md` owns what a row means and how to verify one:
preflight, build and install commands, and VegaOS device setup. Read it before
starting and follow it. This file owns how a delegated agent runs the matrix:
the devices, driving them, builds, local receipt verification, credentials, and
reporting.

For a parallel run, delegate `$e2e-matrix-runner-google` (Play, Amazon,
Horizon, VegaOS) and `$e2e-matrix-runner-apple` (iOS) instead; both follow
this file's techniques and reporting contract on their narrowed scope.

## The matrix (pinned scope — do not renegotiate per run)

Six frameworks: `react-native-iap`, `expo-iap`, `flutter_inapp_purchase`,
`kmp-iap`, `maui-iap`, `godot-iap`, plus the native `packages/google`
(Android) and `packages/apple` (iOS) rows.

| Store        | Frameworks                         | Device            | Depth                                                                                                             |
| ------------ | ---------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| iOS          | all six + `packages/apple`         | iPhone (physical) | device purchase flow each                                                                                         |
| Google Play  | all six + `packages/google`        | Play phone        | device purchase flow each                                                                                         |
| Amazon       | all six + `packages/google`        | Fire tablet       | device purchase flow each                                                                                         |
| Meta Horizon | all six + `packages/google`        | Quest 3           | build + install + launch + normal checkout navigation; apply the canonical Horizon payment gate before confirming |
| VegaOS       | react-native-iap and expo-iap only | Vega device       | build + install + launch; purchase attempt when device input allows                                               |

That is 7 iOS + 21 Android/Horizon + 2 VegaOS cells. Do not silently drop a
cell.

## Standing approvals for E2E runs

- Sandbox/test purchases on Play, Amazon, and iOS are pre-approved: tap the
  purchase sheet, type the pinned sandbox password below, and finish the
  transaction without asking.
- Horizon: follow **Horizon Test Accounts and Payments** in
  `.claude/commands/e2e-tests.md`. Use verified test payments; a real purchase
  requires explicit user authorization. Report checkout and completion separately.
- VegaOS: run at least one purchase attempt when device input and tester UI
  are available.

## Devices attached to this machine

Discover them rather than trusting this list, with `adb devices -l` and
`xcrun devicectl list devices`. `adb` lists the Vega device too, with no
product or model; drive that one only through `vega` and `kepler`. At the time
of writing:

| Role        | Serial / UDID               |
| ----------- | --------------------------- |
| Play phone  | `R3CW80G1ZCX` (Samsung)     |
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
screenshot before every tap; do not tap coordinates from memory. With several
devices attached, a debug build follows only the device `ANDROID_SERIAL` names
and otherwise links Play, so build each cell with it set to that cell's device
and check the store line before installing, as the
`## Android Store Selection` section of `.claude/commands/e2e-tests.md` shows.

**Quest.** `screencap` returns black because Quest blocks capture of the VR
compositor. Do not conclude the device is undriveable. Drive the display-0 VR
panel directly: `adb -s $QUEST shell input tap X Y` reaches the panel, and
`adb -s $QUEST shell uiautomator dump` exposes the accessibility tree with
text and bounds — dump, tap the dumped coordinates, dump again. `tap`, `swipe`,
and `keyevent` (BACK dismisses the Horizon checkout dialog) are all verified
working on display 0 (Quest 3, Horizon OS, 2026-09-25: RN RedBox dismissed,
Kepler home → Purchase Flow navigated, MAUI scrolled to products, Purchase
tapped into `com.oculus.store` checkout and BACKed out cleanly). Before a
Horizon checkout, clear the VR keyguard picker and any stale checkout dialog
as the Horizon checkout notes under `## Full Regression Matrix` in
`.claude/commands/e2e-tests.md` describe.

```bash
adb -s "$QUEST" shell am start -n <launcher-activity>  # resolve per framework
adb -s "$QUEST" shell uiautomator dump /sdcard/ui.xml
adb -s "$QUEST" pull /sdcard/ui.xml .
adb -s "$QUEST" shell input tap X Y  # coordinates from the dump
```

Resolve the launcher activity per framework (`cmd package resolve-activity
--brief ...`, or `monkey -p <pkg> -c android.intent.category.LAUNCHER 1`):
Flutter uses `io.flutter.embedding.android.FlutterActivity`, MAUI a
`crc...MainActivity`. RN/Expo debug builds need their Metro
(`adb reverse tcp:8081`, one packager at a time) and a cold start if the
first bundle load stalls. If Metro serves a stale graph (same RedBox after
an entry change, or a 500 `Got unexpected undefined`), restart it with
`--reset-cache`. When the panel is empty right after launch, wait for the JS
bundle (RN shows 6 bare nodes until loaded); a transient `null root node`
from the dump usually clears on retry.

For canvas-only apps whose accessibility tree has no controls, use the
virtual-display capture and input procedure in `.claude/commands/e2e-tests.md`.
Derive taps from the captured frame and verify the resulting UI change. Touch
support varies by device and app; a past ignored tap does not establish the
current run's capability. Key events can provide visible focus navigation when
touch is unavailable.

Consequences: drive each Horizon app as install + launch + navigate + tap to
the purchase gate. The `com.oculus.store` checkout dialog renders its full
text into the dump (product, total, payment method, Confirm), so the canonical
payment gate can be checked without screenshots. A build that linked
Play instead of Horizon fails earlier with Play's own error (RN-IAP:
`initConnection failed ... responseCode -1`, no Play Store on Horizon OS); its
store line says `store=play`, so rebuild for the Quest. Report any other store
error exactly, not as a generic input block. Record verified checkout navigation
even when payment cannot proceed; mark the missing completion step `BLOCKED`.

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

**VegaOS.** Set up, install, and record app state as `## VegaOS Device Checks`
in `.claude/commands/e2e-tests.md` shows. Purchase evidence is the log stream
and App Tester's transaction table.

- Drive the remote with
  `vega exec vda -s "$VEGA_DEVICE_ID" shell inputd-cli button_press KEY_DOWN`
  (also `KEY_UP`, `KEY_LEFT`, `KEY_RIGHT`, `KEY_ENTER`, `KEY_BACK`). Confirm
  each step in the log stream: `[KeplerScript-JavaScript]` lines are the app's
  console, and `purchase.core` lines are the store.
- Keep the device awake. Idle, it starts the screensaver and then goes to
  standby (`display_off` in the log), which looks like the device switching
  itself off. Send `inputd-cli button_press KEY_LEFTSHIFT` every 45 seconds (a
  modifier moves no focus), pause it while a checkout is open, and stop it
  when you finish.
- Free memory before each purchase. The device has about 1 GB and App Tester
  takes the foreground at checkout; when memory runs out the example vanishes
  mid-purchase and `lcm_service` logs `memory-high` or `memory-critical`. In
  this order:
  1. Install the Release package, as `## VegaOS Device Checks` says.
  2. Keep one example installed: `vpm uninstall` the other example and any
     probe build before installing the next.
  3. Stop background apps with
     `vega exec vda -s "$VEGA_DEVICE_ID" shell vlcm terminate-app --pkg-id <id> --force`:
     `com.netflix.kepler`, `com.amazon.appstorevegatv`,
     `com.amazon.screensaver`, `com.amazon.smplighthouse.launcher`. The OS
     may restart them.
  4. Only if a purchase still fails for memory after steps 1 to 3: uninstall
     apps the maintainer installed. This is a standing permission. Never remove
     a system or preinstalled package, or App Tester, and list every removed
     package in the report so it can be reinstalled.
- Before each purchase, confirm App Tester holds no unfulfilled transaction.
  With one, it refuses the next purchase with "a previous purchase has not been
  fulfilled", and the log says `Unfulfilled Transactions are present` and
  `Navigating to MESSAGE_SCREEN`. That screen is neither a PIN prompt nor a
  catalog error: an earlier purchase was never verified, usually for the
  missing reverse mapping in `## Local receipt verification`. Restore the
  route, relaunch the example, and open Purchase Flow; its recovery verifies
  and fulfils the leftover. Do not delete the Vega device's tester rows by hand.
  Read the table while App Tester is running (use
  `com.amazon.iap.tester.service` when its UI component is not):

  ```bash
  vega exec vda -s "$VEGA_DEVICE_ID" shell -c com.amazonappstore.iap.tester.ui \
    'base64 /data/Transactions.db' 2>/dev/null |
    grep -E '^[A-Za-z0-9+/=]+$' | base64 -d > tester.db
  sqlite3 tester.db \
    "select count(*) from Transactions where FULFILLMENT_RESULT != 'FULFILLED'"
  ```

- A purchase passes when the local server logs `isValid: true`, the app grants
  it, and the log shows `notifyFulfillment` `SUCCESSFUL` with the tester row
  `FULFILLED`. If the device killed the example during checkout, relaunch it:
  a purchase its recovery then verifies and fulfils still passes, with the
  kill recorded.
- If the shell and input stop answering while USB still lists the device, and
  the last log lines show a `lifecycle-manager.service` watchdog timeout, the
  device is frozen. Stop sending input, which cannot recover it, and ask the
  maintainer to restart it. A restart drops the reverse mapping, so run the
  pre-purchase checks again.

## Builds

- Run device builds one at a time and give each up to 90 minutes. On a loaded
  machine a cold React Native, Expo, or KMP iOS build runs past 20 minutes
  without an error; a build that is still compiling is not `BLOCKED`. Reuse the
  previous build output and DerivedData.
- In a parallel run, embed the JS bundle so no half needs Metro. Android: pass
  Gradle an init script outside the repository containing
  `allprojects { p -> p.plugins.withId('com.facebook.react') { p.extensions.getByName('react').debuggableVariants.set([]) } }`.
  iOS: build Release; Expo's Debug build with an embedded bundle fails at
  startup on its devtools WebSocket.
- `Waiting for Watchman watch-project` repeating, then
  `createBundleDebugJsAndAssets` exiting 143, or an iOS bundling step that goes
  silent: Watchman is stuck. Bundle with a Metro config outside the repository
  that loads the example's config and sets `resolver.useWatchman = false`;
  leave the shared Watchman alone while another session builds.
- Gradle `... is located outside the root directory`: the project's
  `.gradle/<version>/executionHistory` was written under another path to this
  checkout. Move that directory aside and rebuild.

## Local receipt verification

Rows verify against a local IAPKit server, not the hosted one. When
`curl -s http://127.0.0.1:3100/health` already answers, reuse that server only
when you know it was built from the revision under test (you or the briefing
session started it from this checkout after the last code change); otherwise
ask its owner, or start your own on another port. Leave a reused server
running; only the session that started a server stops it. Otherwise
start it from `packages/kit` as `.claude/commands/e2e-tests.md` describes. Give
each Android device `adb -s <serial> reverse --no-rebind tcp:3100 tcp:3100`
and the Vega device
`vega exec vda -s "$VEGA_DEVICE_ID" reverse --no-rebind tcp:3100 tcp:3100`,
and point the example at `http://127.0.0.1:3100`; a physical iPhone needs the
Mac's LAN address instead. **Re-check the reverse mapping (`reverse --list`)
immediately before each purchase** — it is gone after a reconnect or a device
restart, and the symptom is a verification failure that looks like a code bug:
the store purchase succeeds, the app reports `Network connection error`, and
the transaction stays unfinished. On Vega,
`vega exec vda -s "$VEGA_DEVICE_ID" shell curl -s --max-time 5 http://127.0.0.1:3100/health`
proves the route from the device side.

Each example bakes its IAPKit base URL and Amazon sandbox flag in at build
time, from the untracked local config its README names. Check both before
building; a leftover value fails only after the store purchase went through.

- A LAN address in an Android build, or loopback in an iPhone build, gives the
  same `Network connection error`. MAUI takes
  `-p:IapkitBaseUrl=http://127.0.0.1:3100` on the build.
- Under Amazon App Tester the sandbox flag must be true, or the server answers
  `INAUTHENTIC` for a real tester receipt: `amazon_rvs_sandbox=true` in Godot's
  `Example/iapkit.cfg`, `-p:AmazonRvsSandbox=true` for MAUI, and the
  `AMAZON_RVS_SANDBOX` value in the other examples' env files.

A row passes only when the server logs a matching `verify_request` with
`isValid: true` and the app finishes the transaction. Record the `corrId`.

## Credentials (pinned — standing user override)

The TestFlight/sandbox Apple Account password is pinned: `Password12!`. When a
sandbox purchase sheet asks for it, type it and continue the cell without
asking. This is a shared test account, so no redaction or secrecy handling is
needed in transcripts, logs, or screenshots.

What stays human-only: the device passcode for _Enable UI Automation_, the
hardware side-button double-click, and a parental-control PIN. Horizon payment
approval follows the canonical payment gate above. If a human-only step blocks a cell, report it as
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
