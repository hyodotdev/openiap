import { useScrollToHash } from '../../hooks/useScrollToHash';

function Announcements() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>📢 Announcements</h1>
      <p>Important news and updates about OpenIAP</p>

      <section>
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-color)',
            borderRadius: '1rem',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            overflowWrap: 'break-word',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <img
              src="/meta.svg"
              alt="Meta Horizon"
              style={{ width: '48px', height: '48px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              Meta Horizon OS Support is Here!
            </h2>
          </div>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}
          >
            October 2025
          </p>
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
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'var(--bg-secondary)',
              borderRadius: '0.5rem',
              borderLeft: '4px solid var(--primary-color)',
            }}
          >
            <strong>Getting Started:</strong> Available in{' '}
            <code>openiap-google@1.3.0</code> and later. Set{' '}
            <code>store: "auto"</code> to enable automatic platform detection.
            Check out the{' '}
            <a
              href="/docs/modules/google/horizon-os"
              className="external-link"
            >
              Horizon OS guide
            </a>{' '}
            for details.
          </div>
        </div>
      </section>

      <section>
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-color)',
            borderRadius: '1rem',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            overflowWrap: 'break-word',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '2rem' }}>📰</span>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              openiap-gql v1.0.0 is live
            </h2>
          </div>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}
          >
            September 2025
          </p>
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
      </section>

      <section>
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-color)',
            borderRadius: '1rem',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '2rem' }}>🚀</span>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              OpenIAP Official Modules are live
            </h2>
          </div>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}
          >
            September 2025
          </p>
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
          <p
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'var(--bg-secondary)',
              borderRadius: '0.5rem',
              borderLeft: '4px solid var(--primary-color)',
            }}
          >
            <strong>Next:</strong> We will be publishing quickstart guides and
            API references within the Docs → Modules section.
          </p>
        </div>
      </section>

      <section>
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-color)',
            borderRadius: '1rem',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '2rem' }}>🎉</span>
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
          </div>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}
          >
            August 15, 2025
          </p>
          <p style={{ lineHeight: '1.7', marginBottom: '1.5rem' }}>
            We're thrilled to announce that OpenIAP is now officially backed by
            Meta! This partnership marks a significant milestone in our mission
            to standardize and simplify in-app purchases across all platforms.
          </p>
          <p
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'var(--bg-secondary)',
              borderRadius: '0.5rem',
              borderLeft: '4px solid var(--primary-color)',
            }}
          >
            <strong>Note:</strong> OpenIAP will continue to operate
            independently with the same commitment to developer experience and
            cross-platform compatibility. Our core libraries remain MIT licensed
            and free to use.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Announcements;
