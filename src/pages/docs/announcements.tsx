import { useScrollToHash } from '../../hooks/useScrollToHash';

function Announcements() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>📢 Announcements</h1>
      <p>Important news and updates about Open IAP</p>

      <section>
        <div
          style={{
            background:
              'linear-gradient(135deg, rgba(24, 119, 242, 0.1) 0%, rgba(24, 119, 242, 0.05) 100%)',
            border: '2px solid rgba(24, 119, 242, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 12px rgba(24, 119, 242, 0.1)',
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
                style={{ color: '#1877F2', textDecoration: 'none' }}
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
            We're thrilled to announce that Open IAP is now officially backed by
            Meta! This partnership marks a significant milestone in our mission
            to standardize and simplify in-app purchases across all platforms.
          </p>
          <p
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(24, 119, 242, 0.05)',
              borderRadius: '0.5rem',
              borderLeft: '4px solid rgba(24, 119, 242, 0.5)',
            }}
          >
            <strong>Note:</strong> Open IAP will continue to operate
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
