import AnchorLink from '../components/AnchorLink';
import { useScrollToHash } from '../hooks/useScrollToHash';

function Tutorials() {
  useScrollToHash();

  return (
    <div className="page-container">
      <div className="content-wrapper">
        <h1>Tutorials</h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            marginBottom: '3rem',
            lineHeight: '1.6',
          }}
        >
          For platform-specific development documentation and APIs, please refer
          to each library's documentation. This section covers comprehensive
          guides that apply across all implementations.
        </p>

        <section className="resources-section">
          <AnchorLink id="setups" level="h2">
            Setups
          </AnchorLink>
          <div className="resource-list">
            <a href="/docs/ios-setup" className="resource-item">
              <h3>iOS Setup</h3>
              <p>Configure StoreKit and App Store Connect</p>
            </a>
            <a href="/docs/android-setup" className="resource-item">
              <h3>Android Setup</h3>
              <p>Setup Google Play Console and Billing Library</p>
            </a>
          </div>
        </section>

        <section className="resources-section">
          <AnchorLink id="news" level="h2">
            News
          </AnchorLink>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-0-0"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.borderColor = 'var(--primary-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                Android Billing Library 8.0.0 Release
              </span>
              <span
                style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}
              >
                2025-06-30
              </span>
            </a>
            <a
              href="https://www.youtube.com/watch?v=LtWMxxL4nsw"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.borderColor = 'var(--primary-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                What's new in StoreKit and In-App Purchase
              </span>
              <span
                style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}
              >
                2025-06-10
              </span>
            </a>
          </div>
        </section>

        <section className="resources-section">
          <AnchorLink id="getting-started" level="h2">
            Getting Started
          </AnchorLink>
          <div className="resource-list">
            <a
              href="https://developer.apple.com/kr/storekit/"
              className="resource-item"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h3>iOS StoreKit2</h3>
              <p>Apple's in-app purchase framework documentation</p>
            </a>
            <a
              href="https://developer.android.com/google/play/billing"
              className="resource-item"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h3>Android Play's Billing</h3>
              <p>Google Play Billing Library documentation</p>
            </a>
          </div>
        </section>

        <section className="resources-section">
          <AnchorLink id="verify-purchase" level="h2">
            Verify Purchase
          </AnchorLink>
          <div className="resource-list">
            <a
              href="https://developer.apple.com/documentation/appstoreserverapi/simplifying-your-implementation-by-using-the-app-store-server-library"
              className="resource-item"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h3>
                Simplifying your implementation by using App Store Server
                Library
              </h3>
              <p>
                Learn how to use Apple's server library for easier
                implementation
              </p>
            </a>
            <a
              href="https://developer.android.com/google/play/billing/integrate#verifying-purchase"
              className="resource-item"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h3>Verify the purchase in Android</h3>
              <p>Secure purchase verification for Google Play Billing</p>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Tutorials;
