import { useState } from 'react';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Ecosystem() {
  useScrollToHash();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="doc-page">
      <SEO
        title="Ecosystem"
        description="Explore the OpenIAP ecosystem - a unified in-app purchase specification across iOS, Android, React Native, Flutter, and Kotlin Multiplatform."
        path="/docs/ecosystem"
      />
      <h1>Ecosystem</h1>
      <p>
        Here is the big picture of OpenIAP ecosystem. If you are interested in
        joining the ecosystem, please contact{' '}
        <a href="mailto:hyo@hyo.dev">hyo@hyo.dev</a>.
      </p>

      <section>
        <img
          src="/ecosystem.png"
          alt="OpenIAP Ecosystem"
          style={{
            width: '100%',
            maxWidth: '900px',
            margin: '2rem 0',
            cursor: 'pointer',
          }}
          onClick={() => setIsModalOpen(true)}
        />
      </section>

      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <img
            src="/ecosystem.png"
            alt="OpenIAP Ecosystem"
            style={{
              maxWidth: '95vw',
              maxHeight: '95vh',
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      <section>
        <h2>Core</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/gql"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>openiap-gql</strong>
            </a>
            : GraphQL definition of OpenIAP specification which manages the type
            system for all underlying libraries.
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>openiap-google</strong>
            </a>
            : Android library for Google Play Billing with native Kotlin
            implementation. Also provides{' '}
            <a
              href="https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google-horizon"
              target="_blank"
              rel="noopener noreferrer"
            >
              <code>openiap-google-horizon</code>
            </a>{' '}
            flavor to support Meta HorizonOS. Distributed to third party
            libraries for consistent bug fixes and features. Of course, third
            party libraries can also support HorizonOS thanks to this.
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>openiap-apple</strong>
            </a>
            : iOS/macOS/tvOS library using StoreKit 2 with native Swift
            implementation. Distributed to third party libraries for consistent
            bug fixes and features.
          </li>
        </ul>
      </section>

      <section>
        <h2>Third Parties</h2>
        <p>
          The following libraries are not included in the OpenIAP monorepo but
          are part of the ecosystem.
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/dooboolab-community/react-native-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>react-native-iap</strong>
            </a>
            : React Native library for in-app purchases. Can be installed
            directly without Expo modules. Also provides an Expo plugin for Expo
            projects.
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyochan/expo-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>expo-iap</strong>
            </a>
            : Expo module for in-app purchases. Requires expo-modules-core to be
            installed in React Native CLI projects. Offers better integration
            with Expo ecosystem.
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/dooboolab-community/flutter_inapp_purchase"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>flutter_inapp_purchase</strong>
            </a>
            : Flutter plugin for in-app purchases.
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/nicoseng/kmp-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>kmp-iap</strong>
            </a>
            : Kotlin Multiplatform library for in-app purchases.
          </li>
        </ul>
      </section>

      <section
        style={{
          marginTop: '3rem',
          padding: '1.5rem',
          backgroundColor: 'var(--bg-secondary, #f5f5f5)',
          borderRadius: '8px',
          borderLeft: '4px solid #ea4aaa',
        }}
      >
        <p style={{ margin: 0, fontStyle: 'italic' }}>
          Maintaining open source libraries requires significant time and
          effort. If you find OpenIAP helpful, please consider{' '}
          <a href="/sponsors">sponsoring</a> to help us sustain and grow this
          ecosystem.
        </p>
      </section>
    </div>
  );
}

export default Ecosystem;
