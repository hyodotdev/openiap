import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';

function MauiSetup() {
  return (
    <div className="doc-page">
      <SEO
        title=".NET MAUI Setup"
        description="Install and configure maui-iap for in-app purchases in .NET MAUI / C# 12 projects."
        path="/docs/setup/maui"
        keywords="maui-iap, .NET MAUI, C#, dotnet, in-app purchase, NuGet, Hyo.OpenIap.Maui"
      />
      <h1>.NET MAUI Setup</h1>
      <p>
        <code>maui-iap</code> (NuGet: <code>Hyo.OpenIap.Maui</code>) ships
        in-app purchase support to .NET MAUI projects. It mirrors the OpenIAP
        spec used by <code>react-native-iap</code>, <code>expo-iap</code>,{' '}
        <code>flutter_inapp_purchase</code>, <code>kmp-iap</code>, and{' '}
        <code>godot-iap</code> — same types, same APIs, same events.
      </p>

      <div
        style={{
          padding: '1rem',
          background: 'rgba(96, 160, 96, 0.1)',
          borderLeft: '4px solid var(--success-color, #4caf50)',
          borderRadius: '0.5rem',
          margin: '1rem 0',
        }}
      >
        <strong>Native bindings are in.</strong> The library wires through to{' '}
        <code>packages/google</code> on Android (via the{' '}
        <code>OpenIapMauiShim.kt</code> facade) and <code>packages/apple</code>{' '}
        on iOS / macCatalyst (via the existing{' '}
        <code>OpenIapModule+ObjC.swift</code> bridge). All <em>48</em> resolver
        methods + listener streams are implemented, and <code>dotnet pack</code>{' '}
        produces a self-contained NuGet that embeds both the AAR and the
        xcframework.
      </div>

      <div
        style={{
          padding: '1rem',
          background: 'rgba(220, 104, 67, 0.1)',
          borderLeft: '4px solid var(--accent-color)',
          borderRadius: '0.5rem',
          margin: '1rem 0',
        }}
      >
        <strong>Before you start:</strong> Complete the platform store
        configuration first: <a href="/docs/ios-setup">iOS Setup</a> |{' '}
        <a href="/docs/android-setup">Android Setup</a>
      </div>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <strong>.NET 9 SDK</strong> (or newer; .NET 10 SDK works too) and
            the MAUI workload: <code>dotnet workload install maui</code>
          </li>
          <li>Active Apple Developer account (for iOS / macCatalyst)</li>
          <li>Active Google Play Developer account (for Android)</li>
          <li>
            Physical device for testing (simulators have limited IAP support)
          </li>
        </ul>
      </section>

      <section>
        <h2 id="installation" className="anchor-heading">
          Installation
          <a href="#installation" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Add a <code>PackageReference</code> to your MAUI app's{' '}
          <code>.csproj</code>:
        </p>
        <CodeBlock language="xml">
          {`<ItemGroup>
  <PackageReference Include="Hyo.OpenIap.Maui" Version="0.1.0" />
</ItemGroup>`}
        </CodeBlock>
        <p>Or add via the .NET CLI:</p>
        <CodeBlock language="bash">
          {`dotnet add package Hyo.OpenIap.Maui`}
        </CodeBlock>
        <div
          style={{
            padding: '1rem',
            background: 'rgba(164, 116, 101, 0.1)',
            borderLeft: '4px solid var(--primary-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>NuGet release pending.</strong> Until the first publish,
          reference the project directly from the monorepo:
          <CodeBlock language="xml">
            {`<ProjectReference Include="path/to/openiap/libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj" />`}
          </CodeBlock>
        </div>
      </section>

      <section>
        <h2 id="platform-config" className="anchor-heading">
          Platform Configuration
          <a href="#platform-config" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="ios-config" className="anchor-heading">
          iOS / macCatalyst
          <a href="#ios-config" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          In your MAUI app's <code>.csproj</code>, ensure{' '}
          <code>net9.0-ios</code> is in <code>TargetFrameworks</code>. Then
          enable the In-App Purchase capability and add the storefront query
          scheme:
        </p>
        <CodeBlock language="xml">
          {`<!-- Platforms/iOS/Info.plist -->
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>itms-apps</string>
</array>`}
        </CodeBlock>
        <p>
          In Xcode (when archiving):{' '}
          <strong>
            Target → Signing &amp; Capabilities → + Capability → In-App Purchase
          </strong>
          .
        </p>

        <h3 id="android-config" className="anchor-heading">
          Android
          <a href="#android-config" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Add the billing permission to{' '}
          <code>Platforms/Android/AndroidManifest.xml</code>:
        </p>
        <CodeBlock language="xml">
          {`<uses-permission android:name="com.android.vending.BILLING" />`}
        </CodeBlock>
        <p>
          Set <code>SupportedOSPlatformVersion</code> for <code>android</code>{' '}
          to <code>24.0</code> (minimum required by the Play Billing 8 binding):
        </p>
        <CodeBlock language="xml">
          {`<SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'android'">24.0</SupportedOSPlatformVersion>`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="usage" className="anchor-heading">
          Usage
          <a href="#usage" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="instance" className="anchor-heading">
          Resolving the Instance
          <a href="#instance" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Two patterns are supported. <code>OpenIap.Instance</code> is a static
          facade that lazily resolves the platform implementation; you can also
          inject your own for tests via{' '}
          <code>OpenIap.OverrideInstance(myFake)</code>.
        </p>
        <CodeBlock language="csharp">
          {`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

// Option 1: Static facade
var iap = Iap.Instance;

// Option 2: Resolve via DI / your own ctor
public sealed class CheckoutService(IOpenIap iap) {
    private readonly IOpenIap _iap = iap;
}`}
        </CodeBlock>

        <h3 id="streams" className="anchor-heading">
          Listener Streams
          <a href="#streams" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Subscribe to purchase / error / promoted-product streams using
          standard <code>IObservable&lt;T&gt;</code> APIs (works with
          System.Reactive or any observer):
        </p>
        <CodeBlock language="csharp">
          {`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

Iap.Instance.PurchaseUpdated.Subscribe(async purchase => {
    // 1. Validate the receipt on your server
    var ok = await ValidateOnServer(purchase);
    if (!ok) return;

    // 2. Grant entitlement locally
    GrantEntitlement(purchase.ProductId);

    // 3. Finish the transaction — Android auto-refunds after 3 days otherwise!
    await ((MutationResolver)Iap.Instance).FinishTransactionAsync(
        purchase: new PurchaseInput(purchase),
        isConsumable: true);
});

Iap.Instance.PurchaseError.Subscribe(error => {
    Console.WriteLine($"{error.Code}: {error.Message}");
});`}
        </CodeBlock>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(220, 104, 67, 0.1)',
            borderLeft: '4px solid var(--accent-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Critical:</strong> Always call{' '}
          <code>FinishTransactionAsync</code> after verifying a purchase. On
          Android, unfinished purchases are automatically refunded after 3 days.
        </div>

        <h3 id="products-purchase" className="anchor-heading">
          Products and Purchase
          <a href="#products-purchase" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="csharp">
          {`var iap = (QueryResolver)Iap.Instance;

// Fetch products
var result = await iap.FetchProductsAsync(new ProductRequest {
    Skus = new[] { "premium", "coins_100" },
    Type = ProductQueryType.InApp,
});

// Pattern-match the sealed result union
var products = result switch {
    FetchProductsResultProducts r => r.Value ?? Array.Empty<Product>(),
    _ => Array.Empty<Product>(),
};

// Request a purchase (event-based — listen via PurchaseUpdated)
await ((MutationResolver)Iap.Instance).RequestPurchaseAsync(new RequestPurchaseProps {
    RequestPurchase = new RequestPurchasePropsByPlatforms { /* ... */ },
    Type = ProductQueryType.InApp,
});

// Cleanup when the page unloads
await ((MutationResolver)Iap.Instance).EndConnectionAsync();`}
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
          A reference MAUI app lives at{' '}
          <code>libraries/maui-iap/example/OpenIap.Maui.Example</code>. It
          mirrors the seven screens in the{' '}
          <a href="/docs/setup/expo">expo-iap example</a> (Home, All Products,
          Purchase Flow, Subscription Flow, Available Purchases, Offer Code,
          Alternative Billing, Webhook Stream) so the same SKUs and the same API
          surface ship across both stacks.
        </p>
        <CodeBlock language="bash">
          {`# Once: install the MAUI workload
dotnet workload install maui

# iOS Simulator
cd libraries/maui-iap/example/OpenIap.Maui.Example
dotnet build -t:Run -f net9.0-ios

# Android (real device or emulator)
adb uninstall dev.hyo.openiap.maui.example || true
dotnet build -t:Run -f net9.0-android

# macCatalyst
dotnet build -t:Run -f net9.0-maccatalyst`}
        </CodeBlock>
        <p>
          VS Code launch configurations (iOS Simulator / iOS Device / Android /
          macCatalyst / Build Library / Sync Types / Install MAUI Workload) are
          pre-wired in <code>libraries/maui-iap/.vscode/launch.json</code> —
          open the folder and use the Run &amp; Debug panel.
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
            <a href="/docs/features/purchase">Purchase Guide</a> — Complete
            purchase flow with validation and receipt verification
          </li>
          <li>
            <a href="/docs/features/subscription">Subscription Guide</a> —
            Subscription offers, renewal, and management
          </li>
          <li>
            <a href="/docs/errors">Error Codes</a> — Full error reference and
            handling strategies
          </li>
          <li>
            <a href="/docs/apis">API Reference</a> — All available APIs with
            multi-language examples
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
