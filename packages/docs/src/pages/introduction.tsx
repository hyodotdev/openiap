import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

function Introduction() {
  return (
    <div className="page-container">
      <SEO
        title="Introduction"
        description="OpenIAP - The unified specification for in-app purchases. One API to learn, every platform supported. StoreKit 2, Android Billing, Vision Pro, Meta Horizon OS."
        path="/introduction"
        keywords="OpenIAP, in-app purchase, IAP specification, StoreKit 2, Google Play Billing, Vision Pro IAP, Horizon OS IAP, cross-platform payments"
      />
      <div className="content-wrapper">
        {/* Hero Section */}
        <div
          style={{
            textAlign: 'center',
            padding: '2rem 0 3rem',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '2.5rem',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 2.75rem)',
              marginBottom: '1rem',
              lineHeight: '1.2',
            }}
          >
            Stop Rewriting IAP Code
            <br />
            <span style={{ color: 'var(--primary-color)' }}>
              For Every Platform
            </span>
          </h1>
          <p
            style={{
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              maxWidth: '700px',
              margin: '0 auto 2rem',
              lineHeight: '1.6',
            }}
          >
            OpenIAP is the <strong>unified specification</strong> for in-app
            purchases. Write once, ship to iOS, Android, Vision Pro, and Meta
            Quest with type-safe, consistent APIs.
          </p>

          {/* Quick Stats */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '2.5rem',
              flexWrap: 'wrap',
              marginBottom: '2rem',
            }}
          >
            <a
              href="https://github.com/dooboolab-community/react-native-iap"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: 'var(--primary-color)',
                }}
              >
                4K+
              </div>
              <div
                style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
              >
                Combined Stars
              </div>
            </a>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: 'var(--primary-color)',
                }}
              >
                5+
              </div>
              <div
                style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
              >
                Framework Libraries
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              to="/docs/apis"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1.75rem',
                background: 'var(--primary-color)',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease',
              }}
            >
              Get Started
            </Link>
            <a
              href="https://github.com/hyodotdev/openiap"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1.75rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease',
              }}
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Key Benefits - Visual Cards */}
        <section className="intro-section">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
                1x
              </div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
                Learn Once
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Master one API instead of learning different patterns for iOS,
                Android, and every framework
              </p>
            </div>
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
                0
              </div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
                Runtime Errors
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Type-safe generated code catches mistakes at compile time, not
                in production
              </p>
            </div>
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
                100%
              </div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
                Platform Features
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Full access to StoreKit 2 and Play Billing v8 - no features
                hidden or abstracted away
              </p>
            </div>
          </div>
        </section>

        {/* Core Modules Visual */}
        <section className="intro-section">
          <h2>Native Modules</h2>
          <p>
            OpenIAP provides{' '}
            <strong>production-ready native modules</strong> that power all
            framework implementations. Built on{' '}
            <a
              href="https://developer.apple.com/storekit/"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit 2
            </a>{' '}
            and{' '}
            <a
              href="https://developer.android.com/google/play/billing"
              target="_blank"
              rel="noopener noreferrer"
            >
              Play Billing v8
            </a>
            .
          </p>
          <div
            style={{
              display: 'flex',
              gap: '2rem',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textDecoration: 'none',
                padding: '1.5rem',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                transition: 'all 0.2s ease',
              }}
            >
              <img
                src="/openiap-apple.png"
                alt="openiap-apple"
                style={{
                  width: '80px',
                  height: '80px',
                  marginBottom: '0.75rem',
                }}
              />
              <span
                style={{
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                }}
              >
                openiap-apple
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                StoreKit 2
              </span>
            </a>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textDecoration: 'none',
                padding: '1.5rem',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                transition: 'all 0.2s ease',
              }}
            >
              <img
                src="/openiap-google.png"
                alt="openiap-google"
                style={{
                  width: '80px',
                  height: '80px',
                  marginBottom: '0.75rem',
                }}
              />
              <span
                style={{
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                }}
              >
                openiap-google
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Play Billing v8
              </span>
            </a>
          </div>
        </section>

        <section className="intro-section">
          <h2>The IAP Fragmentation Problem</h2>
          <div
            style={{
              background:
                'linear-gradient(135deg, rgba(164, 116, 101, 0.08), rgba(164, 116, 101, 0.02))',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.7' }}>
              Every IAP library reinvents the wheel.{' '}
              <strong>Different method names.</strong>{' '}
              <strong>Different event patterns.</strong>{' '}
              <strong>Different type definitions.</strong> Switching frameworks
              means relearning everything. AI assistants can't help because no
              two libraries work the same way.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                borderLeft: '3px solid #e74c3c',
              }}
            >
              <strong style={{ color: '#e74c3c' }}>Wasted Time</strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Learning new APIs for each framework
              </p>
            </div>
            <div
              style={{
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                borderLeft: '3px solid #e67e22',
              }}
            >
              <strong style={{ color: '#e67e22' }}>Production Bugs</strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Inconsistent type handling across platforms
              </p>
            </div>
            <div
              style={{
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                borderLeft: '3px solid #9b59b6',
              }}
            >
              <strong style={{ color: '#9b59b6' }}>Duplicated Effort</strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Maintainers solving same problems independently
              </p>
            </div>
          </div>
          <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
            And it's getting worse. New platforms like{' '}
            <a
              href="https://developer.apple.com/visionos/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vision Pro
            </a>{' '}
            and <Link to="/docs/horizon-setup">Horizon OS</Link> mean more APIs
            to learn, more fragmentation to manage.
          </p>
        </section>

        <section className="intro-section">
          <h2>The OpenIAP Solution</h2>
          <p
            style={{
              fontSize: '1.1rem',
              marginBottom: '2rem',
              color: 'var(--text-secondary)',
            }}
          >
            One specification. One API. Every platform.
          </p>

          {/* Ecosystem Diagram */}
          <div
            style={{
              margin: '0 0 2rem',
              textAlign: 'center',
            }}
          >
            <Link to="/docs/ecosystem">
              <img
                src="/ecosystem.png"
                alt="OpenIAP Ecosystem - Native modules power framework implementations"
                style={{
                  maxWidth: '100%',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                }}
              />
            </Link>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginTop: '0.75rem',
              }}
            >
              <Link to="/docs/ecosystem">View full ecosystem diagram →</Link>
            </p>
          </div>

          {/* Feature Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
                Unified API
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                }}
              >
                Standard methods like{' '}
                <Link to="/docs/apis/connection#init-connection">
                  <code>initConnection()</code>
                </Link>
                ,{' '}
                <Link to="/docs/apis/products#fetch-products">
                  <code>fetchProducts()</code>
                </Link>
                , and{' '}
                <Link to="/docs/apis/purchase#request-purchase">
                  <code>requestPurchase()</code>
                </Link>{' '}
                work identically everywhere.
              </p>
            </div>

            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
                Generated Types
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                }}
              >
                From one GraphQL schema, generate native types for Swift,
                Kotlin, TypeScript, Dart, and GDScript.{' '}
                <Link to="/docs/types">Download →</Link>
              </p>
            </div>

            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
                Platform-Aware
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                }}
              >
                Clear naming:{' '}
                <Link to="/docs/types/product">
                  <code>Product</code>
                </Link>{' '}
                for shared,{' '}
                <Link to="/docs/types/ios">
                  <code>ProductIOS</code>
                </Link>
                /
                <Link to="/docs/types/android">
                  <code>ProductAndroid</code>
                </Link>{' '}
                for platform-specific.
              </p>
            </div>

            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
                AI-Ready
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                }}
              >
                Standardized APIs mean AI assistants generate reliable,
                predictable IAP code across all frameworks.
              </p>
            </div>
          </div>
        </section>

        <section className="intro-section">
          <h2>Supported Platforms</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginTop: '1.5rem',
            }}
          >
            <a
              href="https://developer.apple.com/storekit/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🍎</span>
              <div>
                <strong>iOS / macOS / Vision Pro</strong>
                <div
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
                  StoreKit 2
                </div>
              </div>
            </a>
            <a
              href="https://developer.android.com/google/play/billing"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🤖</span>
              <div>
                <strong>Android</strong>
                <div
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
                  Play Billing v8
                </div>
              </div>
            </a>
            <Link
              to="/docs/horizon-setup"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🎮</span>
              <div>
                <strong>Meta Quest</strong>
                <div
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
                  Horizon OS
                </div>
              </div>
            </Link>
          </div>
        </section>

        <section className="intro-section">
          <h2>Implementations</h2>
          <p>
            Production-ready libraries implementing the OpenIAP specification:
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginTop: '1.5rem',
            }}
          >
            <a
              href="https://github.com/dooboolab-community/react-native-iap"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '1.25rem',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <strong style={{ color: 'var(--primary-color)' }}>
                react-native-iap
              </strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                React Native with Nitro Modules for near-native performance
              </p>
            </a>
            <a
              href="https://github.com/hyochan/expo-iap"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '1.25rem',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <strong style={{ color: 'var(--primary-color)' }}>expo-iap</strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Native Expo Module with full Expo workflow support
              </p>
            </a>
            <a
              href="https://github.com/hyochan/flutter_inapp_purchase"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '1.25rem',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <strong style={{ color: 'var(--primary-color)' }}>
                flutter_inapp_purchase
              </strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Flutter plugin with Pigeon-generated type-safe bindings
              </p>
            </a>
            <a
              href="https://github.com/hyochan/kmp-iap"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '1.25rem',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <strong style={{ color: 'var(--primary-color)' }}>kmp-iap</strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Kotlin Multiplatform for shared business logic across platforms
              </p>
            </a>
            <a
              href="https://github.com/hyochan/godot-iap"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '1.25rem',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <strong style={{ color: 'var(--primary-color)' }}>godot-iap</strong>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Godot 4.x plugin for game developers
              </p>
            </a>
          </div>
          <p style={{ marginTop: '1.5rem' }}>
            <Link to="/languages">View all implementations →</Link>
          </p>
        </section>

        <section className="intro-section">
          <h2>Get Started</h2>
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              marginTop: '1.5rem',
            }}
          >
            <Link
              to="/docs/apis"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'var(--primary-color)',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              📚 API Reference
            </Link>
            <Link
              to="/docs/types"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              📦 Type Definitions
            </Link>
            <Link
              to="/tutorials"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              🎓 Tutorials
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Introduction;
