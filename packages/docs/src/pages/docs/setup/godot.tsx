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

      <div
        style={{
          padding: '1rem',
          background: 'rgba(220, 104, 67, 0.1)',
          borderLeft: '4px solid var(--accent-color)',
          borderRadius: '0.5rem',
          margin: '1rem 0',
        }}
      >
        <strong>Before you start:</strong> Complete the store configuration
        before integrating with your framework:{' '}
        <a href="/docs/ios-setup">iOS Setup</a> |{' '}
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
            <strong>Godot 4.3</strong> or higher
          </li>
          <li>
            iOS: <strong>Xcode 16+</strong> (Swift 6.0+) with{' '}
            <strong>iOS 15+</strong> target
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

        <h3 id="macos-gatekeeper" className="anchor-heading">
          macOS: Damaged Framework Warning
          <a href="#macos-gatekeeper" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Release zips are intended for iOS export and Android. If you use a
          release or custom build that includes{' '}
          <code>addons/godot-iap/bin/macos</code>, and Godot reports that{' '}
          <code>GodotIap.framework</code> or{' '}
          <code>SwiftGodotRuntime.framework</code> is damaged on macOS, clear
          quarantine and repair the local ad-hoc signature:
        </p>
        <CodeBlock language="bash">
          {`# Run from your Godot project root after copying addons/godot-iap
xattr -dr com.apple.quarantine addons/godot-iap
codesign --force --deep --sign - --timestamp=none addons/godot-iap/bin/macos/SwiftGodotRuntime.framework
codesign --force --deep --sign - --timestamp=none addons/godot-iap/bin/macos/GodotIap.framework`}
        </CodeBlock>
        <p>
          The checked-in macOS runtime frameworks are Apple Silicon (
          <code>arm64</code>) only. The default release zip does not include
          macOS runtime frameworks.
        </p>

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

        <div
          style={{
            padding: '1rem',
            background: 'rgba(220, 104, 67, 0.1)',
            borderLeft: '4px solid var(--accent-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Warning:</strong> If the frameworks are not embedded, the app
          will crash on launch with:{' '}
          <code>Library not loaded: @rpath/GodotIap.framework/GodotIap</code>.
          If the runpath is missing, it can crash with:{' '}
          <code>
            Library not loaded:
            @rpath/SwiftGodotRuntime.framework/SwiftGodotRuntime
          </code>
          .
        </div>

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
        <div
          style={{
            padding: '1rem',
            background: 'rgba(164, 116, 101, 0.1)',
            borderLeft: '4px solid var(--primary-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Tip:</strong> Prefer the post-export fixer when possible; the
          build phase is only a fallback for projects that cannot run the script
          after export.
        </div>
      </section>

      <section>
        <h2 id="verify" className="anchor-heading">
          Verify Installation
          <a href="#verify" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Add <code>GodotIapWrapper</code> as a child node in your scene, then
          use this script:
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
    var success = iap.init_connection()
    print("Init result: ", success)

func _on_connected():
    print("Store connected!")

func _on_purchase_updated(purchase: Dictionary):
    print("Purchase: ", purchase)

func _on_purchase_error(error: Dictionary):
    print("Error: ", error)`}
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
          <strong>Note:</strong> The native plugin is only available on iOS and
          Android in the default release zip. In the editor and on desktop
          platforms, store calls return fallback values or no-op results so you
          can test your integration flow without opening a real store
          connection.
        </div>
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
        <h2 id="usage" className="anchor-heading">
          Usage
          <a href="#usage" className="anchor-link">
            #
          </a>
        </h2>

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
    GodotIapPlugin.purchase_updated.connect(_on_purchase_updated)
    GodotIapPlugin.purchase_error.connect(_on_purchase_error)

    # Initialize
    await GodotIapPlugin.init_connection()

func _on_purchase_updated(purchase):
    # Validate receipt on your server, then:
    await GodotIapPlugin.finish_transaction(purchase, true)
    print("Purchased: ", purchase.product_id)

func _on_purchase_error(error):
    print("Error: ", error.code, " - ", error.message)`}
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
          <strong>Critical:</strong> Always call <code>finishTransaction</code>{' '}
          after verifying a purchase. On Android, unfinished purchases are
          automatically refunded after 3 days.
        </div>

        <h3 id="fetch-products" className="anchor-heading">
          Fetching Products
          <a href="#fetch-products" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="gdscript">
          {`func _load_products():
    var request = Types.ProductRequest.new()
    request.skus = ["premium", "coins_100"]
    request.type = Types.ProductQueryType.InApp

    var products: Array = await GodotIapPlugin.fetch_products(request)
    for product in products:
        # On Android: Types.ProductAndroid
        # On iOS: Types.ProductIOS
        print(product.id, " - ", product.display_price)`}
        </CodeBlock>

        <h3 id="purchase" className="anchor-heading">
          Making a Purchase
          <a href="#purchase" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="gdscript">
          {`func _purchase(sku: String):
    var props = Types.RequestPurchaseProps.new()
    props.sku = sku
    # Returns Variant (PurchaseAndroid or PurchaseIOS, or null)
    var purchase = await GodotIapPlugin.request_purchase(props)`}
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
          <strong>Note:</strong> GDScript uses <code>snake_case</code> for all
          function names (<code>init_connection</code>,{' '}
          <code>fetch_products</code>, <code>request_purchase</code>). Return
          types use <code>Array</code> for lists and <code>Variant</code> for
          platform-specific single results.
        </div>
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
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Source
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2 id="troubleshooting" className="anchor-heading">
          Troubleshooting
          <a href="#troubleshooting" className="anchor-link">
            #
          </a>
        </h2>
        <h3>Products not found</h3>
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
      </section>
    </div>
  );
}

export default GodotSetup;
