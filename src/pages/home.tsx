import { Link } from 'react-router-dom';
import { LATEST_VERSION } from './docs/versions';

function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-container">
          <img
            src="/logo.png"
            alt="Open IAP"
            className="hero-logo"
            style={{ width: '120px', height: '120px', marginBottom: '2rem' }}
          />
          <h1 className="hero-title">
            Open <span className="highlight">IAP</span> Specification
          </h1>
          <div style={{ marginBottom: '1.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                borderRadius: '1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                letterSpacing: '0.5px',
              }}
            >
              {LATEST_VERSION}
            </span>
          </div>
          <p className="hero-subtitle">
            Unifying fragmented IAP implementations across platforms,
            frameworks, and emerging technologies
          </p>
          <div className="hero-actions">
            <Link to="/introduction" className="btn btn-primary">
              Get Started
            </Link>
            <a
              href="https://github.com/hyochan/openiap.dev"
              className="btn btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Github
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
            <strong>Open IAP is our answer:</strong> A unified, open
            specification that reduces fragmentation and enables consistent IAP
            implementations across all platforms. This standardization is
            especially critical in the AI coding era.
          </p>
          <div className="benefit-grid">
            <div className="benefit">
              <h3>End Fragmentation</h3>
              <p>
                Multiple IAP libraries with different APIs create complexity.
                Open IAP provides a unified specification that all libraries can
                implement.
              </p>
            </div>
            <div className="benefit">
              <h3>Future-Proof</h3>
              <p>
                As StoreKit 2, Android Billing v8, and new platforms emerge,
                Open IAP abstracts these changes behind a stable API.
              </p>
            </div>
            <div className="benefit">
              <h3>AI-Ready</h3>
              <p>
                In the AI coding era, standardized APIs are crucial. Open IAP
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
              <h3>
                XR-Compatible{' '}
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginLeft: '0.5rem',
                  }}
                >
                  (WIP)
                </span>
              </h3>
              <p>
                Horizon OS, Android XR, Vision Pro - new realities need
                purchases. Open IAP is ready for the spatial computing era.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section section-how">
        <div className="section-container">
          <h2>How Open IAP Works</h2>
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
                  to="/docs/events#purchaseupdatedevent"
                  className="spec-item"
                >
                  <code>purchaseUpdatedListener</code>
                  <span>Purchase state changes</span>
                </Link>
                <Link
                  to="/docs/events#purchaseerrorevent"
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
        <div className="section-container">
          <h2>Who uses Open IAP?</h2>
          <p className="section-subtitle">
            Leading IAP libraries implementing the Open IAP specification
          </p>
          <div className="implementations-grid">
            <a
              href="https://hyochan.github.io/react-native-iap"
              target="_blank"
              rel="noopener noreferrer"
              className="implementation-card"
            >
              <img
                src="https://hyochan.github.io/react-native-iap/img/logo.png"
                alt="React Native IAP"
                className="implementation-logo"
              />
              <div>
                <h3>react-native-iap</h3>
                <p>React Native & Expo (Nitro Modules)</p>
              </div>
            </a>

            <a
              href="https://hyochan.github.io/expo-iap"
              target="_blank"
              rel="noopener noreferrer"
              className="implementation-card"
            >
              <img
                src="https://hyochan.github.io/expo-iap/img/icon.png"
                alt="Expo IAP"
                className="implementation-logo"
              />
              <div>
                <h3>expo-iap</h3>
                <p>React Native & Expo (Expo Modules)</p>
              </div>
            </a>

            <a
              href="https://hyochan.github.io/flutter_inapp_purchase"
              target="_blank"
              rel="noopener noreferrer"
              className="implementation-card"
            >
              <img
                src="https://hyochan.github.io/flutter_inapp_purchase/img/logo.png"
                alt="Flutter IAP"
                className="implementation-logo"
              />
              <div>
                <h3>flutter_inapp_purchase</h3>
                <p>Flutter</p>
              </div>
            </a>

            <a
              href="https://hyochan.github.io/kmp-iap"
              target="_blank"
              rel="noopener noreferrer"
              className="implementation-card"
            >
              <img
                src="https://hyochan.github.io/kmp-iap/img/logo.png"
                alt="KMP IAP"
                className="implementation-logo"
              />
              <div>
                <h3>kmp-iap</h3>
                <p>Kotlin Multiplatform</p>
              </div>
            </a>
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
