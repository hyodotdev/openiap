import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

function Introduction() {
  return (
    <div className="page-container">
      <SEO
        title="Why OpenIAP"
        description="OpenIAP is a unified specification for in-app purchases across iOS, Android, and XR platforms. One GraphQL schema generates type-safe code for Swift, Kotlin, TypeScript, Dart, and GDScript."
        path="/introduction"
        keywords="OpenIAP, in-app purchase specification, StoreKit 2, Google Play Billing, cross-platform IAP, type-safe IAP, GraphQL schema"
      />
      <div className="content-wrapper">
        {/* Title */}
        <h1>Why OpenIAP</h1>
        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-secondary)',
            marginBottom: '2.5rem',
            lineHeight: '1.7',
          }}
        >
          OpenIAP is a unified specification for in-app purchases across iOS,
          Android, and XR platforms. One GraphQL schema generates type-safe
          native code for Swift, Kotlin, TypeScript, Dart, and GDScript.
        </p>

        {/* The Problem */}
        <section className="intro-section">
          <h2>The Problem</h2>
          <p style={{ lineHeight: '1.8', marginBottom: '1.5rem' }}>
            In-app purchase implementations are fragmented across platforms and
            frameworks. Each library defines its own API surface, type
            definitions, and event patterns. This creates several challenges:
          </p>
          <ul
            style={{
              lineHeight: '1.8',
              marginBottom: '1.5rem',
              paddingLeft: '1.5rem',
            }}
          >
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Inconsistent APIs</strong> — Method names, parameter
              structures, and return types differ between{' '}
              <code>react-native-iap</code>, <code>flutter_inapp_purchase</code>
              , and other libraries
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Duplicated effort</strong> — Library maintainers
              independently solve the same problems (transaction handling, error
              codes, subscription lifecycle)
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Platform drift</strong> — When Apple adds StoreKit 2
              features or Google updates Play Billing, each library implements
              changes differently
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>AI limitations</strong> — AI assistants cannot generate
              reliable IAP code because no two libraries work the same way
            </li>
          </ul>
          <p style={{ lineHeight: '1.8', color: 'var(--text-secondary)' }}>
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
          <p style={{ lineHeight: '1.8', marginBottom: '1.5rem' }}>
            OpenIAP provides a single source of truth for IAP implementations.
            The specification defines:
          </p>
          <ul
            style={{
              lineHeight: '1.8',
              marginBottom: '1.5rem',
              paddingLeft: '1.5rem',
            }}
          >
            <li style={{ marginBottom: '0.75rem' }}>
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
            <li style={{ marginBottom: '0.75rem' }}>
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
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Standard event patterns</strong> —{' '}
              <Link to="/docs/events#purchase-updated-event">
                <code>purchaseUpdatedListener</code>
              </Link>
              ,{' '}
              <Link to="/docs/events#purchase-error-event">
                <code>purchaseErrorListener</code>
              </Link>
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Platform-aware naming</strong> — Cross-platform types use
              no suffix, platform-specific use <code>IOS</code>/
              <code>Android</code> suffix
            </li>
          </ul>
        </section>

        {/* Architecture */}
        <section className="intro-section">
          <h2>Architecture</h2>
          <p style={{ lineHeight: '1.8', marginBottom: '1.5rem' }}>
            OpenIAP uses a schema-driven approach. A single GraphQL schema
            defines all types and operations, which are then generated into
            native code for each target platform.
          </p>

          <div
            style={{
              margin: '1.5rem 0',
              textAlign: 'center',
            }}
          >
            <Link to="/docs/ecosystem">
              <img
                src="/ecosystem.png"
                alt="OpenIAP Architecture - GraphQL schema generates native modules"
                style={{
                  maxWidth: '100%',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              />
            </Link>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginTop: '0.75rem',
              }}
            >
              <Link to="/docs/ecosystem">View ecosystem documentation →</Link>
            </p>
          </div>

          <h3>Code Generation</h3>
          <p style={{ lineHeight: '1.8', marginBottom: '1rem' }}>
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
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              overflowX: 'auto',
              marginBottom: '1.5rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <pre style={{ margin: 0 }}>
              {`packages/apple/Sources/Models/Types.swift    # Swift types
packages/google/openiap/src/main/Types.kt    # Kotlin types
src/generated/types.ts                       # TypeScript types
src/generated/types.dart                     # Dart types
src/generated/types.gd                       # GDScript types`}
            </pre>
          </div>

          <h3>Native Modules</h3>
          <p style={{ lineHeight: '1.8', marginBottom: '1rem' }}>
            Two native modules implement the specification on top of platform
            APIs:
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>
                openiap-apple
              </strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
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
            </a>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>
                openiap-google
              </strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
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
            </a>
          </div>
        </section>

        {/* API Design */}
        <section className="intro-section">
          <h2>API Design</h2>

          <h3>Naming Conventions</h3>
          <p style={{ lineHeight: '1.8', marginBottom: '1rem' }}>
            OpenIAP uses consistent naming across all implementations:
          </p>
          <div
            style={{
              overflowX: 'auto',
              marginBottom: '1.5rem',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '2px solid var(--border-color)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Scope</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Pattern</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>Cross-platform</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <code>functionName</code>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <code>fetchProducts()</code>, <code>requestPurchase()</code>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>iOS-only</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <code>functionNameIOS</code>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <code>syncIOS()</code>, <code>getStorefrontIOS()</code>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>Android-only</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <code>functionNameAndroid</code>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <code>acknowledgePurchaseAndroid()</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Type Safety</h3>
          <p style={{ lineHeight: '1.8', marginBottom: '1rem' }}>
            Generated types ensure compile-time safety. Platform-specific fields
            use suffixes to prevent accidental cross-platform usage:
          </p>
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              overflowX: 'auto',
              marginBottom: '1.5rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <pre style={{ margin: 0 }}>
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
            </pre>
          </div>
        </section>

        {/* Purchase Flow */}
        <section className="intro-section">
          <h2>Purchase Flow</h2>
          <p style={{ lineHeight: '1.8', marginBottom: '1rem' }}>
            The standard purchase flow works identically across all OpenIAP
            implementations:
          </p>
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              overflowX: 'auto',
              marginBottom: '1.5rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <pre style={{ margin: 0 }}>
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
            </pre>
          </div>
          <p style={{ lineHeight: '1.8', color: 'var(--text-secondary)' }}>
            See <Link to="/docs/lifecycle">Purchase Lifecycle</Link> for
            detailed flow documentation.
          </p>
        </section>

        {/* Supported Platforms */}
        <section className="intro-section">
          <h2>Supported Platforms</h2>
          <div
            style={{
              overflowX: 'auto',
              marginBottom: '1.5rem',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '2px solid var(--border-color)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Platform</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Billing API</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Min Version</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>iOS</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://developer.apple.com/storekit/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      StoreKit 2
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>iOS 15.0+</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>macOS</td>
                  <td style={{ padding: '0.75rem 1rem' }}>StoreKit 2</td>
                  <td style={{ padding: '0.75rem 1rem' }}>macOS 12.0+</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>visionOS</td>
                  <td style={{ padding: '0.75rem 1rem' }}>StoreKit 2</td>
                  <td style={{ padding: '0.75rem 1rem' }}>visionOS 1.0+</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>Android</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://developer.android.com/google/play/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Play Billing v8
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>API 21+ (5.0)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>Meta Quest</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to="/docs/horizon-setup">Horizon OS</Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>Quest 2+</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Framework Implementations */}
        <section className="intro-section">
          <h2>Framework Implementations</h2>
          <p style={{ lineHeight: '1.8', marginBottom: '1rem' }}>
            Production-ready libraries implementing the OpenIAP specification:
          </p>
          <div
            style={{
              overflowX: 'auto',
              marginBottom: '1.5rem',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '2px solid var(--border-color)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Library</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Framework</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Bridge</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://github.com/dooboolab-community/react-native-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      react-native-iap
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>React Native</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://github.com/margelo/nitro"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Nitro Modules
                    </a>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://github.com/hyochan/expo-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      expo-iap
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>Expo</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://docs.expo.dev/modules/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Expo Modules
                    </a>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://github.com/hyochan/flutter_inapp_purchase"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      flutter_inapp_purchase
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>Flutter</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://pub.dev/packages/pigeon"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pigeon
                    </a>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://github.com/nicemiro/kmp-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      kmp-iap
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    Kotlin Multiplatform
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://kotlinlang.org/docs/native-objc-interop.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      K/N Interop
                    </a>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a
                      href="https://github.com/nicemiro/godot-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      godot-iap
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>Godot 4.x</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
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
          <p style={{ color: 'var(--text-secondary)' }}>
            <Link to="/languages">View all implementations →</Link>
          </p>
        </section>

        {/* Getting Started */}
        <section className="intro-section">
          <h2>Getting Started</h2>
          <p style={{ lineHeight: '1.8', marginBottom: '1.5rem' }}>
            Choose your framework to get started:
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <Link
              to="/docs/apis"
              style={{
                display: 'block',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <strong>API Reference</strong>
              <p
                style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Core methods and patterns
              </p>
            </Link>
            <Link
              to="/docs/types"
              style={{
                display: 'block',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <strong>Type Definitions</strong>
              <p
                style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Generated types for all languages
              </p>
            </Link>
            <Link
              to="/docs/lifecycle"
              style={{
                display: 'block',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <strong>Purchase Lifecycle</strong>
              <p
                style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Transaction flow diagrams
              </p>
            </Link>
            <Link
              to="/tutorials"
              style={{
                display: 'block',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <strong>Tutorials</strong>
              <p
                style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Step-by-step guides
              </p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Introduction;
