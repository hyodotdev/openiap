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
        <h2 id="installation" className="anchor-heading">
          Installation
          <a href="#installation" className="anchor-link">
            #
          </a>
        </h2>
        <ol>
          <li>
            Download the latest release from{' '}
            <a
              href="https://github.com/hyodotdev/openiap/releases"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Releases
            </a>{' '}
            (look for <code>godot-iap-*.zip</code>)
          </li>
          <li>
            Extract to your project's <code>addons/godot-iap/</code> directory
          </li>
          <li>
            Enable the plugin in{' '}
            <strong>Project &gt; Project Settings &gt; Plugins</strong>
          </li>
        </ol>
        <p>
          Requires <strong>Godot 4.x</strong>. Pre-built binaries for iOS and
          Android are included.
        </p>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(164, 116, 101, 0.1)',
            borderLeft: '4px solid var(--primary-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Note:</strong> IAP cannot be tested in the Godot editor. You must export to a real iOS/Android device with proper signing and store configuration.
        </div>
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
          <strong>Critical:</strong> Always call <code>finishTransaction</code> after verifying a purchase. On Android, unfinished purchases are automatically refunded after 3 days.
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
          <li>Ensure all agreements are signed in App Store Connect / Google Play Console</li>
          <li>Verify banking, legal, and tax information is complete and approved</li>
          <li>Check that bundle ID / package name matches exactly</li>
          <li>Products must be in "Ready to Submit" status (Apple) or "Active" (Google)</li>
          <li>Wait 15-30 minutes after creating products before testing</li>
        </ul>
      </section>
    </div>
  );
}

export default GodotSetup;
