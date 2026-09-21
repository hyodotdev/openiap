# Flutter In-App Purchase Example

Example app demonstrating the usage of `flutter_inapp_purchase` plugin.

## Quick Start

```bash
# Run on any device (uses Google Play Billing by default)
flutter run

# Build release APK
flutter build apk --release
```

## Purchase verification

Pass these as `--dart-define`, which overrides the bundled `env.example`:

| Key                  | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `IAPKIT_API_KEY`     | `openiap-kit_pk_` publishable key, never an `sk_` key. |
| `IAPKIT_BASE_URL`    | Origin of a local IAPKit server; empty uses the host.  |
| `AMAZON_RVS_SANDBOX` | `true` for Amazon App Tester receipts.                 |

```bash
flutter run \
  --dart-define=IAPKIT_API_KEY=openiap-kit_pk_... \
  --dart-define=IAPKIT_BASE_URL=http://127.0.0.1:3100
```

`env.example` is the only declared asset, so it is the only file the bundle
carries; keep real keys out of it. A define wins even when its value is empty,
so `--dart-define=IAPKIT_BASE_URL=` forces the hosted server.
`IAPKIT_BASE_URL` is an origin, not the verify path. For **Local (IAPKit)** the key and the local
server must target the same Convex deployment. An Android device on USB reaches
the host through
`adb -s "$ANDROID_SERIAL" reverse --no-rebind tcp:3100 tcp:3100` and
`http://127.0.0.1:3100`; a physical iPhone needs the Mac's LAN address. Debug
builds permit cleartext to loopback only; iOS allows cleartext to local-network hosts and bare IPs in every configuration, which is what the LAN flow needs.

The purchase screen lists verification in this order:

1. **Ignore** — skip verification.
2. **Local (Device)** — Apple-only; on Android it reports that server-side
   verification needs an OAuth token the example does not carry.
3. **Local (IAPKit)** — IAPKit routed to `IAPKIT_BASE_URL`.
4. **IAPKit** — hosted IAPKit; the local URL is deliberately omitted.

The subscription screen offers **Ignore**, **Local (IAPKit)**, and **IAPKit**.
It omits Local (Device) because renewal state comes from
`purchases.subscriptionsv2.get` server-side, which the device cannot answer.

With both values configured, the example defaults to **Local (IAPKit)**. With
only the key, it defaults to **IAPKit**; without a key, it defaults to
**Ignore**.

## Building with Different Billing Platforms

This example supports multiple billing platforms:

- **Google Play Billing** (default)
- **Meta Horizon Billing** (for Meta Quest devices)
- **Fire OS IAP** (Amazon Appstore distribution)
- **No Android billing SDK** (for Apple-only IAP apps)

### Google Play (Default)

No configuration needed! Just build and run:

```bash
flutter run
flutter build apk --release
```

### Meta Horizon (Meta Quest)

To use Meta Horizon billing:

1. **Enable Horizon** in `android/gradle.properties`:

   ```properties
   horizonEnabled=true
   ```

2. **Add Horizon App ID** to `android/local.properties`:

   ```properties
   HORIZON_APP_ID=your_horizon_app_id_here
   ```

3. **Run on Quest**:
   ```bash
   flutter run -d Quest
   flutter build apk --release
   ```

**No flavor specification needed!** The build system automatically selects the correct billing platform based on `horizonEnabled` or `fireOsEnabled`.

### Fire OS

To use Fire OS IAP through the Amazon Appstore SDK:

1. **Enable Fire OS** in `android/gradle.properties`:

   ```properties
   fireOsEnabled=true
   ```

2. **Keep Horizon disabled** in the same build:

   ```properties
   horizonEnabled=false
   ```

3. **Test with Amazon App Tester** on a Fire OS or compatible Android test device:

   ```bash
   flutter run
   flutter build apk --release
   ```

The build system automatically selects the Fire OS `amazon` flavor based on
`fireOsEnabled`.

### No Android IAP

To keep the Flutter package for iOS or macOS while excluding Android store
SDKs, set this in `android/gradle.properties`:

```properties
openiapPlatform=none
```

Run `flutter clean` before rebuilding after changing this property.

`openiapPlatform=none` cannot be combined with `horizonEnabled` or
`fireOsEnabled`; disable both legacy store flags first, or the Android build
fails with `openiapPlatform=none conflicts with legacy store flags`.

`initConnection()` then returns `false`, and Android store operations report
`ErrorCode.IapNotAvailable`. The APK contains no Play Billing, Horizon, or
Amazon IAP SDK dependency, and no billing manifest entry supplied by those
SDKs.

## IDE Configuration

### Android Studio

Just click **Run** - the build system automatically selects the right platform based on `horizonEnabled` or `fireOsEnabled` in `gradle.properties`.

### VS Code

Press F5 or click **Start Debugging** - works out of the box!

## Testing

- **Google Play**: Test on any Android device with Google Play Store (default)
- **Meta Horizon**: Set `horizonEnabled=true` and test on Meta Quest devices
- **Fire OS**: Set `fireOsEnabled=true` and test with Amazon App Tester
