import SEO from '../components/SEO';
import { LIBRARY_IMAGES } from '../lib/images';

function Languages() {
  return (
    <div className="page-container">
      <SEO
        title="Implementations"
        description="Libraries that implement the OpenIAP specification for React Native, Flutter, Kotlin Multiplatform, and more."
        path="/languages"
        keywords="react-native-iap, expo-iap, flutter_inapp_purchase, kmp-iap, IAP libraries"
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
              src="/openiap-apple.png"
              alt="OpenIAP Apple"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
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
              src="/openiap-google.png"
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
          <div className="language-card">
            <img
              src={LIBRARY_IMAGES['react-native-iap']}
              alt="React Native IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>react-native-iap</h3>
            <p>
              React Native & Expo implementation of OpenIAP specification (Nitro
              Modules)
            </p>
            <pre className="code-snippet">{`npm install react-native-iap`}</pre>
            <div className="language-links">
              <a
                href="https://github.com/dooboolab-community/react-native-iap"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub →
              </a>
              <a
                href="https://hyochan.github.io/react-native-iap"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                Documentation →
              </a>
            </div>
          </div>

          <div className="language-card">
            <img
              src={LIBRARY_IMAGES['expo-iap']}
              alt="Expo IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>expo-iap</h3>
            <p>
              React Native & Expo implementation of OpenIAP specification (Expo
              Modules)
            </p>
            <pre className="code-snippet">{`npm install expo-iap`}</pre>
            <div className="language-links">
              <a
                href="https://github.com/hyochan/expo-iap"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub →
              </a>
              <a
                href="https://hyochan.github.io/expo-iap"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                Documentation →
              </a>
            </div>
          </div>

          <div className="language-card">
            <img
              src={LIBRARY_IMAGES['flutter_inapp_purchase']}
              alt="Flutter IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>flutter_inapp_purchase</h3>
            <p>Flutter implementation of OpenIAP specification</p>
            <pre className="code-snippet">{`flutter pub add flutter_inapp_purchase`}</pre>
            <div className="language-links">
              <a
                href="https://github.com/hyochan/flutter_inapp_purchase"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub →
              </a>
              <a
                href="https://hyochan.github.io/flutter_inapp_purchase"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                Documentation →
              </a>
            </div>
          </div>

          <div className="language-card">
            <img
              src={LIBRARY_IMAGES['kmp-iap']}
              alt="KMP IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>kmp-iap</h3>
            <p>Kotlin Multiplatform implementation of OpenIAP specification</p>
            <pre className="code-snippet">{`implementation("io.github.hyochan:kmp-iap:1.0.0-rc.6")`}</pre>
            <div className="language-links">
              <a
                href="https://github.com/hyochan/kmp-iap"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub →
              </a>
              <a
                href="https://hyochan.github.io/kmp-iap"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                Documentation →
              </a>
            </div>
          </div>

          <div className="language-card">
            <img
              src={LIBRARY_IMAGES['godot-iap']}
              alt="Godot IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>godot-iap</h3>
            <p>Godot implementation of OpenIAP specification (GDScript)</p>
            <pre className="code-snippet">
              Download from{' '}
              <a
                href="https://github.com/hyochan/godot-iap/releases"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary-color)' }}
              >
                GitHub Releases
              </a>
            </pre>
            <div className="language-links">
              <a
                href="https://github.com/hyochan/godot-iap"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub →
              </a>
              <a
                href="https://github.com/hyochan/godot-iap"
                className="learn-more"
                target="_blank"
                rel="noopener noreferrer"
              >
                Documentation →
              </a>
            </div>
          </div>
        </div>

        <div className="contribute-section">
          <h2>Implement OpenIAP for Your Platform</h2>
          <p>
            Have you implemented the OpenIAP specification for another platform
            or framework? We'd love to include your library here!
          </p>
          <a
            href="https://github.com/hyochan/openiap.dev/pulls"
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
