import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { LIBRARIES, LIBRARY_IMAGES } from '../lib/images';

const isExternalUrl = (url: string) => /^https?:\/\//.test(url);

function Languages() {
  return (
    <div className="page-container">
      <SEO
        title="Implementations"
        description="Production-ready IAP libraries implementing OpenIAP: expo-iap, react-native-iap, flutter_inapp_purchase, kmp-iap, maui-iap, and godot-iap. Type-safe in-app purchases for every framework."
        path="/languages"
        keywords="expo-iap, react-native-iap, flutter_inapp_purchase, kmp-iap, maui-iap, godot-iap, IAP SDK, in-app purchase library, mobile payments SDK, cross-platform IAP"
      />
      <div className="content-wrapper">
        <h1>OpenIAP Implementations</h1>
        <p className="page-subtitle">
          Libraries that implement the OpenIAP specification for different
          platforms and frameworks
        </p>
        <h2 style={{ marginTop: '2.5rem' }}>OpenIAP Modules</h2>
        <p className="page-subtitle">
          Official modules maintained under the OpenIAP organization
        </p>
        <div className="languages-grid">
          <div className="language-card">
            <img
              src={LIBRARY_IMAGES['openiap-apple']}
              alt="OpenIAP Apple"
              className="language-logo"
              style={{
                width: '60px',
                height: '60px',
                marginBottom: '1rem',
                filter: 'var(--apple-logo-filter, none)',
              }}
            />
            <h3>openiap-apple</h3>
            <p>Official OpenIAP module for Apple platforms (StoreKit 2)</p>
            <div className="language-links">
              <a
                href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub →
              </a>
            </div>
          </div>

          <div className="language-card">
            <img
              src={LIBRARY_IMAGES['openiap-google']}
              alt="OpenIAP Google"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>openiap-google</h3>
            <p>Official OpenIAP module for Google Play Billing</p>
            <div className="language-links">
              <a
                href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub →
              </a>
            </div>
          </div>
        </div>

        <h2 style={{ marginTop: '2.5rem' }}>Framework Implementations</h2>
        <p className="page-subtitle">
          These frameworks build on the OpenIAP Modules above
        </p>
        <div className="languages-grid">
          {LIBRARIES.map((library) => (
            <div className="language-card" key={library.name}>
              <img
                src={library.image}
                alt={library.imageAlt}
                className="language-logo"
                style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
              />
              <h3>{library.displayName}</h3>
              <p>{library.languagesDescription}</p>
              {library.installCommand ? (
                <pre className="code-snippet">{library.installCommand}</pre>
              ) : (
                <pre className="code-snippet">
                  Download from{' '}
                  <a
                    href={library.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary-color)' }}
                  >
                    GitHub Releases
                  </a>
                </pre>
              )}
              <div className="language-links">
                <a
                  href={library.url}
                  className="learn-more"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub →
                </a>
                {isExternalUrl(library.documentationUrl) ? (
                  <a
                    href={library.documentationUrl}
                    className="learn-more"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Documentation →
                  </a>
                ) : (
                  <Link to={library.documentationUrl} className="learn-more">
                    Documentation →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="contribute-section">
          <h2>Implement OpenIAP for Your Platform</h2>
          <p>
            Have you implemented the OpenIAP specification for another platform
            or framework? We'd love to include your library here!
          </p>
          <a
            href="https://github.com/hyodotdev/openiap/pulls"
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Submit a Pull Request
          </a>
        </div>
      </div>
    </div>
  );
}

export default Languages;
