import Callout from '../../components/Callout';
import EcosystemDiagram from '../../components/EcosystemDiagram';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Ecosystem() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Ecosystem"
        description="OpenIAP ecosystem overview. Native modules power six framework SDKs, while IAPKit adds optional hosted purchase verification, entitlements, store notifications, product sync, and MCP operations."
        path="/docs/ecosystem"
        keywords="OpenIAP ecosystem, IAPKit, openiap-apple, openiap-google, IAP architecture, purchase verification, cross-platform IAP"
      />
      <h1>Ecosystem</h1>
      <p>
        OpenIAP defines the shared purchase contract and ships native and
        framework SDKs. IAPKit adds optional hosted purchase verification,
        entitlements, store notifications, product sync, and MCP operations. If
        you are interested in joining the ecosystem, please contact{' '}
        <a href="mailto:hyo@hyo.dev">hyo@hyo.dev</a>.
      </p>

      <EcosystemDiagram />

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
            flavor to support Meta HorizonOS and{' '}
            <a
              href="https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google-amazon"
              target="_blank"
              rel="noopener noreferrer"
            >
              <code>openiap-google-amazon</code>
            </a>{' '}
            flavor to support Fire OS. Distributed to third party libraries for
            consistent bug fixes and features.
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
          The following libraries are included in the OpenIAP monorepo under{' '}
          <code>libraries/</code> and are part of the ecosystem.
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>expo-iap</strong>
            </a>
            : Expo module for in-app purchases. Requires expo-modules-core to be
            installed in React Native CLI projects. Offers better integration
            with Expo ecosystem. <a href="/docs/setup/expo">Setup Guide</a>
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>react-native-iap</strong>
            </a>
            : React Native library for in-app purchases. Can be installed
            directly without Expo modules. Also provides an Expo plugin for Expo
            projects. <a href="/docs/setup/react-native">Setup Guide</a>
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>flutter_inapp_purchase</strong>
            </a>
            : Flutter plugin for in-app purchases.{' '}
            <a href="/docs/setup/flutter">Setup Guide</a>
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>kmp-iap</strong>
            </a>
            : Kotlin Multiplatform library for in-app purchases.{' '}
            <a href="/docs/setup/kmp">Setup Guide</a>
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/maui-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>maui-iap</strong>
            </a>
            : .NET MAUI / C# library for in-app purchases.{' '}
            <a href="/docs/setup/maui">Setup Guide</a>
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>godot-iap</strong>
            </a>
            : Godot plugin for in-app purchases using GDScript.{' '}
            <a href="/docs/setup/godot">Setup Guide</a>
          </li>
        </ul>
      </section>

      <section>
        <h2>Optional infrastructure</h2>
        <p>
          <a href="/docs/kit-backend">
            <strong>IAPKit</strong>
          </a>{' '}
          is the optional hosted layer for teams that need server-side purchase
          verification, entitlement state, App Store and Google Play lifecycle
          notifications, product synchronization, revenue visibility, and MCP
          operations without building a separate IAP backend.
        </p>
      </section>

      <Callout kind="note">
        Maintaining open source libraries requires significant time and effort.
        If you find OpenIAP helpful, please consider{' '}
        <a href="/sponsors">sponsoring</a> to help us sustain and grow this
        ecosystem.
      </Callout>
    </div>
  );
}

export default Ecosystem;
