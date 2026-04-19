import SEO from '../components/SEO';
import { LIBRARIES, LIBRARY_IMAGES } from '../lib/images';

function Sponsors() {
  return (
    <div className="page-container">
      <SEO
        title="Sponsor OpenIAP"
        description="Sponsor OpenIAP — unified in-app purchase infrastructure used in production across iOS, Android, and emerging platforms. Sponsorship funds maintenance, stability, and long-term platform integration."
        path="/sponsors"
        keywords="OpenIAP sponsors, GitHub Sponsors, IAP infrastructure, in-app purchase open source, vendor sponsorship, Amazon IAP"
      />
      <div className="content-wrapper" style={{ textAlign: 'center' }}>
        <h1>Sponsor OpenIAP</h1>
        <p className="page-subtitle">
          Production-grade in-app purchase infrastructure for iOS, Android, and
          beyond
        </p>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center' }}>Why Sponsor OpenIAP</h2>
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              textAlign: 'center',
              lineHeight: '1.8',
            }}
          >
            <p
              style={{
                marginBottom: '1.5rem',
                color: 'var(--text-secondary, #666)',
              }}
            >
              OpenIAP is unified in-app purchase infrastructure used in
              production by teams across iOS, Android, and cross-platform
              frameworks. Sponsorship funds the maintenance, stability, and
              platform expansion — including ongoing iOS and Android work and
              new integrations such as Amazon Appstore — that keeps the
              ecosystem running reliably for everyone.
            </p>
            <p
              style={{
                marginBottom: '1rem',
                color: 'var(--text-secondary, #666)',
              }}
            >
              Sponsoring OpenIAP covers our native modules:
            </p>
            <div
              style={{
                display: 'flex',
                gap: '2rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: '1.25rem',
                alignItems: 'center',
              }}
            >
              <a
                href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary-color)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <img
                  src={LIBRARY_IMAGES['openiap-apple']}
                  alt="openiap-apple"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                  }}
                />
                <span>openiap-apple</span>
              </a>
              <a
                href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary-color)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <img
                  src={LIBRARY_IMAGES['openiap-google']}
                  alt="openiap-google"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                  }}
                />
                <span>openiap-google</span>
              </a>
            </div>
            <p
              style={{
                marginBottom: '1.5rem',
                color: 'var(--text-secondary, #666)',
              }}
            >
              and the downstream libraries built on top of them:
            </p>
            <div
              style={{
                display: 'flex',
                gap: '2rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: '1.5rem',
                alignItems: 'center',
              }}
            >
              {LIBRARIES.map((lib) => (
                <a
                  key={lib.name}
                  href={lib.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--primary-color)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <img
                    src={lib.image}
                    alt={lib.displayName}
                    style={{
                      width: '32px',
                      height: '32px',
                      objectFit: 'contain',
                    }}
                  />
                  <span>{lib.displayName}</span>
                </a>
              ))}
            </div>
            <p style={{ color: 'var(--text-secondary, #666)' }}>
              Every sponsorship tier contributes directly to release stability,
              long-term support, and broader platform coverage.
            </p>
          </div>
        </section>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
            Sponsor on GitHub
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
            }}
          >
            <p
              style={{
                textAlign: 'center',
                color: 'var(--text-secondary, #666)',
                maxWidth: '700px',
                margin: '0 auto',
                lineHeight: '1.6',
              }}
            >
              GitHub Sponsors is the primary channel for funding OpenIAP. All
              tiers, billing, and invoicing are handled through GitHub for both
              individuals and companies.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <a
                href="https://github.com/sponsors/hyodotdev"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  backgroundColor: '#24292f',
                  color: '#ffffff',
                  padding: '0.9rem 2rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '1.05rem',
                  border: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                  minHeight: '54.72px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px rgba(0, 0, 0, 0.18)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(0, 0, 0, 0.12)';
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 16 16"
                  fill="#db61a2"
                  aria-hidden="true"
                >
                  <path d="M4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.565 20.565 0 008 13.393a20.561 20.561 0 003.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.75.75 0 01-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5zM8 14.25l-.345.666-.002-.001-.006-.003-.018-.01a7.643 7.643 0 01-.31-.17 22.075 22.075 0 01-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.08 22.08 0 01-3.744 2.584l-.018.01-.006.003h-.002L8 14.25z" />
                </svg>
                <span>Sponsor on GitHub</span>
              </a>
              <a
                href="https://paypal.me/dooboolab"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#0070ba',
                  color: '#ffffff',
                  padding: '0.9rem 2rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '1rem',
                  border: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                  minHeight: '54.72px',
                  minWidth: '120px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px rgba(0, 0, 0, 0.18)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(0, 0, 0, 0.12)';
                }}
              >
                <img
                  src="/paypal.png"
                  alt="PayPal"
                  style={{
                    height: '24px',
                    width: 'auto',
                    filter: 'brightness(0) invert(1)',
                  }}
                />
              </a>
            </div>
            <p
              style={{
                textAlign: 'center',
                color: 'var(--text-secondary, #666)',
                fontSize: '0.9rem',
              }}
            >
              Already sponsoring? Send your company info, logo, and preferred
              placement to{' '}
              <a
                href="mailto:hyo@hyo.dev"
                style={{ color: 'var(--primary-color)' }}
              >
                hyo@hyo.dev
              </a>{' '}
              and we'll reflect it across the project within 24 hours.
            </p>
          </div>
        </section>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center' }}>Sponsorship Tiers</h2>
          <p
            style={{
              textAlign: 'center',
              color: 'var(--text-secondary, #666)',
              maxWidth: '700px',
              margin: '0 auto 2rem',
              lineHeight: '1.6',
            }}
          >
            Tiers are scaled to how teams rely on OpenIAP — from individual
            contributors to companies shipping it in production. Detailed
            benefits are listed on GitHub Sponsors.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-color)',
                textAlign: 'left',
              }}
            >
              <h4
                style={{
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                  fontSize: '1.1rem',
                }}
              >
                Individual
              </h4>
              <p
                style={{
                  color: 'var(--primary-color)',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                Small monthly
              </p>
              <p
                style={{
                  color: 'var(--text-secondary, #666)',
                  fontSize: '0.9rem',
                }}
              >
                For developers using OpenIAP in personal or side projects.
              </p>
            </div>
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-color)',
                textAlign: 'left',
              }}
            >
              <h4
                style={{
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                  fontSize: '1.1rem',
                }}
              >
                Project / Team
              </h4>
              <p
                style={{
                  color: 'var(--primary-color)',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                Mid monthly
              </p>
              <p
                style={{
                  color: 'var(--text-secondary, #666)',
                  fontSize: '0.9rem',
                }}
              >
                For teams shipping OpenIAP in one or more production apps.
              </p>
            </div>
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '2px solid var(--primary-color)',
                textAlign: 'left',
              }}
            >
              <h4
                style={{
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                  fontSize: '1.1rem',
                }}
              >
                Company / Vendor
              </h4>
              <p
                style={{
                  color: 'var(--primary-color)',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                $1,000 / month
              </p>
              <p
                style={{
                  color: 'var(--text-secondary, #666)',
                  fontSize: '0.9rem',
                }}
              >
                Vendor-level sponsorship for companies relying on OpenIAP as
                production infrastructure.
              </p>
            </div>
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-color)',
                textAlign: 'left',
              }}
            >
              <h4
                style={{
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                  fontSize: '1.1rem',
                }}
              >
                Custom Integration
              </h4>
              <p
                style={{
                  color: 'var(--primary-color)',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                Contact us
              </p>
              <p
                style={{
                  color: 'var(--text-secondary, #666)',
                  fontSize: '0.9rem',
                }}
              >
                Scoped engagements for platform integrations such as Amazon IAP
                or other store backends.
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <a
              href="https://github.com/sponsors/hyodotdev"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              View Tiers on GitHub
            </a>
          </div>
        </section>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center' }}>For Companies</h2>
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              textAlign: 'center',
              lineHeight: '1.8',
            }}
          >
            <p
              style={{
                color: 'var(--text-secondary, #666)',
                marginBottom: '1rem',
              }}
            >
              If your product relies on OpenIAP in production, vendor-level
              sponsorship is the right fit. It funds long-term support, security
              and release stability, and prioritized platform integration work
              on the components your team actually depends on.
            </p>
            <p style={{ color: 'var(--text-secondary, #666)' }}>
              For procurement, invoicing, or custom scope discussions, reach out
              at{' '}
              <a
                href="mailto:hyo@hyo.dev"
                style={{ color: 'var(--primary-color)' }}
              >
                hyo@hyo.dev
              </a>
              .
            </p>
          </div>
        </section>

        <section className="resources-section" style={{ overflow: 'hidden' }}>
          <h2 style={{ textAlign: 'center' }}>Current Sponsors</h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem',
              padding: '2rem 0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                width: '100%',
                overflow: 'hidden',
                padding: '0 1rem',
              }}
            >
              <p
                style={{
                  color: 'var(--accent-color)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  letterSpacing: '0.5px',
                  marginBottom: '1rem',
                }}
              >
                Founding Sponsor
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.1rem',
                  maxWidth: '100%',
                }}
              >
                <a
                  href="https://meta.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.1rem',
                    textDecoration: 'none',
                    maxHeight: '240px',
                  }}
                >
                  <img
                    src="/meta.svg"
                    alt="Meta Logo"
                    style={{
                      height: '100%',
                      maxHeight: '240px',
                      width: 'auto',
                      maxWidth: '40vw',
                      objectFit: 'contain',
                    }}
                  />
                  <img
                    src="/meta-txt.svg"
                    alt="Meta Text"
                    style={{
                      height: '100%',
                      maxHeight: '240px',
                      width: 'auto',
                      maxWidth: '40vw',
                      objectFit: 'contain',
                      filter: 'var(--logo-text-filter, none)',
                    }}
                  />
                </a>
              </div>
            </div>
            <div style={{ textAlign: 'center', opacity: '0.5' }}>
              <p
                style={{
                  color: 'var(--accent-color)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  marginBottom: '1rem',
                  letterSpacing: '0.5px',
                }}
              >
                Past Supporters
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <a
                  href="https://namiml.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    textDecoration: 'none',
                  }}
                >
                  <img
                    src="/sponsors/nami.png"
                    alt="Namiml Logo"
                    style={{ height: '35px', objectFit: 'contain' }}
                  />
                </a>
                <a
                  href="https://www.courier.com/?utm_source=react-native-iap&utm_campaign=osssponsors"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    textDecoration: 'none',
                  }}
                >
                  <img
                    src="/sponsors/courier.png"
                    alt="Courier Logo"
                    style={{ height: '28px', objectFit: 'contain' }}
                  />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center' }}>Contact</h2>
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                color: 'var(--text-secondary, #666)',
                marginBottom: '1.5rem',
              }}
            >
              For sponsorship inquiries, custom integrations, or any other
              questions, reach out directly.
            </p>
            <a
              href="mailto:hyo@hyo.dev"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              hyo@hyo.dev
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Sponsors;
