import { Link } from 'react-router-dom';
import { OPENIAP_VERSIONS } from '../lib/versioning';
import { LOGO_PATH } from '../lib/config';
import SEO from '../components/SEO';

function Home() {
  return (
    <div className="home">
      <SEO
        title="Unified In-App Purchase Specification"
        description="OpenIAP standardizes in-app purchases across iOS, Android, React Native, Flutter, Kotlin Multiplatform, and Godot. One API, every platform. StoreKit 2, Google Play Billing, Vision Pro, Horizon OS."
        path="/"
        keywords="in-app purchase, IAP, StoreKit 2, Google Play Billing, React Native IAP, Flutter IAP, Kotlin Multiplatform, cross-platform payments, mobile monetization"
        includeAppSchema
      />
      <section className="hero">
        <div className="hero-container">
          <img
            src={LOGO_PATH}
            alt="OpenIAP"
            className="hero-logo"
            style={{ width: '240px', height: '240px', marginBottom: '-0.5rem' }}
          />
          <h1 className="hero-title" style={{ letterSpacing: '-0.05em' }}>
            Open<span className="highlight">IAP</span>
          </h1>
          <div style={{ marginBottom: '1.5rem' }}>
            <Link
              to="/docs/updates/versions"
              style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                borderRadius: '1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                letterSpacing: '0.5px',
                textDecoration: 'none',
              }}
              title="View versions"
            >
              v{OPENIAP_VERSIONS.gql}
            </Link>
          </div>
          <p className="hero-subtitle">
            Stop rewriting IAP code for every platform. One API for iOS,
            Android, Vision Pro, and Meta Quest.
          </p>
          {/* Quick Stats */}
          <div className="quick-stats">
            <Link to="/languages" className="quick-stats-item">
              {/* Aggregate stars across ecosystem repos - update periodically */}
              <div className="quick-stats-value">4K+</div>
              <div className="quick-stats-label">Combined Stars</div>
            </Link>
            <div className="quick-stats-item">
              <div className="quick-stats-value">5+</div>
              <div className="quick-stats-label">Framework Libraries</div>
            </div>
          </div>
          <div className="hero-actions">
            <Link to="/introduction" className="btn btn-primary">
              Get Started
            </Link>
            <a
              href="https://github.com/hyodotdev/openiap"
              className="btn btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Github
            </a>
          </div>
          <div className="hero-divider" role="separator" aria-hidden="true" />
          <div className="hero-caption">Our Core Libraries</div>
          <div className="hero-modules hero-modules-grid">
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
              target="_blank"
              rel="noopener noreferrer"
              className="module-card"
              title="OpenIAP module for Apple"

              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg fill="#ffffff" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '36px', height: '36px', marginBottom: '0.75rem' }}><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>
              <div className="module-text">
                <div className="module-title">openiap-apple</div>
                <div className="module-desc">
                  Apple StoreKit 2 official module
                </div>
              </div>
            </a>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
              target="_blank"
              rel="noopener noreferrer"
              className="module-card"
              title="OpenIAP module for Google"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ width: '36px', height: '36px', marginBottom: '0.75rem' }}><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              <div className="module-text">
                <div className="module-title">openiap-google</div>
                <div className="module-desc">
                  Google Play Billing official module
                </div>
              </div>
            </a>
          </div>
          <div className="hero-divider" role="separator" aria-hidden="true" />
          <div className="hero-caption">Supported Frameworks</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2.5rem',
              flexWrap: 'wrap',
              margin: '1.5rem 0',
            }}
          >
            <a href="/docs/setup/react-native" title="React Native" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-secondary)', opacity: 0.85, transition: 'opacity 0.2s' }}>
              <img src="/frameworks/react-native.webp" alt="React Native" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <span style={{ fontSize: '0.8rem' }}>React Native</span>
            </a>
            <a href="/docs/setup/expo" title="Expo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-secondary)', opacity: 0.85, transition: 'opacity 0.2s' }}>
              <img src="/frameworks/expo.svg" alt="Expo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <span style={{ fontSize: '0.8rem' }}>Expo</span>
            </a>
            <a href="/docs/setup/flutter" title="Flutter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-secondary)', opacity: 0.85, transition: 'opacity 0.2s' }}>
              <img src="/frameworks/flutter.webp" alt="Flutter" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <span style={{ fontSize: '0.8rem' }}>Flutter</span>
            </a>
            <a href="/docs/setup/kmp" title="Kotlin Multiplatform" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-secondary)', opacity: 0.85, transition: 'opacity 0.2s' }}>
              <img src="/frameworks/kmp.svg" alt="Kotlin Multiplatform" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <span style={{ fontSize: '0.8rem' }}>KMP</span>
            </a>
            <a href="/docs/setup/godot" title="Godot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-secondary)', opacity: 0.85, transition: 'opacity 0.2s' }}>
              <img src="/frameworks/godot.webp" alt="Godot" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <span style={{ fontSize: '0.8rem' }}>Godot</span>
            </a>
          </div>
          <div
            style={{
              marginTop: '3rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <Link
              to="/sponsors"
              style={{
                fontSize: '0.9rem',
                color: 'var(--accent-color)',
                margin: 0,
                textDecoration: 'none',
                fontWeight: '500',
                letterSpacing: '0.3px',
              }}
            >
              Backed by
            </Link>
            <a
              href="https://meta.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                textDecoration: 'none',
              }}
            >
              <img
                src="/meta.svg"
                alt="Meta Logo"
                style={{ height: '40px', objectFit: 'contain' }}
              />
              <img
                src="/meta-txt.svg"
                alt="Meta Text"
                style={{
                  height: '40px',
                  objectFit: 'contain',
                  filter: 'var(--logo-text-filter, none)',
                }}
              />
            </a>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="home-section">
        <div className="section-container">
          <h2 className="section-title">Why Developers Choose OpenIAP</h2>
          <p className="section-subtitle">
            Build revenue-generating features faster with less code
          </p>
          <div className="key-benefits">
            <div className="key-benefit-card">
              <div className="key-benefit-value">1x</div>
              <h3>Learn Once</h3>
              <p>
                Master one API instead of learning different patterns for iOS,
                Android, and every framework
              </p>
            </div>
            <div className="key-benefit-card">
              <div className="key-benefit-value">0</div>
              <h3>Runtime Errors</h3>
              <p>
                Type-safe generated code catches mistakes at compile time, not
                in production
              </p>
            </div>
            <div className="key-benefit-card">
              <div className="key-benefit-value">100%</div>
              <h3>Platform Features</h3>
              <p>
                Full access to StoreKit 2 and Play Billing v8 — no features
                hidden or abstracted away
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section section-problem">
        <div className="section-container">
          <h2>The Problem We're Solving</h2>
          <p
            className="section-subtitle"
            style={{
              maxWidth: '800px',
              margin: '0 auto 3rem',
              lineHeight: '1.8',
              textAlign: 'center',
            }}
          >
            Every new platform and framework creates its own IAP implementation.
            Library maintainers independently design APIs, leading to fragmented
            specifications. Developers must learn different APIs for each
            platform, increasing complexity and errors.
            <br />
            <br />
            <strong>OpenIAP is our answer:</strong> A unified, open
            specification that reduces fragmentation and enables consistent IAP
            implementations across all platforms. This standardization is
            especially critical in the AI coding era.
          </p>
          <div className="benefit-grid">
            <div className="benefit">
              <h3>End Fragmentation</h3>
              <p>
                Multiple IAP libraries with different APIs create complexity.
                OpenIAP provides a unified specification that all libraries can
                implement.
              </p>
            </div>
            <div className="benefit">
              <h3>Future-Proof</h3>
              <p>
                As StoreKit 2, Android Billing v8, and new platforms emerge,
                OpenIAP abstracts these changes behind a stable API.
              </p>
            </div>
            <div className="benefit">
              <h3>AI-Ready</h3>
              <p>
                In the AI coding era, standardized APIs are crucial. OpenIAP
                enables AI assistants to generate consistent IAP code.
              </p>
            </div>
            <div className="benefit">
              <h3>Cross-Platform Native</h3>
              <p>
                From React Native to Flutter to KMP, every framework needs IAP.
                One specification, multiple implementations.
              </p>
            </div>
            <div className="benefit">
              <h3>Community-Driven</h3>
              <p>
                Library maintainers collaborate on a shared specification
                instead of creating isolated, incompatible solutions.
              </p>
            </div>
            <div className="benefit">
              <h3>XR-Compatible</h3>
              <p>
                Horizon OS and Vision Pro supported. Android XR coming soon.
                OpenIAP is ready for the spatial computing era.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section section-how">
        <div className="section-container">
          <h2>How OpenIAP Works</h2>
          <p className="section-subtitle">
            Unifying diverse platform APIs into a single, consistent
            specification
          </p>
          <div className="specification-grid">
            <div className="spec-card">
              <div className="spec-card-header">
                <div className="spec-icon">📋</div>
                <h3>Unified APIs</h3>
                <p>Standard methods across all platforms</p>
              </div>
              <div className="spec-items">
                <Link to="/docs/apis#init-connection" className="spec-item">
                  <code>initConnection()</code>
                  <span>Initialize IAP service</span>
                </Link>
                <Link to="/docs/apis#fetch-products" className="spec-item">
                  <code>fetchProducts()</code>
                  <span>Fetch product details</span>
                </Link>
                <Link to="/docs/apis#request-purchase" className="spec-item">
                  <code>requestPurchase()</code>
                  <span>Initiate purchase flow</span>
                </Link>
                <Link to="/docs/apis#finish-transaction" className="spec-item">
                  <code>finishTransaction()</code>
                  <span>Complete purchase</span>
                </Link>
              </div>
            </div>

            <div className="spec-card">
              <div className="spec-card-header">
                <div className="spec-icon">⚡</div>
                <h3>Standard Events</h3>
                <p>Consistent event handling patterns</p>
              </div>
              <div className="spec-items">
                <Link
                  to="/docs/events#purchase-updated-event"
                  className="spec-item"
                >
                  <code>purchaseUpdatedListener</code>
                  <span>Purchase state changes</span>
                </Link>
                <Link
                  to="/docs/events#purchase-error-event"
                  className="spec-item"
                >
                  <code>purchaseErrorListener</code>
                  <span>Error handling</span>
                </Link>
              </div>
            </div>

            <div className="spec-card">
              <div className="spec-card-header">
                <div className="spec-icon">🔧</div>
                <h3>Unified Types</h3>
                <p>Common data structures for all platforms</p>
              </div>
              <div className="spec-items">
                <Link to="/docs/types#product" className="spec-item">
                  <code>Product</code>
                  <span>Product information</span>
                </Link>
                <Link to="/docs/types#purchase" className="spec-item">
                  <code>Purchase</code>
                  <span>Transaction details</span>
                </Link>
                <Link to="/docs/types#purchaseerror" className="spec-item">
                  <code>PurchaseError</code>
                  <span>Error definitions</span>
                </Link>
                <Link to="/docs/types#subscriptionperiod" className="spec-item">
                  <code>SubscriptionPeriod</code>
                  <span>Billing cycles</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section section-who">
        <div className="section-container" style={{ maxWidth: '640px' }}>
          <h2>Who uses OpenIAP?</h2>
          <p className="section-subtitle" style={{ maxWidth: '880px', margin: '0 auto' }}>
            Ship your app with OpenIAP or its libraries (<a href="/docs/setup/react-native">react-native-iap</a>, <a href="/docs/setup/expo">expo-iap</a>, <a href="/docs/setup/flutter">flutter_inapp_purchase</a>, <a href="/docs/setup/kmp">kmp-iap</a>, <a href="/docs/setup/godot">godot-iap</a>)?
            <br />
            We'd love to showcase it here.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              marginTop: '2rem',
              padding: '2rem',
              border: '2px dashed var(--border-color)',
              borderRadius: '1rem',
              maxWidth: '480px',
              margin: '2rem auto 0',
            }}
          >
            <p
              style={{
                textAlign: 'center',
                lineHeight: '1.7',
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              Send us your app name, logo, platform links, and which library you
              use — we'll add you to this section.
            </p>
            <a
              href="mailto:hyo@hyo.dev?subject=OpenIAP Showcase Request&body=App Name:%0AApp Logo (URL or attached):%0APlatform Links:%0A- iOS: %0A- Android: %0A%0AWhich OpenIAP library do you use?"
              style={{
                display: 'inline-block',
                padding: '0.75rem 2rem',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '1rem',
              }}
            >
              Submit Your App
            </a>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              Contact: Hyo — Lead Maintainer (<a href="mailto:hyo@hyo.dev" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>hyo@hyo.dev</a>)
            </p>
          </div>
        </div>
      </section>

      <section className="home-section section-why">
        <div className="section-container">
          <h2>Our Sponsors</h2>
          <p className="section-subtitle">
            Thank you for helping us build a better IAP ecosystem for everyone
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3rem',
              marginTop: '3rem',
            }}
          >
            <a
              href="https://meta.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
              }}
            >
              <img
                src="/meta.svg"
                alt="Meta Logo"
                style={{ height: '60px', objectFit: 'contain' }}
              />
              <img
                src="/meta-txt.svg"
                alt="Meta Text"
                style={{
                  height: '60px',
                  objectFit: 'contain',
                  filter: 'var(--logo-text-filter, none)',
                }}
              />
            </a>
            <Link
              to="/sponsors"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 2rem',
                background:
                  'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
                color: 'white',
                borderRadius: '2rem',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '0.95rem',
                boxShadow: '0 4px 14px rgba(164, 116, 101, 0.3)',
                transition: 'all 0.3s ease',
                border: '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow =
                  '0 6px 20px rgba(164, 116, 101, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 4px 14px rgba(164, 116, 101, 0.3)';
              }}
            >
              <span>💎</span> Become a Sponsor
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
