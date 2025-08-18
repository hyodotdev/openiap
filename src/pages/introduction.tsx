function Introduction() {
  return (
    <div className="page-container">
      <div className="content-wrapper">
        <h1>Introduction to Open IAP</h1>

        <section className="intro-section">
          <h2>What is Open IAP?</h2>
          <p>
            Open IAP is an open specification that standardizes in-app purchase
            implementations across diverse platforms and frameworks. As the IAP
            ecosystem becomes increasingly fragmented with new platforms
            (StoreKit 2, Android Billing v8, Vision Pro, Horizon OS) and
            frameworks (React Native, Flutter, KMP), Open IAP provides a unified
            specification that reduces complexity and ensures consistency.
          </p>
        </section>

        <section className="intro-section">
          <h2>The Problem</h2>
          <p>
            Every new platform and framework creates its own IAP implementation.
            Library maintainers independently design APIs, leading to fragmented
            specifications. Developers must learn different APIs for each
            platform, increasing complexity and errors. As new technologies
            emerge - XR platforms, cross-platform frameworks, and emerging
            payment systems - this fragmentation only grows worse.
          </p>
          <p>
            In the AI coding era, this fragmentation becomes even more
            problematic. AI assistants struggle to generate consistent code when
            every library has different patterns, making IAP implementation
            unnecessarily complex and error-prone.
          </p>
        </section>

        <section className="intro-section">
          <h2>Our Solution</h2>

          <h3>Unified APIs</h3>
          <p>
            Open IAP defines standard methods like <code>initConnection()</code>
            , <code>requestProducts()</code>,<code>requestPurchase()</code>, and{' '}
            <code>finishTransaction()</code> that work consistently across all
            platforms. Library maintainers implement these standard APIs,
            ensuring developers have a consistent experience.
          </p>

          <h3>Standard Events</h3>
          <p>
            Event handling is standardized with patterns like{' '}
            <code>purchaseUpdatedListener</code> and
            <code>purchaseErrorListener</code>. No more platform-specific event
            names or handling patterns - just consistent, predictable events
            across all implementations.
          </p>

          <h3>Unified Types</h3>
          <p>
            Common data structures like <code>Product</code>,{' '}
            <code>Purchase</code>, and <code>PurchaseError</code>
            are defined once and used everywhere. This ensures type safety and
            reduces the cognitive load on developers switching between
            platforms.
          </p>
        </section>

        <section className="intro-section">
          <h2>Why Now?</h2>
          <ul>
            <li>
              <strong>Platform Explosion:</strong> iOS StoreKit 2, Android
              Billing v8, and new XR platforms are creating more fragmentation
              than ever
            </li>
            <li>
              <strong>Framework Diversity:</strong> React Native, Flutter,
              Kotlin Multiplatform, and emerging frameworks each need IAP
              support
            </li>
            <li>
              <strong>AI Coding Era:</strong> Standardized APIs are crucial for
              AI assistants to generate reliable, consistent IAP code
            </li>
            <li>
              <strong>Developer Experience:</strong> Reducing cognitive load by
              providing one specification to learn instead of dozens
            </li>
            <li>
              <strong>Community Collaboration:</strong> Library maintainers can
              focus on implementation quality rather than API design
            </li>
          </ul>
        </section>

        <section className="intro-section">
          <h2>Who's Using Open IAP?</h2>
          <p>
            Leading IAP libraries are already implementing the Open IAP
            specification:
          </p>
          <ul>
            <li>
              <strong>
                <a
                  href="https://github.com/hyochan/expo-iap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap
                </a>
                :
              </strong>{' '}
              React Native & Expo implementation
            </li>
            <li>
              <strong>
                <a
                  href="https://github.com/hyochan/flutter_inapp_purchase"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase
                </a>
                :
              </strong>{' '}
              Flutter implementation
            </li>
            <li>
              <strong>
                <a
                  href="https://github.com/hyochan/kmp-iap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap
                </a>
                :
              </strong>{' '}
              Kotlin Multiplatform implementation
            </li>
          </ul>
          <p>
            These libraries demonstrate that Open IAP's unified approach works
            in practice, providing consistent APIs while leveraging
            platform-specific capabilities.
          </p>
        </section>
      </div>
    </div>
  );
}

export default Introduction;
