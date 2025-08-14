function Languages() {
  return (
    <div className="page-container">
      <div className="content-wrapper">
        <h1>Open IAP Implementations</h1>
        <p className="page-subtitle">
          Libraries that implement the Open IAP specification for different platforms and frameworks
        </p>
        
        <div className="languages-grid">
          <div className="language-card">
            <img 
              src="https://expo-iap.hyo.dev/img/icon.png" 
              alt="Expo IAP" 
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>expo-iap</h3>
            <p>React Native & Expo implementation of Open IAP specification</p>
            <pre className="code-snippet">{`npm install expo-iap`}</pre>
            <div className="language-links">
              <a href="https://github.com/hyochan/expo-iap" className="learn-more" target="_blank" rel="noopener noreferrer">
                View on GitHub →
              </a>
              <a href="https://expo-iap.hyo.dev" className="learn-more" target="_blank" rel="noopener noreferrer">
                Documentation →
              </a>
            </div>
          </div>

          <div className="language-card">
            <img 
              src="https://flutter-inapp-purchase.hyo.dev/img/logo.png" 
              alt="Flutter IAP" 
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>flutter_inapp_purchase</h3>
            <p>Flutter implementation of Open IAP specification</p>
            <pre className="code-snippet">{`flutter pub add flutter_inapp_purchase`}</pre>
            <div className="language-links">
              <a href="https://github.com/hyochan/flutter_inapp_purchase" className="learn-more" target="_blank" rel="noopener noreferrer">
                View on GitHub →
              </a>
              <a href="https://flutter-inapp-purchase.hyo.dev" className="learn-more" target="_blank" rel="noopener noreferrer">
                Documentation →
              </a>
            </div>
          </div>

          <div className="language-card">
            <img 
              src="https://kmp-iap.hyo.dev/img/logo.png" 
              alt="KMP IAP" 
              className="language-logo"
              style={{ width: '60px', height: '60px', marginBottom: '1rem' }}
            />
            <h3>kmp-iap</h3>
            <p>Kotlin Multiplatform implementation of Open IAP specification</p>
            <pre className="code-snippet">{`implementation("io.github.hyochan:kmp-iap:0.1.0")`}</pre>
            <div className="language-links">
              <a href="https://github.com/hyochan/kmp-iap" className="learn-more" target="_blank" rel="noopener noreferrer">
                View on GitHub →
              </a>
              <a href="https://kmp-iap.hyo.dev" className="learn-more" target="_blank" rel="noopener noreferrer">
                Documentation →
              </a>
            </div>
          </div>
        </div>

        <div className="contribute-section">
          <h2>Implement Open IAP for Your Platform</h2>
          <p>
            Have you implemented the Open IAP specification for another platform or framework? 
            We'd love to include your library here!
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
  )
}

export default Languages