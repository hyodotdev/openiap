import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';

function MauiSetup() {
  return (
    <div className="doc-page">
      <SEO
        title=".NET MAUI Setup"
        description="Install and configure maui-iap for in-app purchases in .NET MAUI / C# 12 projects."
        path="/docs/setup/maui"
        keywords="maui-iap, .NET MAUI, C#, dotnet, in-app purchase, NuGet, OpenIap.Maui"
      />
      <h1>.NET MAUI Setup</h1>
      <p>
        <code>maui-iap</code> is the .NET MAUI projection of OpenIAP. Install
        the single NuGet package, connect to the store, fetch products, listen
        for purchase events, then finish transactions after your server has
        verified them.
      </p>

      <div className="alert-card alert-card--info">
        <p>
          <strong>Package shape:</strong> apps reference only{' '}
          <code>OpenIap.Maui</code>. The Android binding, iOS binding, Google
          Play Billing AARs, and StoreKit xcframework resources are flattened
          into that package, so NuGet consumers do not add separate binding
          packages or <code>NativeReference</code> entries.
        </p>
      </div>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Before you start:</strong> create the products in App Store
          Connect and Google Play Console first. The product IDs in your MAUI
          app must exactly match the store product IDs.
        </p>
        <p>
          Platform setup guides: <a href="/docs/ios-setup">iOS Setup</a> |{' '}
          <a href="/docs/android-setup">Android Setup</a>
        </p>
      </div>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>.NET</strong>
              </td>
              <td>
                .NET 9 SDK and the MAUI workload:{' '}
                <code>dotnet workload install maui</code>
              </td>
            </tr>
            <tr>
              <td>
                <strong>iOS / macCatalyst</strong>
              </td>
              <td>
                iOS 15+ / macCatalyst 15+, Apple Developer account, matching
                bundle identifier, In-App Purchase capability, sandbox tester
              </td>
            </tr>
            <tr>
              <td>
                <strong>Android</strong>
              </td>
              <td>
                Android API 24+, Google Play Developer account, matching package
                name, license tester, uploaded build on a test track
              </td>
            </tr>
            <tr>
              <td>
                <strong>Device</strong>
              </td>
              <td>
                Use a physical device for real purchase testing. Simulators and
                emulators are useful for UI checks, but store purchase support
                is limited.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 id="installation" className="anchor-heading">
          Installation
          <a href="#installation" className="anchor-link">
            #
          </a>
        </h2>
        <p>Add the package to your MAUI app project:</p>
        <CodeBlock language="bash">
          {`dotnet add package OpenIap.Maui --version 1.0.0`}
        </CodeBlock>
        <p>
          Or add it directly to your app's <code>.csproj</code>:
        </p>
        <CodeBlock language="xml">
          {`<ItemGroup>
  <PackageReference Include="OpenIap.Maui" Version="1.0.0" />
</ItemGroup>`}
        </CodeBlock>

        <div className="alert-card alert-card--info">
          <p>
            <strong>Working from this monorepo before publishing?</strong> Use a
            project reference to the main project only. The example app
            re-declares local native references because MSBuild does not
            propagate those transitively through <code>ProjectReference</code>.
            Published NuGet consumers do not need that.
          </p>
          <CodeBlock language="xml">
            {`<ProjectReference Include="path/to/openiap/libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj" />`}
          </CodeBlock>
        </div>
      </section>

      <section>
        <h2 id="project-configuration" className="anchor-heading">
          Project Configuration
          <a href="#project-configuration" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="target-frameworks" className="anchor-heading">
          Target Frameworks
          <a href="#target-frameworks" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Include the platforms you ship in your MAUI app's{' '}
          <code>TargetFrameworks</code>:
        </p>
        <CodeBlock language="xml">
          {`<TargetFrameworks>net9.0-ios;net9.0-android;net9.0-maccatalyst</TargetFrameworks>

<SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'ios'">15.0</SupportedOSPlatformVersion>
<SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'maccatalyst'">15.0</SupportedOSPlatformVersion>
<SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'android'">24.0</SupportedOSPlatformVersion>`}
        </CodeBlock>

        <h3 id="ios-config" className="anchor-heading">
          iOS / macCatalyst
          <a href="#ios-config" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Set the app's bundle identifier to the same value you configured in
            App Store Connect.
          </li>
          <li>
            Enable <strong>In-App Purchase</strong> in Signing &amp;
            Capabilities for the app identifier and provisioning profile.
          </li>
          <li>
            Sign into the device with a sandbox tester when testing App Store
            purchases.
          </li>
        </ul>

        <h3 id="android-config" className="anchor-heading">
          Android
          <a href="#android-config" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Set the Android package name to the same package configured in Play
            Console.
          </li>
          <li>
            Add the Play Billing permission to{' '}
            <code>Platforms/Android/AndroidManifest.xml</code>.
          </li>
          <li>
            Upload a build with the same package name and signing lineage to an
            internal or closed test track before testing purchases.
          </li>
        </ul>
        <CodeBlock language="xml">
          {`<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="com.android.vending.BILLING" />
</manifest>`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="usage" className="anchor-heading">
          Usage
          <a href="#usage" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="initialize" className="anchor-heading">
          Initialize and Fetch Products
          <a href="#initialize" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Use <code>Iap.Instance</code> as the entry point. Cast it to the
          generated resolver interfaces when calling query or mutation APIs.
        </p>
        <CodeBlock language="csharp">
          {`using OpenIap;
using OpenIap.Maui;

var iap = Iap.Instance;
var query = (QueryResolver)iap;
var mutate = (MutationResolver)iap;

await mutate.InitConnectionAsync();

var result = await query.FetchProductsAsync(new ProductRequest
{
    Skus = new[] { "premium", "coins_100" },
    Type = ProductQueryType.InApp,
});

var products = result is FetchProductsResultProducts { Value: { } list }
    ? list
    : Array.Empty<Product>();`}
        </CodeBlock>

        <h3 id="listen-before-purchase" className="anchor-heading">
          Listen Before Requesting a Purchase
          <a href="#listen-before-purchase" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Purchase APIs are event-based. Register listeners before calling{' '}
          <code>RequestPurchaseAsync</code>, then finish the transaction only
          after server-side verification succeeds.
        </p>
        <CodeBlock language="csharp">
          {`IDisposable purchaseSub = iap.PurchaseUpdated.Subscribe(async purchase =>
{
    bool verified = await VerifyOnServerAsync(purchase);
    if (!verified) return;

    await mutate.FinishTransactionAsync(
        purchase: new PurchaseInput(purchase),
        isConsumable: true);

    GrantEntitlement(purchase.ProductId);
});

IDisposable errorSub = iap.PurchaseError.Subscribe(error =>
{
    Console.WriteLine($"{error.Code}: {error.Message}");
});

await mutate.RequestPurchaseAsync(new RequestPurchaseProps
{
    Type = ProductQueryType.InApp,
    RequestPurchase = new RequestPurchasePropsByPlatforms
    {
        Apple = new RequestPurchaseIosProps
        {
            Sku = "coins_100",
            Quantity = 1,
        },
        Google = new RequestPurchaseAndroidProps
        {
            Skus = new[] { "coins_100" },
        },
    },
});`}
        </CodeBlock>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Do not skip finishing transactions.</strong> On Android,
            unfinished purchases are refunded automatically after 3 days. On
            iOS, unfinished transactions can be delivered again on the next app
            launch.
          </p>
        </div>

        <h3 id="iapkit-api-webhooks" className="anchor-heading">
          IAPKit API and Webhooks
          <a href="#iapkit-api-webhooks" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          The MAUI package exposes the same IAPKit helper surface as the
          JavaScript SDKs: create a kit client for status, entitlements, and
          bind-user calls, and open the webhook SSE stream from the library
          instead of hand-rolling the HTTP stream in the app.
        </p>
        <CodeBlock language="csharp">
          {`using OpenIap;
using OpenIap.Maui;

var kit = Iap.KitApi(new KitApiOptions
{
    ApiKey = "<iapkit-api-key>",
    BaseUrl = "https://kit.openiap.dev",
});

StatusResponse status = await kit.StatusAsync("user_123");
EntitlementsResponse entitlements = await kit.EntitlementsAsync("user_123");
BindUserResponse bind = await kit.BindUserAsync(purchase.PurchaseToken!, "user_123");

using WebhookListener listener = Iap.ConnectWebhookStream(new WebhookListenerOptions
{
    ApiKey = "<iapkit-api-key>",
    OnEvent = webhookEvent => Console.WriteLine(webhookEvent.Type),
    OnError = error => Console.WriteLine($"{error.Code}: {error.Message}"),
});

ParsedWebhookEventResult parsed = Iap.ParseWebhookEventData(rawSseData);`}
        </CodeBlock>

        <h3 id="cleanup" className="anchor-heading">
          Cleanup
          <a href="#cleanup" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Dispose subscriptions and close the store connection when the page or
          service that owns the purchase flow is torn down.
        </p>
        <CodeBlock language="csharp">
          {`purchaseSub.Dispose();
errorSub.Dispose();

await mutate.EndConnectionAsync();`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="example" className="anchor-heading">
          Example App
          <a href="#example" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          The reference app lives at{' '}
          <code>libraries/maui-iap/example/OpenIap.Maui.Example</code>. It
          mirrors the Expo example screens: Home, All Products, In-App Purchase
          Flow, Subscription Flow, Available Purchases, Offer Code, Alternative
          Billing, and Webhook Stream.
        </p>
        <CodeBlock language="bash">
          {`# From the OpenIAP repo root:
(cd packages/google && ./gradlew :openiap:assemblePlayRelease)
(cd libraries/maui-iap/android && ../../../packages/google/gradlew :openiap:assembleRelease)

cd libraries/maui-iap/example/OpenIap.Maui.Example

# Android device or emulator
adb uninstall dev.hyo.martie || true
dotnet build -t:Run -f net9.0-android

# iOS device or simulator
dotnet build -t:Run -f net9.0-ios

# macCatalyst
dotnet build -t:Run -f net9.0-maccatalyst`}
        </CodeBlock>
        <p>
          VS Code launch configurations are available in{' '}
          <code>libraries/maui-iap/.vscode/launch.json</code>. The iOS device
          launcher auto-selects a connected USB device when one is available,
          and the Android launcher builds both Android AARs before uninstalling
          and rebuilding the example app so stale APKs do not keep old
          BillingClient code.
        </p>
      </section>

      <section>
        <h2 id="troubleshooting" className="anchor-heading">
          Troubleshooting
          <a href="#troubleshooting" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="products-not-loading" className="anchor-heading">
          Products Do Not Load
          <a href="#products-not-loading" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Confirm the store product IDs exactly match the IDs passed in{' '}
            <code>ProductRequest.Skus</code>.
          </li>
          <li>
            Confirm the bundle identifier or Android package name matches the
            store app record.
          </li>
          <li>
            On Android, install a build from a Play test track or a locally
            signed build that matches the uploaded app and tester account.
          </li>
          <li>
            On iOS, test on a device signed with a profile that includes the
            In-App Purchase capability.
          </li>
        </ul>

        <h3 id="google-play-not-configured" className="anchor-heading">
          Android Billing Not Configured
          <a href="#google-play-not-configured" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          If Google Play shows "This version of the application is not
          configured for billing through Google Play", the library reached
          BillingClient correctly. The app build is not accepted by Play Billing
          for that package, signing key, track, tester, or product setup yet.
        </p>

        <h3 id="old-billing-client" className="anchor-heading">
          Android Old BillingClient Error
          <a href="#old-billing-client" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          If Android reports a missing{' '}
          <code>enableAutoServiceReconnection</code> method, uninstall the stale
          APK and rebuild with the current package. That error means an older
          BillingClient was still present in the installed app.
        </p>
        <CodeBlock language="bash">
          {`adb uninstall dev.hyo.martie || true
dotnet clean
dotnet build -t:Run -f net9.0-android`}
        </CodeBlock>

        <h3 id="build-lock" className="anchor-heading">
          Android Build File Lock
          <a href="#build-lock" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          <code>XABLD7024</code> usually means a previous MAUI build or deploy
          process still holds a generated file under <code>obj/</code>. Stop the
          running app, close duplicate <code>dotnet build</code> processes, then
          clean the example project before rebuilding.
        </p>

        <h3 id="ios-connecting" className="anchor-heading">
          iOS Stays on Connecting
          <a href="#ios-connecting" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Verify the app is running on a signed device build with the matching
          bundle identifier and In-App Purchase capability. If you navigate away
          from a purchase screen, call <code>EndConnectionAsync</code> from the
          owning page or lifecycle service so the next screen can initialize a
          fresh store connection.
        </p>
      </section>

      <section>
        <h2 id="next-steps" className="anchor-heading">
          Next Steps
          <a href="#next-steps" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <a href="/docs/features/purchase">Purchase Guide</a> - complete
            purchase flow, verification, and transaction finishing
          </li>
          <li>
            <a href="/docs/features/subscription">Subscription Guide</a> -
            subscriptions, offers, renewals, and management
          </li>
          <li>
            <a href="/docs/errors">Error Codes</a> - normalized OpenIAP errors
          </li>
          <li>
            <a href="/docs/apis">API Reference</a> - generated API reference
          </li>
          <li>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/maui-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Source
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default MauiSetup;
