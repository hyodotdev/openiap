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
          <p
            style={{
              maxWidth: '720px',
              margin: '0 auto 2rem',
              lineHeight: '1.7',
              color: 'var(--text-secondary, #666)',
              textAlign: 'center',
            }}
          >
            OpenIAP is unified in-app purchase infrastructure used in production
            across iOS, Android, and cross-platform frameworks. Sponsorship
            funds the native modules and the downstream libraries built on top
            of them.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
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
                  width: '28px',
                  height: '28px',
                  objectFit: 'contain',
                  filter: 'var(--apple-logo-filter, none)',
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
                  width: '28px',
                  height: '28px',
                  objectFit: 'contain',
                }}
              />
              <span>openiap-google</span>
            </a>
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
                    width: '28px',
                    height: '28px',
                    objectFit: 'contain',
                  }}
                />
                <span>{lib.displayName}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="resources-section">
          <h2 style={{ textAlign: 'center' }}>
            Why AI Can't Replace This Work
          </h2>
          <div
            style={{
              maxWidth: '760px',
              margin: '0 auto',
              textAlign: 'left',
              lineHeight: '1.75',
              color: 'var(--text-secondary, #666)',
            }}
          >
            <p
              style={{
                marginBottom: '1.25rem',
                textAlign: 'center',
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}
            >
              In-app purchase systems cannot be reliably simulated — they
              require real platform integration and ongoing maintenance.
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: '1rem',
              }}
            >
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>
                  Real devices, real store servers.
                </strong>{' '}
                StoreKit 2 and Google Play Billing only behave correctly against
                Apple and Google infrastructure — not in sandboxes AI can reason
                about.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>
                  Store policies change constantly.
                </strong>{' '}
                Billing Client upgrades, receipt-validation changes, and
                subscription-state semantics ship every few months and break
                silently.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>
                  Edge cases surface only in production.
                </strong>{' '}
                Refunds, grace periods, family sharing, promotional offers, and
                regional pricing need human debugging against live accounts.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>
                  Cross-framework consistency is a judgment call.
                </strong>{' '}
                Keeping React Native, Expo, Flutter, KMP, and Godot aligned
                requires human review of API shape, error mapping, and breaking
                changes.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>
                  Real money, real accountability.
                </strong>{' '}
                Every bug costs users money, triggers chargebacks, and damages
                app ratings. Liability and fraud prevention can't be delegated
                to a model.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>
                  Security-sensitive by design.
                </strong>{' '}
                Receipt validation, purchase tokens, and JWS signature checks
                protect revenue — hallucinated crypto or auth code is a
                liability, not a feature.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>
                  Regulatory change lands without warning.
                </strong>{' '}
                EU DMA alternative billing, Korea's third-party payment law, and
                App Store Review guideline shifts require legal judgment and
                coordinated rollouts across libraries.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>
                  Upstream bugs need humans on the other end.
                </strong>{' '}
                Apple Feedback Assistant, TSI tickets, and Play Console reports
                take weeks of back-and-forth with real engineers at Apple and
                Google.
              </li>
            </ul>
            <p
              style={{
                marginTop: '1.5rem',
                textAlign: 'center',
                fontSize: '0.95rem',
                fontStyle: 'italic',
              }}
            >
              AI accelerates the work. It does not replace the maintainers who
              ship, debug, and stand behind it.
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
              gap: '1.25rem',
            }}
          >
            <p
              style={{
                textAlign: 'center',
                color: 'var(--text-secondary, #666)',
                maxWidth: '640px',
                margin: '0 auto',
                lineHeight: '1.6',
              }}
            >
              GitHub Sponsors is the primary funding channel. Tiers scale from
              individual contributors to companies shipping OpenIAP in
              production — details are on the GitHub page.
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
                  src="/paypal.webp"
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
                maxWidth: '640px',
              }}
            >
              For company logo placement, procurement, invoicing, or custom
              integration scope, reach out at{' '}
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
              padding: '1.5rem 0',
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
                    src="/sponsors/nami.webp"
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
                    src="/sponsors/courier.webp"
                    alt="Courier Logo"
                    style={{ height: '28px', objectFit: 'contain' }}
                  />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Sponsors;
