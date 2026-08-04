import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';

function GodotSetup() {
  return (
    <div className="doc-page">
      <SEO
        title="Godot Setup"
        description="Install and configure godot-iap for in-app purchases in Godot 4.x games."
        path="/docs/setup/godot"
        keywords="godot-iap, Godot IAP, in-app purchase, Godot 4, GDScript"
      />
      <h1>Godot Setup</h1>
      <p>
        <code>godot-iap</code> is a Godot 4.x plugin for in-app purchases
        following the OpenIAP specification. It uses Swift GDExtension for iOS
        and Kotlin AAR for Android.
      </p>

      <Callout kind="important" title="Before you start">
        Complete the store configuration before integrating with your framework:{' '}
        <a href="/docs/ios-setup">iOS Setup</a> |{' '}
        <a href="/docs/android-setup">Android Setup</a>
      </Callout>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <strong>Godot 4.3</strong> or higher
          </li>
          <li>
            iOS: <strong>Xcode 16+</strong> (Swift 6.0+) with{' '}
            <strong>iOS 17+</strong> target
          </li>
          <li>
            Android: Android SDK with <strong>API level 24+</strong>
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

        <h3 id="download-release" className="anchor-heading">
          Download from Releases (Recommended)
          <a href="#download-release" className="anchor-link">
            #
          </a>
        </h3>
        <ol>
          <li>
            Download the latest <code>godot-iap-&#123;version&#125;.zip</code>{' '}
            from{' '}
            <a
              href="https://github.com/hyodotdev/openiap/releases"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Releases
            </a>
          </li>
          <li>
            Extract and copy <code>addons/godot-iap/</code> to your project's{' '}
            <code>addons/</code> folder
          </li>
          <li>
            Enable the plugin in{' '}
            <strong>Project &gt; Project Settings &gt; Plugins</strong>
          </li>
        </ol>
        <p>The zip includes pre-built binaries for both iOS and Android.</p>

        <h3 id="build-from-source" className="anchor-heading">
          Build from Source
          <a href="#build-from-source" className="anchor-link">
            #
          </a>
        </h3>
        <p>If you need to build from source:</p>
        <CodeBlock language="bash">
          {`git clone https://github.com/hyodotdev/openiap.git
cd openiap/libraries/godot-iap

# Build for iOS
make ios

# Build for Android
make android

# Copy addons/godot-iap/ to your project`}
        </CodeBlock>
        <p>
          The checked-in macOS runtime frameworks are Apple Silicon (
          <code>arm64</code>) only. Custom source builds can override{' '}
          <code>MACOS_ARCHS</code>; <code>make macos</code> requests{' '}
          <code>arm64 x86_64</code> by default, and generated metadata should
          only include architectures that the framework binaries actually
          contain.
        </p>

        <h3 id="xcode-version" className="anchor-heading">
          iOS Framework Toolchain (Offer Codes)
          <a href="#xcode-version" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          The pre-built iOS framework locks in Apple API availability at compile
          time. One feature depends on this:{' '}
          <a href="/docs/features/offer-code-redemption">
            offer code redemption
          </a>{' '}
          only returns a verified result when the framework was built with Xcode
          27 or later — a framework built with Xcode 26 falls back to the legacy
          redemption sheet and returns <code>null</code>, even on devices
          running the latest OS. The published godot-iap 3.0.0 framework is
          built with Xcode 27. If you build from source and use offer codes,
          build with Xcode 27 or later.
        </p>

        <h3 id="macos-gatekeeper" className="anchor-heading">
          macOS: Damaged Framework Warning
          <a href="#macos-gatekeeper" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          The default release zip does not include macOS runtime frameworks, so
          most projects can skip this section. It applies only if you build from
          source with macOS support or use a custom zip containing{' '}
          <code>addons/godot-iap/bin/macos</code>. If Godot reports that{' '}
          <code>GodotIap.framework</code> or{' '}
          <code>SwiftGodotRuntime.framework</code> is damaged, clear quarantine
          and repair the ad-hoc signature:
        </p>
        <CodeBlock language="bash">
          {`# Run from your Godot project root after copying addons/godot-iap
xattr -dr com.apple.quarantine addons/godot-iap
codesign --force --deep --sign - --timestamp=none addons/godot-iap/bin/macos/SwiftGodotRuntime.framework
codesign --force --deep --sign - --timestamp=none addons/godot-iap/bin/macos/GodotIap.framework`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="platform-setup" className="anchor-heading">
          Platform Setup
          <a href="#platform-setup" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="godot-export" className="anchor-heading">
          Godot Export Presets
          <a href="#godot-export" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          For both iOS and Android, enable the plugin in your export presets:
        </p>
        <ol>
          <li>
            <strong>Project &gt; Export &gt; Add &gt; iOS</strong> (or Android)
          </li>
          <li>
            Configure your export settings (Bundle Identifier, Team ID, etc.)
          </li>
          <li>
            Enable <strong>GodotIap</strong> in the Plugins section
          </li>
        </ol>

        <h3 id="ios-xcode" className="anchor-heading">
          iOS: Xcode Framework Embedding
          <a href="#ios-xcode" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          The GodotIap export plugin registers the iOS frameworks during export
          so they are added to Xcode's <strong>Embed Frameworks</strong> build
          phase automatically. Before exporting, make sure GodotIap is enabled
          in the iOS export preset's <strong>Plugins</strong> section.
        </p>
        <p>
          If you exported with an older plugin version, or if Xcode still shows
          the frameworks as file references instead of framework bundles, run
          the post-export fixer from your Godot project root:
        </p>
        <CodeBlock language="bash">
          {`IOS_EXPORT_DIR=/path/to/ios-export \\
  ./addons/godot-iap/scripts/fix_ios_embed.sh`}
        </CodeBlock>
        <p>
          The script finds the exported <code>.xcodeproj</code>, embeds:
        </p>
        <ul>
          <li>
            <code>GodotIap.framework</code>
          </li>
          <li>
            <code>SwiftGodotRuntime.framework</code>
          </li>
        </ul>
        <p>
          It also converts framework file references to framework bundles and
          restores any missing framework <code>Info.plist</code> files.
        </p>

        <details>
          <summary>Manual Xcode fallback</summary>
          <ol>
            <li>
              Open the exported <code>.xcodeproj</code> in Xcode
            </li>
            <li>
              Select your target &gt; <strong>General</strong> tab
            </li>
            <li>
              Scroll to{' '}
              <strong>Frameworks, Libraries, and Embedded Content</strong>
            </li>
            <li>
              Click <strong>+</strong> and add:
              <ul>
                <li>
                  <code>GodotIap.framework</code>
                </li>
                <li>
                  <code>SwiftGodotRuntime.framework</code>
                </li>
              </ul>
            </li>
            <li>
              Set both to <strong>"Embed &amp; Sign"</strong>
            </li>
          </ol>
          <p>The frameworks are located at:</p>
          <CodeBlock language="text">
            {`[exported_project]/addons/godot-iap/bin/ios/GodotIap.framework
[exported_project]/addons/godot-iap/bin/ios/SwiftGodotRuntime.framework`}
          </CodeBlock>
          <p>Then confirm the runpath:</p>
          <ol>
            <li>
              Go to the <strong>Build Settings</strong> tab
            </li>
            <li>
              Search for <strong>"Runpath Search Paths"</strong> (
              <code>LD_RUNPATH_SEARCH_PATHS</code>)
            </li>
            <li>
              Add <code>@executable_path/Frameworks</code> if not already
              present
            </li>
          </ol>
        </details>

        <Callout kind="warning">
          If the frameworks are not embedded, the app will crash on launch with:{' '}
          <code>Library not loaded: @rpath/GodotIap.framework/GodotIap</code>.
          If the runpath is missing, it can crash with:{' '}
          <code>
            Library not loaded:
            @rpath/SwiftGodotRuntime.framework/SwiftGodotRuntime
          </code>
          .
        </Callout>

        <h3 id="ios-infoplist" className="anchor-heading">
          iOS: Missing Info.plist Fallback
          <a href="#ios-infoplist" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Due to a{' '}
          <a
            href="https://github.com/godotengine/godot/issues/109075"
            target="_blank"
            rel="noopener noreferrer"
          >
            Godot export bug
          </a>
          , some exports may omit <code>Info.plist</code> files inside embedded
          frameworks. The <code>fix_ios_embed.sh</code> script above copies the
          missing files automatically.
        </p>
        <p>If you still need an Xcode build phase fallback:</p>
        <ol>
          <li>
            Select your target &gt; <strong>Build Phases</strong> tab
          </li>
          <li>
            Click <strong>+</strong> &gt; <strong>New Run Script Phase</strong>
          </li>
          <li>Name it "Copy Framework Info.plist"</li>
          <li>Paste the following script:</li>
        </ol>
        <CodeBlock language="bash">
          {`# Copy missing Info.plist files for GodotIap frameworks
ADDONS_DIR="\${PROJECT_DIR}"
FRAMEWORKS_DIR="\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}"

if [ -f "\${ADDONS_DIR}/addons/godot-iap/bin/ios/GodotIap.framework/Info.plist" ]; then
    cp "\${ADDONS_DIR}/addons/godot-iap/bin/ios/GodotIap.framework/Info.plist" \\
       "\${FRAMEWORKS_DIR}/GodotIap.framework/" 2>/dev/null || true
fi

if [ -f "\${ADDONS_DIR}/addons/godot-iap/bin/ios/SwiftGodotRuntime.framework/Info.plist" ]; then
    cp "\${ADDONS_DIR}/addons/godot-iap/bin/ios/SwiftGodotRuntime.framework/Info.plist" \\
       "\${FRAMEWORKS_DIR}/SwiftGodotRuntime.framework/" 2>/dev/null || true
fi`}
        </CodeBlock>
        <ol start={5}>
          <li>
            Drag this script phase <strong>before</strong> the "Embed
            Frameworks" phase
          </li>
        </ol>
        <p>
          Prefer the post-export fixer when possible; the build phase is only a
          fallback for projects that cannot run the script after export.
        </p>
      </section>

      <section>
        <h2 id="scene-setup" className="anchor-heading">
          Scene Setup
          <a href="#scene-setup" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          The recommended way to use GodotIap is to add{' '}
          <code>GodotIapWrapper</code> as a child node:
        </p>
        <ol>
          <li>
            Open your main scene (or create an autoload scene for IAP
            management)
          </li>
          <li>
            Add a new node: <strong>Add Child Node &gt; Node</strong>
          </li>
          <li>
            Attach the GodotIapWrapper script:{' '}
            <strong>Load &gt; addons/godot-iap/godot_iap.gd</strong>
          </li>
          <li>
            Name it <code>GodotIapWrapper</code>
          </li>
          <li>
            Reference it in your script using{' '}
            <code>@onready var iap = $GodotIapWrapper</code>
          </li>
        </ol>
        <p>Or create the wrapper node programmatically:</p>
        <CodeBlock language="gdscript">
          {`extends Node

const Types = preload("res://addons/godot-iap/types.gd")

var iap

func _ready():
    # Create wrapper node dynamically
    var wrapper = preload("res://addons/godot-iap/godot_iap.gd").new()
    wrapper.name = "GodotIapWrapper"
    add_child(wrapper)
    iap = wrapper

    # Now use iap as normal
    iap.connected.connect(_on_connected)
    iap.init_connection()`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="verify" className="anchor-heading">
          Verify Installation
          <a href="#verify" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          With the <code>GodotIapWrapper</code> node from Scene Setup in place,
          attach this script to confirm the plugin loads and the store connects:
        </p>
        <CodeBlock language="gdscript">
          {`extends Node

const Types = preload("res://addons/godot-iap/types.gd")

@onready var iap = $GodotIapWrapper

func _ready():
    print("Godot IAP is available!")

    # Connect signals
    iap.connected.connect(_on_connected)
    iap.purchase_updated.connect(_on_purchase_updated)
    iap.purchase_error.connect(_on_purchase_error)

    # Initialize connection
    var success = await iap.init_connection()
    print("Init result: ", success)

func _on_connected():
    print("Store connected!")

func _on_purchase_updated(purchase: Dictionary):
    print("Purchase: %s" % purchase.get("product_id", ""))

func _on_purchase_error(error: Dictionary):
    print("Error: ", error)`}
        </CodeBlock>
        <Callout kind="note">
          The native plugin is only available on iOS and Android in the default
          release zip. In the editor and on desktop platforms, store calls
          return fallback values or no-op results so you can test your
          integration flow without opening a real store connection.
        </Callout>
      </section>

      <section>
        <h2 id="usage" className="anchor-heading">
          Usage
          <a href="#usage" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          The typical flow is{' '}
          <a href="/docs/apis/init-connection">
            <code>init_connection</code>
          </a>{' '}
          → connect the{' '}
          <a href="/docs/events/purchase-updated-listener">
            <code>purchase_updated</code>
          </a>{' '}
          and{' '}
          <a href="/docs/events/purchase-error-listener">
            <code>purchase_error</code>
          </a>{' '}
          signals →{' '}
          <a href="/docs/apis/fetch-products">
            <code>fetch_products</code>
          </a>{' '}
          →{' '}
          <a href="/docs/apis/request-purchase">
            <code>request_purchase</code>
          </a>{' '}
          →{' '}
          <a href="/docs/apis/finish-transaction">
            <code>finish_transaction</code>
          </a>
          . See the <a href="/docs/features/purchase">Purchase Guide</a> for the
          complete flow.
        </p>
        <p>
          The examples below use the <code>iap</code> reference created in Scene
          Setup (<code>@onready var iap = $GodotIapWrapper</code>).
        </p>

        <p>
          GDScript uses <code>snake_case</code> for all function names (
          <code>init_connection</code>, <code>fetch_products</code>,{' '}
          <code>request_purchase</code>). Return types use <code>Array</code>{' '}
          for lists and <code>Variant</code> for platform-specific single
          results.
        </p>

        <h3 id="signals" className="anchor-heading">
          Signal-Based Architecture
          <a href="#signals" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Godot IAP uses <strong>signals</strong> for purchase events, following
          Godot's native event pattern:
        </p>
        <CodeBlock language="gdscript">
          {`const Types = preload("res://addons/godot-iap/types.gd")

func _ready():
    # Connect signals
    iap.purchase_updated.connect(_on_purchase_updated)
    iap.purchase_error.connect(_on_purchase_error)

    # Initialize
    await iap.init_connection()

func _on_purchase_updated(purchase):
    # Validate receipt with your backend or IAPKit, then:
    # (second argument: true only for consumable products)
    await iap.finish_transaction(purchase, false)
    print("Purchased: ", purchase.product_id)

func _on_purchase_error(error):
    print("Error: ", error.code, " - ", error.message)`}
        </CodeBlock>
        <p>
          Each call here has a full reference — see the{' '}
          <a href="/docs/events/purchase-updated-listener">
            <code>purchase_updated</code>
          </a>{' '}
          and{' '}
          <a href="/docs/events/purchase-error-listener">
            <code>purchase_error</code>
          </a>{' '}
          signals,{' '}
          <a href="/docs/apis/init-connection">
            <code>init_connection</code>
          </a>
          , and{' '}
          <a href="/docs/apis/finish-transaction">
            <code>finish_transaction</code>
          </a>{' '}
          for parameters and per-store behavior, and{' '}
          <a href="/docs/errors">Error Codes</a> for the <code>error.code</code>{' '}
          values.
        </p>

        <Callout kind="warning" title="Critical">
          Always call <code>finish_transaction</code> after verifying a
          purchase. On Android, unfinished purchases are automatically refunded
          after 3 days.
        </Callout>

        <h3 id="fetch-products" className="anchor-heading">
          Fetching Products
          <a href="#fetch-products" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Query store metadata with a{' '}
          <a href="/docs/types/product-request">
            <code>ProductRequest</code>
          </a>
          ; results are platform-typed (<code>ProductAndroid</code> on Android,{' '}
          <code>ProductIOS</code> on iOS):
        </p>
        <CodeBlock language="gdscript">
          {`func _load_products():
    var request = Types.ProductRequest.new()
    request.skus = ["premium", "coins_100"]
    request.type = Types.ProductQueryType.InApp

    var products: Array = await iap.fetch_products(request)
    for product in products:
        # On Android: Types.ProductAndroid
        # On iOS: Types.ProductIOS
        print(product.id, " - ", product.display_price)`}
        </CodeBlock>
        <p>
          See{' '}
          <a href="/docs/apis/fetch-products">
            <code>fetch_products</code>
          </a>{' '}
          for parameters and per-store behavior.
        </p>

        <h3 id="purchase" className="anchor-heading">
          Making a Purchase
          <a href="#purchase" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Configure both platforms in a single request — the plugin picks the
          branch matching the store the game is running on, so one purchase call
          works everywhere:
        </p>
        <CodeBlock language="gdscript">
          {`func _purchase(sku: String):
    var platforms = Types.RequestPurchasePropsByPlatforms.new()
    platforms.apple = Types.RequestPurchaseIosProps.new()
    platforms.apple.sku = sku
    platforms.google = Types.RequestPurchaseAndroidProps.new()
    var skus: Array[String] = [sku]
    platforms.google.skus = skus
    var props = Types.RequestPurchaseProps.in_app(platforms)
    # Returns Variant (PurchaseAndroid or PurchaseIOS, or null)
    var purchase = await iap.request_purchase(props)`}
        </CodeBlock>
        <p>
          See{' '}
          <a href="/docs/apis/request-purchase">
            <code>request_purchase</code>
          </a>{' '}
          for parameters and per-store behavior.
        </p>
      </section>

      <section>
        <h2 id="troubleshooting" className="anchor-heading">
          Troubleshooting
          <a href="#troubleshooting" className="anchor-link">
            #
          </a>
        </h2>
        <h3 id="products-not-found" className="anchor-heading">
          Products not found
          <a href="#products-not-found" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Ensure all agreements are signed in App Store Connect / Google Play
            Console
          </li>
          <li>
            Verify banking, legal, and tax information is complete and approved
          </li>
          <li>Check that bundle ID / package name matches exactly</li>
          <li>
            Products must be in "Ready to Submit" status (Apple) or "Active"
            (Google)
          </li>
          <li>Wait 15-30 minutes after creating products before testing</li>
        </ul>

        <h3 id="ios-launch-crash" className="anchor-heading">
          App crashes on launch (iOS)
          <a href="#ios-launch-crash" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          A crash with{' '}
          <code>Library not loaded: @rpath/GodotIap.framework/GodotIap</code>{' '}
          means the frameworks were not embedded — see{' '}
          <a href="#ios-xcode">iOS: Xcode Framework Embedding</a> and run{' '}
          <code>fix_ios_embed.sh</code>.
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
            <a href="/docs/setup/store">Store Setup</a> — support boundaries for
            alternative stores such as{' '}
            <a href="/docs/setup/store/horizon">Horizon OS</a> (Meta Quest) and{' '}
            <a href="/docs/setup/store/amazon">Fire OS / Vega OS</a> (Amazon);
            godot-iap does not yet ship dedicated flavors for these targets
          </li>
          <li>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap"
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

export default GodotSetup;
