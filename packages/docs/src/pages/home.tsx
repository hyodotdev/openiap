import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  ShieldCheck,
  Star,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { OPENIAP_VERSIONS } from '../lib/versioning';
import {
  IAPKIT_LOGO_PATH,
  IAPKIT_URL,
  LOGO_PATH,
  trackIapKitClick,
} from '../lib/config';
import { LIBRARIES, LIBRARY_IMAGES } from '../lib/images';
import { FEATURED_SHOWCASE_APPS } from '../lib/showcase';
import SEO from '../components/SEO';

interface IapKitFeature {
  title: string;
  description: string;
  icon: LucideIcon;
}

const IAPKIT_FEATURES: IapKitFeature[] = [
  {
    title: 'Store operations with MCP',
    description:
      'Ask your coding agent to create and manage products, then sync them to App Store Connect and Google Play.',
    icon: Boxes,
  },
  {
    title: 'Purchase verification',
    description:
      'Validate Apple, Google Play, Amazon Appstore, Meta Horizon, and Vega OS purchases server-side.',
    icon: ShieldCheck,
  },
  {
    title: 'Subscription state',
    description:
      'Track subscription status and user entitlements from store lifecycle events.',
    icon: Webhook,
  },
  {
    title: 'Revenue visibility',
    description:
      'With store notifications connected, monitor revenue, MRR, churn, and refunds.',
    icon: BarChart3,
  },
];

function Home() {
  return (
    <div className="home">
      <SEO
        title="Unified In-App Purchase Specification"
        description="OpenIAP standardizes in-app purchases across iOS, Android, Expo, React Native, Flutter, Kotlin Multiplatform, .NET MAUI, and Godot. One API, every platform. StoreKit 2, Google Play Billing, Vision Pro, Horizon OS, Fire OS, and Vega OS."
        path="/"
        keywords="in-app purchase, IAP, StoreKit 2, Google Play Billing, Expo IAP, React Native IAP, Flutter IAP, Kotlin Multiplatform, .NET MAUI, Amazon Fire OS, Vega OS, cross-platform payments, mobile monetization"
        includeAppSchema
      />
      <section className="hero">
        <div className="hero-container">
          <div className="hero-main">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span>The open IAP standard</span>
                <Link to="/docs/updates/versions" title="View versions">
                  Spec v{OPENIAP_VERSIONS.spec}
                </Link>
              </div>
              <h1 className="hero-brand-heading">
                <span className="hero-brand-word">
                  Open<strong>IAP</strong>
                </span>
                <span className="hero-brand-promise">
                  One API for every store
                </span>
              </h1>
              <p className="hero-subtitle">
                One type-safe purchase contract across Apple, Google, Amazon,
                Meta, and {LIBRARIES.length} app frameworks.
              </p>
              <div className="hero-actions">
                <Link
                  to="/introduction"
                  className="btn btn-primary hero-cta-primary"
                >
                  Start building
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  to="/docs/apis"
                  className="btn btn-secondary hero-cta-secondary"
                >
                  Explore the API
                </Link>
              </div>
              <div className="hero-proof">
                <a
                  href="https://github.com/hyodotdev/openiap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <strong>4K+</strong> combined GitHub stars
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
                <span>
                  <strong>{LIBRARIES.length}</strong> framework libraries
                </span>
              </div>
            </div>

            <div className="hero-orbit">
              <div
                className="hero-orbit-ring hero-orbit-ring-outer"
                aria-hidden="true"
              />
              <div
                className="hero-orbit-ring hero-orbit-ring-inner"
                aria-hidden="true"
              />
              <span className="hero-orbit-node hero-orbit-node-apple">
                StoreKit 2
              </span>
              <span className="hero-orbit-node hero-orbit-node-google">
                Play Billing
              </span>
              <span className="hero-orbit-node hero-orbit-node-amazon">
                Amazon
              </span>
              <span className="hero-orbit-node hero-orbit-node-horizon">
                Horizon
              </span>
              <span className="hero-orbit-node hero-orbit-node-vega">
                Vega OS
              </span>
              <div className="hero-orbit-core">
                <span>One open contract</span>
                <img src={LOGO_PATH} alt="OpenIAP mascot" />
                <div className="hero-orbit-actions">
                  <Link to="/docs/apis/request-purchase">
                    <code>requestPurchase()</code>
                  </Link>
                  <a
                    href="https://github.com/hyodotdev/openiap"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Star size={12} fill="currentColor" aria-hidden="true" />
                    Star OpenIAP
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-trust">
            <div className="hero-native">
              <span>Native core</span>
              <div className="hero-native-links">
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={LIBRARY_IMAGES['openiap-apple']}
                    alt=""
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Apple</strong>
                    <small>StoreKit 2</small>
                  </span>
                </a>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={LIBRARY_IMAGES['openiap-google']}
                    alt=""
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Google Play</strong>
                    <small>Billing 9.1</small>
                  </span>
                </a>
              </div>
            </div>

            <div className="hero-frameworks">
              <span>Frameworks</span>
              <div>
                {LIBRARIES.map((library) => (
                  <Link
                    key={library.name}
                    to={library.setupPath}
                    className="hero-framework-link"
                    title={library.frameworkName}
                  >
                    <img src={library.image} alt="" aria-hidden="true" />
                    <span>{library.homeLabel}</span>
                  </Link>
                ))}
              </div>
            </div>

            <Link to="/sponsors" className="hero-backer">
              <span>Backed by</span>
              <span>
                <img src="/sponsors/meta.webp" alt="Meta" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section section-problem">
        <div className="section-container openiap-case">
          <div className="openiap-case-header">
            <div>
              <p className="home-section-kicker">The problem</p>
              <h2>Different stores, one contract</h2>
            </div>
            <p>
              Every store ships its own API, types, and events. Your product
              logic should not have to be rewritten for each one.
            </p>
          </div>

          <div className="openiap-comparison">
            <div className="openiap-fragmented">
              <div className="openiap-comparison-label">
                <span>Without a shared contract</span>
                <strong>Repeat the same work</strong>
              </div>
              <div className="openiap-store-matrix">
                <div>
                  <strong>StoreKit 2</strong>
                  <span>API</span>
                  <span>Types</span>
                  <span>Events</span>
                </div>
                <div>
                  <strong>Play Billing</strong>
                  <span>API</span>
                  <span>Types</span>
                  <span>Events</span>
                </div>
                <div>
                  <strong>Amazon</strong>
                  <span>API</span>
                  <span>Types</span>
                  <span>Events</span>
                </div>
                <div>
                  <strong>Horizon</strong>
                  <span>API</span>
                  <span>Types</span>
                  <span>Events</span>
                </div>
                <div>
                  <strong>Vega OS</strong>
                  <span>API</span>
                  <span>Types</span>
                  <span>Events</span>
                </div>
              </div>
            </div>
            <Link to="/docs/apis/request-purchase" className="openiap-unified">
              <span>One shared contract</span>
              <code>requestPurchase()</code>
              <small>Same method · generated types · predictable events</small>
              <strong>
                See the API
                <ArrowUpRight size={15} aria-hidden="true" />
              </strong>
            </Link>
          </div>

          <div className="openiap-outcomes">
            <article>
              <span>01</span>
              <h3>One implementation</h3>
              <p>
                Build purchase logic once across {LIBRARIES.length} framework
                libraries.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Types that agree</h3>
              <p>
                Generated models catch mismatches before they reach production.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Native when needed</h3>
              <p>
                Keep access to platform-specific capabilities without forking
                the whole flow.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="home-section section-how">
        <div className="section-container openiap-specification">
          <div className="home-section-heading home-section-heading-centered">
            <div>
              <p className="home-section-kicker">How OpenIAP works</p>
              <h2>One contract, three surfaces</h2>
            </div>
          </div>
          <div className="specification-grid">
            <div className="spec-card">
              <div className="spec-card-header">
                <div className="spec-index">01 / Methods</div>
                <h3>Unified APIs</h3>
                <p>Standard methods across all platforms</p>
              </div>
              <div className="spec-items">
                <Link to="/docs/apis/init-connection" className="spec-item">
                  <code>initConnection()</code>
                  <span>Initialize IAP service</span>
                </Link>
                <Link to="/docs/apis/fetch-products" className="spec-item">
                  <code>fetchProducts()</code>
                  <span>Fetch product details</span>
                </Link>
                <Link to="/docs/apis/request-purchase" className="spec-item">
                  <code>requestPurchase()</code>
                  <span>Initiate purchase flow</span>
                </Link>
                <Link to="/docs/apis/finish-transaction" className="spec-item">
                  <code>finishTransaction()</code>
                  <span>Complete purchase</span>
                </Link>
                <Link
                  to="/docs/apis/get-available-purchases"
                  className="spec-item"
                >
                  <code>getAvailablePurchases()</code>
                  <span>Restore entitlements</span>
                </Link>
                <Link
                  to="/docs/apis/get-active-subscriptions"
                  className="spec-item"
                >
                  <code>getActiveSubscriptions()</code>
                  <span>Query active subscriptions</span>
                </Link>
              </div>
            </div>

            <div className="spec-card">
              <div className="spec-card-header">
                <div className="spec-index">02 / Signals</div>
                <h3>Standard Events</h3>
                <p>Consistent event handling patterns</p>
              </div>
              <div className="spec-items">
                <Link
                  to="/docs/events/purchase-updated-listener"
                  className="spec-item"
                >
                  <code>purchaseUpdatedListener</code>
                  <span>Purchase state changes</span>
                </Link>
                <Link
                  to="/docs/events/purchase-error-listener"
                  className="spec-item"
                >
                  <code>purchaseErrorListener</code>
                  <span>Error handling</span>
                </Link>
                <Link
                  to="/docs/events/ios/promoted-product-listener-ios"
                  className="spec-item"
                >
                  <code>promotedProductListenerIOS</code>
                  <span>App Store promoted products</span>
                </Link>
                <Link
                  to="/docs/events/android/user-choice-billing-listener-android"
                  className="spec-item"
                >
                  <code>userChoiceBillingListenerAndroid</code>
                  <span>User Choice Billing selection</span>
                </Link>
                <Link
                  to="/docs/events/android/developer-provided-billing-listener-android"
                  className="spec-item"
                >
                  <code>developerProvidedBillingListenerAndroid</code>
                  <span>External billing choice</span>
                </Link>
                <Link
                  to="/docs/events/subscription-billing-issue-listener"
                  className="spec-item"
                >
                  <code>subscriptionBillingIssueListener</code>
                  <span>Suspended / retry subscriptions</span>
                </Link>
              </div>
            </div>

            <div className="spec-card">
              <div className="spec-card-header">
                <div className="spec-index">03 / Data</div>
                <h3>Unified Types</h3>
                <p>Common data structures for all platforms</p>
              </div>
              <div className="spec-items">
                <Link to="/docs/types/product" className="spec-item">
                  <code>Product</code>
                  <span>Product information</span>
                </Link>
                <Link to="/docs/types/purchase" className="spec-item">
                  <code>Purchase</code>
                  <span>Transaction details</span>
                </Link>
                <Link to="/docs/errors" className="spec-item">
                  <code>PurchaseError</code>
                  <span>Error definitions</span>
                </Link>
                <Link
                  to="/docs/types/ios/subscription-period-ios"
                  className="spec-item"
                >
                  <code>SubscriptionPeriod</code>
                  <span>Billing cycles</span>
                </Link>
                <Link
                  to="/docs/types/subscription-product"
                  className="spec-item"
                >
                  <code>ProductSubscription</code>
                  <span>Subscription product shape</span>
                </Link>
                <Link
                  to="/docs/types/active-subscription"
                  className="spec-item"
                >
                  <code>ActiveSubscription</code>
                  <span>Entitlement status payload</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section section-iapkit">
        <div className="section-container iapkit-home-panel">
          <div className="iapkit-home-copy">
            <p className="iapkit-home-eyebrow">Hosted infrastructure</p>
            <h2>Your IAP backend</h2>
            <p>
              Verification, entitlements, store notifications, MCP product sync,
              and revenue metrics—all hosted.
            </p>
            <div className="iapkit-home-actions">
              <a
                href={IAPKIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                onClick={trackIapKitClick}
              >
                <img
                  src={IAPKIT_LOGO_PATH}
                  alt=""
                  className="iapkit-home-cta-logo"
                  aria-hidden="true"
                />
                <span>Open IAPKit</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
              <Link to="/docs/guides/mcp-server" className="btn btn-secondary">
                MCP workflow
              </Link>
            </div>
          </div>

          <div className="iapkit-home-features">
            <div
              className="iapkit-home-route"
              role="img"
              aria-label="Your app connects to Apple App Store, Google Play, Amazon Appstore, Meta Horizon, and Vega OS through IAPKit"
            >
              <span>Your app</span>
              <span className="iapkit-home-route-line" aria-hidden="true" />
              <span className="iapkit-home-route-brand">
                <img src={IAPKIT_LOGO_PATH} alt="" aria-hidden="true" />
                <strong>IAPKit</strong>
              </span>
              <span className="iapkit-home-route-line" aria-hidden="true" />
              <span className="iapkit-home-route-stores">
                <strong>Store ecosystems</strong>
                <small>Apple · Google · Amazon · Meta · Vega</small>
              </span>
            </div>
            <ol className="iapkit-home-feature-list">
              {IAPKIT_FEATURES.map((feature, index) => {
                const FeatureIcon = feature.icon;

                return (
                  <li key={feature.title} className="iapkit-home-feature">
                    <span
                      className="iapkit-home-feature-index"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div
                      className="iapkit-home-feature-icon"
                      aria-hidden="true"
                    >
                      <FeatureIcon size={21} strokeWidth={1.7} />
                    </div>
                    <div>
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <section className="home-section section-who">
        <div className="section-container home-community">
          <div className="home-community-intro">
            <p className="home-section-kicker">Community</p>
            <h2>OpenIAP Community</h2>
            <p>Resources, apps, and voices from across the ecosystem.</p>
          </div>

          <nav className="home-community-index" aria-label="Community sections">
            <Link to="/community-resources#resources">
              <span>01</span>
              <div>
                <strong>Resources</strong>
                <small>Articles · tutorials · videos</small>
              </div>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/community-resources#apps">
              <span>02</span>
              <div>
                <strong>Apps built with OpenIAP</strong>
                <small>Products shipping across app stores</small>
                <span className="home-community-app-icons" aria-hidden="true">
                  {FEATURED_SHOWCASE_APPS.slice(0, 4).map((app) => (
                    <img key={app.name} src={app.logo} alt="" />
                  ))}
                </span>
              </div>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/community-resources#contribute">
              <span>03</span>
              <div>
                <strong>Contribute</strong>
                <small>Share an article or app</small>
              </div>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </section>

      <section className="home-section section-sponsors">
        <div className="section-container home-sponsors">
          <div className="home-sponsors-copy">
            <p className="home-section-kicker">Open-source support</p>
            <h2>Backed to stay open</h2>
            <p>
              Sponsor the shared purchase layer that keeps native stores and
              framework SDKs moving together.
            </p>
          </div>

          <div className="home-sponsor-ledger">
            <div className="home-sponsor-featured">
              <span className="home-sponsor-label">
                <span>01</span>
                Sponsors
              </span>
              <div className="home-sponsor-meta">
                <a
                  className="home-sponsor-logo-link"
                  href="https://meta.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit Meta"
                >
                  <img src="/sponsors/meta.webp" alt="Meta" />
                </a>
                <span className="home-sponsor-tier">Angel</span>
              </div>
            </div>

            <div
              className="home-sponsor-flow"
              role="img"
              aria-label={`Meta sponsors OpenIAP, helping maintain ${LIBRARIES.length} framework SDKs`}
            >
              <span>Meta</span>
              <i>sponsors</i>
              <strong>OpenIAP</strong>
              <i>helping maintain</i>
              <span>{LIBRARIES.length} framework SDKs</span>
            </div>

            <Link className="home-sponsor-invite" to="/sponsors">
              <span>Next</span>
              <span>
                <strong>Put your name behind the standard</strong>
                <small>
                  Fund maintenance, testing, and shared infrastructure
                </small>
              </span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
