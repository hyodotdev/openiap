function Languages() {
  return (
    <div className="page-container">
      <div className="content-wrapper">
        <h1>Open IAP Implementations</h1>
        <p className="page-subtitle">
          Libraries that implement the Open IAP specification for different
          platforms and frameworks
        </p>
        <h2 style={{ marginTop: '2.5rem' }}>Open IAP Modules</h2>
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
                href="https://github.com/hyodotdev/openiap-apple"
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
                href="https://github.com/hyodotdev/openiap-google"
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
          These frameworks build on the Open IAP Modules above
        </p>
        <div className="languages-grid">
          <div className="language-card">
            <img
              src="https://hyochan.github.io/react-native-iap/img/logo.png"
              alt="React Native IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>react-native-iap</h3>
            <p>
              React Native & Expo implementation of Open IAP specification
              (Nitro Modules)
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
              src="https://hyochan.github.io/expo-iap/img/icon.png"
              alt="Expo IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>expo-iap</h3>
            <p>
              React Native & Expo implementation of Open IAP specification (Expo
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
              src="https://hyochan.github.io/flutter_inapp_purchase/img/logo.png"
              alt="Flutter IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>flutter_inapp_purchase</h3>
            <p>Flutter implementation of Open IAP specification</p>
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
              src="https://hyochan.github.io/kmp-iap/img/logo.png"
              alt="KMP IAP"
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>kmp-iap</h3>
            <p>Kotlin Multiplatform implementation of Open IAP specification</p>
            <pre className="code-snippet">{`implementation("io.github.hyochan:kmp-iap:1.0.0-rc.3")`}</pre>
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
        </div>

        <div className="contribute-section">
          <h2>Implement Open IAP for Your Platform</h2>
          <p>
            Have you implemented the Open IAP specification for another platform
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
