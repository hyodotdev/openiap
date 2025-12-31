import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import Pagination from '../../../components/Pagination';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';

const cardStyle = {
  background: 'var(--bg-secondary)',
  border: '2px solid var(--border-color)',
  borderRadius: '1rem',
  padding: '2rem',
  marginBottom: '2rem',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
  overflowWrap: 'break-word' as const,
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginBottom: '1rem',
  flexWrap: 'wrap' as const,
};

const dateStyle = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  marginBottom: '1rem',
};

const linkIconStyle = {
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  fontSize: '1.2rem',
};

const calloutStyle = {
  marginTop: '1.5rem',
  padding: '1rem',
  background: 'var(--bg-secondary)',
  borderRadius: '0.5rem',
  borderLeft: '4px solid var(--primary-color)',
};

interface Announcement {
  id: string;
  date: Date;
  element: React.ReactNode;
}

function Announcements() {
  useScrollToHash();

  const announcements: Announcement[] = [
    // 2025-12-09: IAPKit
    {
      id: '2025-12-09',
      date: new Date('2025-12-09'),
      element: (
        <div key="2025-12-09" style={cardStyle}>
          <div style={headerStyle}>
            <img
              src="/iapkit.png"
              alt="IAPKit"
              style={{ width: '48px', height: '48px', borderRadius: '10px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              IAPKit is Now an Official Verification Provider!
            </h2>
            <a
              href="#2025-12-09"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>December 9, 2025 - v1.3.0</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            Starting from <strong>OpenIAP v1.3.0</strong>,{' '}
            <a
              href={IAPKIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
              onClick={trackIapKitClick}
            >
              IAPKit
            </a>{' '}
            is now integrated as the official purchase verification provider.
            This brings enterprise-grade backend verification to OpenIAP with
            minimal setup required.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <strong>Backend Purchase Verification + Security</strong> -
              Server-side validation that prevents fraud, tampering, and receipt
              reuse. More secure than client-only verification.
            </li>
            <li>
              <strong>Fast Launch</strong> - Simplified IAP verification
              process. Start selling in-app products with minimal configuration.
            </li>
            <li>
              <strong>Flexibility + Easy Maintenance</strong> - Single unified
              API for both Apple App Store and Google Play. Adding or changing
              stores is seamless.
            </li>
          </ul>
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '400px',
              height: '220px',
              borderRadius: '0.75rem',
              margin: '1.5rem auto 0',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <img
              src="/iapkit-love.png"
              alt="OpenIAP + IAPKit"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
          </a>
          <div style={calloutStyle}>
            <strong>Getting Started:</strong> Use the new{' '}
            <code>verifyPurchaseWithProvider</code> API with{' '}
            <code>provider: 'iapkit'</code>. See the{' '}
            <a
              href="/docs/apis#verify-purchase-with-provider"
              className="external-link"
            >
              API documentation
            </a>{' '}
            for details.
          </div>
        </div>
      ),
    },

    // 2025-10-01: Meta Horizon OS
    {
      id: '2025-10-01',
      date: new Date('2025-10-01'),
      element: (
        <div key="2025-10-01" style={cardStyle}>
          <div style={headerStyle}>
            <img
              src="/meta.svg"
              alt="Meta Horizon"
              style={{ width: '48px', height: '48px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              Meta Horizon OS Support is Here!
            </h2>
            <a
              href="#2025-10-01"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>October 1, 2025</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            OpenIAP now officially supports{' '}
            <a
              href="https://developers.meta.com/horizon"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Meta Horizon OS
            </a>
            ! Build immersive VR experiences with Quest devices while using the
            same unified API you know and love.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <strong>Auto-detection</strong>: Automatically switches between
              Google Play and Horizon billing based on device
            </li>
            <li>
              <strong>Unified API</strong>: Same code works on Android phones,
              tablets, and Quest headsets
            </li>
            <li>
              <strong>Full feature support</strong>: Subscriptions, consumables,
              non-consumables, and alternative billing
            </li>
            <li>
              <strong>Production ready</strong>: Thread-safe implementation with
              comprehensive error handling
            </li>
          </ul>
          <a
            href="/docs/horizon-setup"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '400px',
              borderRadius: '0.75rem',
              margin: '1.5rem auto 0',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <img
              src="/announcements/horizon.png"
              alt="OpenIAP + Meta Horizon OS"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </a>
          <div style={calloutStyle}>
            <strong>Getting Started:</strong> Available in{' '}
            <code>openiap-google@1.3.0</code> and later. Check out the{' '}
            <a href="/docs/horizon-setup" className="external-link">
              Horizon OS guide
            </a>{' '}
            for details.
          </div>
        </div>
      ),
    },

    // 2025-09-15: openiap-gql v1.0.0
    {
      id: '2025-09-15',
      date: new Date('2025-09-15'),
      element: (
        <div key="2025-09-15" style={cardStyle}>
          <div style={headerStyle}>
            <span style={{ fontSize: '2rem' }}>📰</span>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              openiap-gql v1.0.0 is live
            </h2>
            <a
              href="#2025-09-15"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>September 15, 2025</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            Our GraphQL gateway for OpenIAP has reached its first stable
            release. Version 1.0.0 delivers a strongly typed schema, realtime
            subscription awareness, and polished tooling to help teams ship
            production-ready experiences faster.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              Explore the{' '}
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/1.0.0"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                detailed v1.0.0 release notes
              </a>
            </li>
            <li>
              Subscription-aware directives with live entitlement helpers built
              in
            </li>
            <li>
              Explorer presets and copy-ready queries for rapid onboarding
            </li>
          </ul>
          <div
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
            }}
          >
            Want to kick the tires? Point your tooling at the new playground and
            start testing subscriptions with mocked entitlements in seconds.
          </div>
          <img
            src="https://github.com/user-attachments/assets/d53df582-fbb0-4df8-9fd3-a4411eba5ef6"
            alt="GraphQL explorer showcasing the openiap-gql release"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '720px',
              borderRadius: '0.75rem',
              margin: '0 auto',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
            }}
          />
        </div>
      ),
    },

    // 2025-09-01: Official Modules
    {
      id: '2025-09-01',
      date: new Date('2025-09-01'),
      element: (
        <div key="2025-09-01" style={cardStyle}>
          <div style={headerStyle}>
            <span style={{ fontSize: '2rem' }}>🚀</span>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              OpenIAP Official Modules are live
            </h2>
            <a
              href="#2025-09-01"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>September 1, 2025</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            We are excited to announce the first official OpenIAP modules for
            Apple and Google are now available. These modules provide a clean,
            unified interface aligned with the OpenIAP specification.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              margin: '1rem 0',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <img
                src="/openiap-apple.png"
                alt="OpenIAP Apple"
                style={{ width: '56px', height: '56px', borderRadius: '10px' }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>openiap-apple</div>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  github.com/hyodotdev/openiap/tree/main/packages/apple
                </a>
              </div>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <img
                src="/openiap-google.png"
                alt="OpenIAP Google"
                style={{ width: '56px', height: '56px', borderRadius: '10px' }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>openiap-google</div>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  github.com/hyodotdev/openiap/tree/main/packages/google
                </a>
              </div>
            </div>
          </div>
          <p style={calloutStyle}>
            <strong>Next:</strong> We will be publishing quickstart guides and
            API references within the Docs → Modules section.
          </p>
        </div>
      ),
    },

    // 2025-08-15: Meta backing
    {
      id: '2025-08-15',
      date: new Date('2025-08-15'),
      element: (
        <div key="2025-08-15" style={cardStyle}>
          <div style={headerStyle}>
            <img
              src="/meta.svg"
              alt="Meta"
              style={{ width: '48px', height: '48px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              We are now backed by{' '}
              <a
                href="https://meta.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary-color)',
                  textDecoration: 'none',
                }}
              >
                Meta
              </a>
              !
            </h2>
            <a
              href="#2025-08-15"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>August 15, 2025</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1.5rem' }}>
            We're thrilled to announce that OpenIAP is now officially backed by
            Meta! This partnership marks a significant milestone in our mission
            to standardize and simplify in-app purchases across all platforms.
          </p>
          <p style={calloutStyle}>
            <strong>Note:</strong> OpenIAP will continue to operate
            independently with the same commitment to developer experience and
            cross-platform compatibility. Our core libraries remain MIT licensed
            and free to use.
          </p>
        </div>
      ),
    },
  ];

  // Sort by date (newest first)
  const sortedAnnouncements = [...announcements].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  return (
    <div className="doc-page">
      <SEO
        title="Announcements"
        description="Important news and updates about OpenIAP - new features, deprecations, and ecosystem changes."
        path="/docs/updates/announcements"
      />
      <h1>📢 Announcements</h1>
      <p>Important news and updates about OpenIAP</p>

      <Pagination itemsPerPage={5}>
        {sortedAnnouncements.map((a) => (
          <section key={a.id} id={a.id}>
            {a.element}
          </section>
        ))}
      </Pagination>
    </div>
  );
}

export default Announcements;
