import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import CodeBlock from '../components/CodeBlock';

function Introduction() {
  return (
    <div className="page-container">
      <SEO
        title="Why OpenIAP"
        description="OpenIAP is a unified specification for in-app purchases across iOS, Android, and XR platforms. One GraphQL schema generates type-safe code for Swift, Kotlin, TypeScript, Dart, and GDScript."
        path="/introduction"
        keywords="OpenIAP, in-app purchase specification, StoreKit 2, Google Play Billing, cross-platform IAP, type-safe IAP, GraphQL schema"
        includeAppSchema
      />
      <div className="content-wrapper">
        {/* Title */}
        <h1>Why OpenIAP</h1>
        <p className="intro-lead">
          OpenIAP is a unified specification for in-app purchases across iOS,
          Android, and XR platforms. One GraphQL schema generates type-safe
          native code for Swift, Kotlin, TypeScript, Dart, and GDScript.
        </p>

        {/* The Problem */}
        <section className="intro-section">
          <h2>The Problem</h2>
          <p className="intro-text">
            In-app purchase implementations are fragmented across platforms and
            frameworks. Each library defines its own API surface, type
            definitions, and event patterns. This creates several challenges:
          </p>
          <ul className="intro-list">
            <li>
              <strong>Inconsistent APIs</strong> — Method names, parameter
              structures, and return types differ between{' '}
              <code>react-native-iap</code>, <code>flutter_inapp_purchase</code>
              , and other libraries
            </li>
            <li>
              <strong>Duplicated effort</strong> — Library maintainers
              independently solve the same problems (transaction handling, error
              codes, subscription lifecycle)
            </li>
            <li>
              <strong>Platform drift</strong> — When Apple adds StoreKit 2
              features or Google updates Play Billing, each library implements
              changes differently
            </li>
            <li>
              <strong>AI limitations</strong> — AI assistants cannot generate
              reliable IAP code because no two libraries work the same way
            </li>
          </ul>
          <p className="intro-text-secondary">
            New platforms like{' '}
            <a
              href="https://developer.apple.com/visionos/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vision Pro
            </a>{' '}
            and <Link to="/docs/horizon-setup">Horizon OS</Link> compound this
            fragmentation.
          </p>
        </section>

        {/* The Solution */}
        <section className="intro-section">
          <h2>The Solution</h2>
          <p className="intro-text">
            OpenIAP provides a single source of truth for IAP implementations.
            The specification defines:
          </p>
          <ul className="intro-list">
            <li>
              <strong>Unified API methods</strong> —{' '}
              <Link to="/docs/apis/connection#init-connection">
                <code>initConnection()</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/products#fetch-products">
                <code>fetchProducts()</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/purchase#request-purchase">
                <code>requestPurchase()</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/purchase#finish-transaction">
                <code>finishTransaction()</code>
              </Link>
            </li>
            <li>
              <strong>Shared type definitions</strong> —{' '}
              <Link to="/docs/types/product">
                <code>Product</code>
              </Link>
              ,{' '}
              <Link to="/docs/types/purchase">
                <code>Purchase</code>
              </Link>
              ,{' '}
              <Link to="/docs/types/subscription">
                <code>SubscriptionPeriod</code>
              </Link>
              ,{' '}
              <Link to="/docs/types/errors">
                <code>PurchaseError</code>
              </Link>
            </li>
            <li>
              <strong>Standard event patterns</strong> —{' '}
              <Link to="/docs/events#purchase-updated-event">
                <code>purchaseUpdatedListener</code>
              </Link>
              ,{' '}
              <Link to="/docs/events#purchase-error-event">
                <code>purchaseErrorListener</code>
              </Link>
            </li>
            <li>
              <strong>Platform-aware naming</strong> — Cross-platform types use
              no suffix, platform-specific use <code>IOS</code>/
              <code>Android</code> suffix
            </li>
          </ul>
        </section>

        {/* Architecture */}
        <section className="intro-section">
          <h2>Architecture</h2>
          <p className="intro-text">
            OpenIAP uses a schema-driven approach. A single GraphQL schema
            defines all types and operations, which are then generated into
            native code for each target platform.
          </p>

          <div className="intro-image-container">
            <Link to="/docs/ecosystem">
              <img
                src="/ecosystem.png"
                alt="OpenIAP Architecture - GraphQL schema generates native modules"
                width={800}
                height={450}
                className="intro-image"
              />
            </Link>
            <p className="intro-image-caption">
              <Link to="/docs/ecosystem">View ecosystem documentation →</Link>
            </p>
          </div>

          <h3>Code Generation</h3>
          <p className="intro-text">
            The{' '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/gql"
              target="_blank"
              rel="noopener noreferrer"
            >
              <code>openiap-gql</code>
            </a>{' '}
            package contains the GraphQL schema and generators. Running{' '}
            <code>bun run generate</code> produces:
          </p>
          <div className="intro-code-output">
            <pre>
              {`packages/apple/Sources/Models/Types.swift    # Swift types
packages/google/openiap/src/main/Types.kt    # Kotlin types
src/generated/types.ts                       # TypeScript types
src/generated/types.dart                     # Dart types
src/generated/types.gd                       # GDScript types`}
            </pre>
          </div>

          <h3>Native Modules</h3>
          <p className="intro-text">
            Two native modules implement the specification on top of platform
            APIs:
          </p>
          <div className="native-module-grid">
            <div className="native-module-card">
              <strong>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple
                </a>
              </strong>
              <p>
                Swift module built on{' '}
                <a
                  href="https://developer.apple.com/storekit/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  StoreKit 2
                </a>
                . Supports iOS 15+, macOS 12+, visionOS 1.0+.
              </p>
            </div>
            <div className="native-module-card">
              <strong>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-google
                </a>
              </strong>
              <p>
                Kotlin module built on{' '}
                <a
                  href="https://developer.android.com/google/play/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Play Billing v8
                </a>
                . Supports Android 5.0+ (API 21+).
              </p>
            </div>
          </div>
        </section>

        {/* API Design */}
        <section className="intro-section">
          <h2>API Design</h2>

          <h3>Naming Conventions</h3>
          <p className="intro-text">
            OpenIAP uses consistent naming across all implementations:
          </p>
          <div className="intro-table-wrapper">
            <table className="intro-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Pattern</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cross-platform</td>
                  <td>
                    <code>functionName</code>
                  </td>
                  <td>
                    <code>fetchProducts()</code>, <code>requestPurchase()</code>
                  </td>
                </tr>
                <tr>
                  <td>iOS-only</td>
                  <td>
                    <code>functionNameIOS</code>
                  </td>
                  <td>
                    <code>syncIOS()</code>, <code>getStorefrontIOS()</code>
                  </td>
                </tr>
                <tr>
                  <td>Android-only</td>
                  <td>
                    <code>functionNameAndroid</code>
                  </td>
                  <td>
                    <code>acknowledgePurchaseAndroid()</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Type Safety</h3>
          <p className="intro-text">
            Generated types ensure compile-time safety. Platform-specific fields
            use suffixes to prevent accidental cross-platform usage:
          </p>
          <CodeBlock language="typescript">
            {`// Cross-platform fields (no suffix)
interface Product {
  id: string;
  title: string;
  price: string;
  priceAmount: number;
  currency: string;
}

// Platform-specific fields (with suffix)
interface Purchase {
  productId: string;
  transactionId: string;
  // iOS-specific
  originalTransactionIdIOS?: string;
  // Android-specific
  purchaseTokenAndroid?: string;
  orderIdAndroid?: string;
}`}
          </CodeBlock>
        </section>

        {/* Purchase Flow */}
        <section className="intro-section">
          <h2>Purchase Flow</h2>
          <p className="intro-text">
            The standard purchase flow works identically across all OpenIAP
            implementations:
          </p>
          <CodeBlock language="typescript">
            {`// 1. Initialize connection
await initConnection();

// 2. Set up listeners (event-based, not promise-based)
const subscription = purchaseUpdatedListener(async (purchase) => {
  // 3. Verify on your server
  const verified = await verifyPurchase(purchase);

  // 4. Grant entitlement
  if (verified) {
    await grantAccess(purchase.productId);
  }

  // 5. Acknowledge the purchase
  // Android: auto-refunds after 3 days if not acknowledged
  await finishTransaction(purchase, isConsumable);
});

// 6. Fetch products
const products = await fetchProducts({
  products: [
    { id: 'com.app.premium', type: 'inapp' },
    { id: 'com.app.monthly', type: 'subs' },
  ],
});

// 7. Request purchase (result comes via listener)
await requestPurchase({
  request: {
    apple: { sku: 'com.app.premium' },
    google: { skus: ['com.app.premium'] },
  },
  type: 'inapp',
});

// 8. Cleanup on unmount
subscription.remove();
await endConnection();`}
          </CodeBlock>
          <p className="intro-text-note">
            See <Link to="/docs/lifecycle">Purchase Lifecycle</Link> for
            detailed flow documentation.
          </p>
        </section>

        {/* Supported Platforms */}
        <section className="intro-section">
          <h2>Supported Platforms</h2>
          <div className="intro-table-wrapper">
            <table className="intro-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Billing API</th>
                  <th>Min Version</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>iOS</td>
                  <td>
                    <a
                      href="https://developer.apple.com/storekit/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      StoreKit 2
                    </a>
                  </td>
                  <td>iOS 15.0+</td>
                </tr>
                <tr>
                  <td>macOS</td>
                  <td>StoreKit 2</td>
                  <td>macOS 12.0+</td>
                </tr>
                <tr>
                  <td>visionOS</td>
                  <td>StoreKit 2</td>
                  <td>visionOS 1.0+</td>
                </tr>
                <tr>
                  <td>Android</td>
                  <td>
                    <a
                      href="https://developer.android.com/google/play/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Play Billing v8
                    </a>
                  </td>
                  <td>API 21+ (5.0)</td>
                </tr>
                <tr>
                  <td>Meta Quest</td>
                  <td>
                    <Link to="/docs/horizon-setup">Horizon OS</Link>
                  </td>
                  <td>Quest 2+</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Framework Implementations */}
        <section className="intro-section">
          <h2>Framework Implementations</h2>
          <p className="intro-text">
            Production-ready libraries implementing the OpenIAP specification:
          </p>
          <div className="intro-table-wrapper">
            <table className="intro-table">
              <thead>
                <tr>
                  <th>Library</th>
                  <th>Framework</th>
                  <th>Bridge</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a
                      href="https://github.com/dooboolab-community/react-native-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      react-native-iap
                    </a>
                  </td>
                  <td>React Native</td>
                  <td>
                    <a
                      href="https://github.com/margelo/nitro"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Nitro Modules
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/hyochan/expo-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      expo-iap
                    </a>
                  </td>
                  <td>Expo</td>
                  <td>
                    <a
                      href="https://docs.expo.dev/modules/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Expo Modules
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/hyochan/flutter_inapp_purchase"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      flutter_inapp_purchase
                    </a>
                  </td>
                  <td>Flutter</td>
                  <td>
                    <a
                      href="https://pub.dev/packages/pigeon"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pigeon
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/nicemiro/kmp-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      kmp-iap
                    </a>
                  </td>
                  <td>Kotlin Multiplatform</td>
                  <td>
                    <a
                      href="https://kotlinlang.org/docs/native-objc-interop.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      K/N Interop
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/nicemiro/godot-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      godot-iap
                    </a>
                  </td>
                  <td>Godot 4.x</td>
                  <td>
                    <a
                      href="https://docs.godotengine.org/en/stable/tutorials/plugins/editor/gdextension.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GDExtension
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="intro-text-secondary">
            <Link to="/languages">View all implementations →</Link>
          </p>
        </section>

        {/* Getting Started */}
        <section className="intro-section">
          <h2>Getting Started</h2>
          <p className="intro-text">
            Choose your framework to get started:
          </p>
          <div className="getting-started-grid">
            <Link to="/docs/apis" className="getting-started-card">
              <strong>API Reference</strong>
              <p>Core methods and patterns</p>
            </Link>
            <Link to="/docs/types" className="getting-started-card">
              <strong>Type Definitions</strong>
              <p>Generated types for all languages</p>
            </Link>
            <Link to="/docs/lifecycle" className="getting-started-card">
              <strong>Purchase Lifecycle</strong>
              <p>Transaction flow diagrams</p>
            </Link>
            <Link to="/tutorials" className="getting-started-card">
              <strong>Tutorials</strong>
              <p>Step-by-step guides</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Introduction;
