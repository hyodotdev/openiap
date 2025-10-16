function Sponsors() {
  return (
    <div className="page-container">
      <div className="content-wrapper" style={{ textAlign: 'center' }}>
        <h1>Support OpenIAP</h1>
        <p className="page-subtitle">
          Help us make in-app purchases accessible and standardized for everyone
        </p>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center' }}>Our Mission</h2>
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
              We're working to expand OpenIAP across more platforms and
              ecosystems, making it easier for developers everywhere to
              implement in-app purchases. Your support directly helps us
              maintain libraries, improve documentation, and bring IAP standards
              to emerging technologies like XR and AI platforms.
            </p>
            <p
              style={{
                marginBottom: '1rem',
                color: 'var(--text-secondary, #666)',
              }}
            >
              When you sponsor OpenIAP, you're supporting all our IAP modules:
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
                href="https://github.com/hyodotdev/openiap-apple"
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
                  src="/openiap-apple.png"
                  alt="openiap-apple"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                    borderRadius: '6px',
                  }}
                />
                <span>openiap-apple</span>
              </a>
              <a
                href="https://github.com/hyodotdev/openiap-google"
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
                  src="/openiap-google.png"
                  alt="openiap-google"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                    borderRadius: '6px',
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
              and libraries which use our modules:
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
              <a
                href="https://github.com/dooboolab-community/react-native-iap"
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
                  src="https://hyochan.github.io/react-native-iap/img/logo.png"
                  alt="react-native-iap"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                  }}
                />
                <span>react-native-iap</span>
              </a>
              <a
                href="https://github.com/hyochan/expo-iap"
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
                  src="https://hyochan.github.io/expo-iap/img/icon.png"
                  alt="expo-iap"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                  }}
                />
                <span>expo-iap</span>
              </a>
              <a
                href="https://github.com/hyochan/flutter_inapp_purchase"
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
                  src="https://hyochan.github.io/flutter_inapp_purchase/img/logo.png"
                  alt="flutter_inapp_purchase"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                  }}
                />
                <span>flutter_inapp_purchase</span>
              </a>
              <a
                href="https://github.com/hyochan/kmp-iap"
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
                  src="https://hyochan.github.io/kmp-iap/img/logo.png"
                  alt="kmp-iap"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                  }}
                />
                <span>kmp-iap</span>
              </a>
            </div>
            <p style={{ color: 'var(--text-secondary, #666)' }}>
              Every contribution, no matter the size, helps us dedicate more
              time to this open-source initiative.
            </p>
          </div>
        </section>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
            Ways to Support
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '2rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <a
                href="https://buymeacoffee.com/hyochan/membership"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#ffd6cc',
                  color: '#000000',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '1rem',
                  border: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  minHeight: '54.72px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>☕</span>
                <span>Buy me a Coffee</span>
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
                  padding: '0.75rem 2rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '1rem',
                  border: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  minWidth: '100px',
                  minHeight: '54.72px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(0, 0, 0, 0.1)';
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
                maxWidth: '700px',
                margin: '0 auto',
                lineHeight: '1.6',
              }}
            >
              After making a payment through the buttons above, please send us
              your company info, logo, desired exposure method, and email to{' '}
              <a
                href="mailto:hyo@hyo.dev"
                style={{ color: 'var(--primary-color)' }}
              >
                hyo@hyo.dev
              </a>
              (email of maintainer,{' '}
              <a
                href="https://github.com/hyochan"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary-color)' }}
              >
                hyochan
              </a>
              ). We'll reflect your sponsorship within 24 hours.
            </p>
          </div>
        </section>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center' }}>Sponsorship Tiers</h2>

          <div
            style={{
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <h3
              style={{
                fontSize: '1.2rem',
                marginBottom: '1rem',
                color: 'var(--text-primary)',
              }}
            >
              For Individuals
            </h3>
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-color)',
                maxWidth: '300px',
              }}
            >
              <h4
                style={{
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                  fontSize: '1.1rem',
                }}
              >
                🌱 Community
              </h4>
              <p
                style={{
                  color: 'var(--primary-color)',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                $25/month
              </p>
              <p
                style={{
                  color: 'var(--text-secondary, #666)',
                  fontSize: '0.9rem',
                }}
              >
                Support open-source development
              </p>
            </div>
          </div>

          <div>
            <h3
              style={{
                fontSize: '1.2rem',
                marginBottom: '1rem',
                color: 'var(--text-primary)',
              }}
            >
              For Organizations
            </h3>
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
                }}
              >
                <h4
                  style={{
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    fontSize: '1.1rem',
                  }}
                >
                  🥉 Bronze
                </h4>
                <p
                  style={{
                    color: 'var(--primary-color)',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                  }}
                >
                  $100/month
                </p>
                <p
                  style={{
                    color: 'var(--text-secondary, #666)',
                    fontSize: '0.9rem',
                  }}
                >
                  Small logo in one project
                </p>
              </div>
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '1.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <h4
                  style={{
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    fontSize: '1.1rem',
                  }}
                >
                  🥈 Silver
                </h4>
                <p
                  style={{
                    color: 'var(--primary-color)',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                  }}
                >
                  $300/month
                </p>
                <p
                  style={{
                    color: 'var(--text-secondary, #666)',
                    fontSize: '0.9rem',
                  }}
                >
                  Logo featured in README
                </p>
              </div>
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '1.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <h4
                  style={{
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    fontSize: '1.1rem',
                  }}
                >
                  🥇 Gold
                </h4>
                <p
                  style={{
                    color: 'var(--primary-color)',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                  }}
                >
                  $500/month
                </p>
                <p
                  style={{
                    color: 'var(--text-secondary, #666)',
                    fontSize: '0.9rem',
                  }}
                >
                  Large logo & recognition
                </p>
              </div>
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '1.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <h4
                  style={{
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    fontSize: '1.1rem',
                  }}
                >
                  👼 Angel
                </h4>
                <p
                  style={{
                    color: 'var(--primary-color)',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                  }}
                >
                  $999/month
                </p>
                <p
                  style={{
                    color: 'var(--text-secondary, #666)',
                    fontSize: '0.9rem',
                  }}
                >
                  Featured across all repositories
                </p>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <a
              href="https://www.buymeacoffee.com/hyochan/membership"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              View Full Details
            </a>
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
                👼 Angel
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
              For sponsorship inquiries or any questions, please reach out to us
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
              <span>✉️</span> hyo@hyo.dev
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Sponsors;
