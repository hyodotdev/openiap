import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function OnePager() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="About OpenIAP"
        description="OpenIAP — a neutral interoperability layer for in-app purchase APIs and verification across all platforms and frameworks."
        path="/docs/foundation/about"
        keywords="OpenIAP, in-app purchase standard, cross-platform IAP, purchase verification, open source"
      />
      <h1>
        OpenIAP: Neutral Interoperability Layer for In-App Purchase APIs and
        Verification
      </h1>
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderLeft: '3px solid var(--primary-color)',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
        }}
      >
        <strong>Draft</strong> — The Foundation section is currently being
        prepared. Content may change as the governance structure is finalized.
      </div>

      <section>
        <AnchorLink id="problem" level="h2">
          The Problem
        </AnchorLink>
        <p>
          In-app purchase (IAP) implementations are fragmented across platforms.
          Every framework — React Native, Expo, Flutter, KMP, Godot, native iOS,
          native Android — reinvents the same wheel: different type definitions,
          different error models, different verification flows, different
          edge-case handling.
        </p>
        <p>
          The landscape is expanding rapidly. New platforms like{' '}
          <a
            href="https://developer.meta.com/horizon/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Meta Horizon OS
          </a>
          ,{' '}
          <a
            href="https://developer.amazon.com/apps-and-games/vega"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vega OS
          </a>
          ,{' '}
          <a
            href="https://consumer.huawei.com/en/harmonyos/"
            target="_blank"
            rel="noopener noreferrer"
          >
            HarmonyOS
          </a>
          , and{' '}
          <a
            href="https://developer.amazon.com/apps-and-games"
            target="_blank"
            rel="noopener noreferrer"
          >
            Amazon Fire OS
          </a>{' '}
          continue to emerge and grow, while stores beyond Google Play and the
          App Store — such as{' '}
          <a
            href="https://galaxystore.samsung.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Galaxy Store
          </a>
          ,{' '}
          <a
            href="https://consumer.huawei.com/en/mobileservices/appgallery/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Huawei AppGallery
          </a>
          , and alternative marketplaces like{' '}
          <a
            href="https://onside.io/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Onside
          </a>{' '}
          — each bring their own billing APIs. Even the established stores like{' '}
          <a
            href="https://play.google.com/console"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Play
          </a>{' '}
          and{' '}
          <a
            href="https://developer.apple.com/app-store/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple App Store
          </a>{' '}
          evolve their billing APIs with every major release. As this
          fragmentation accelerates with every new platform and marketplace, a
          unified standard becomes not just useful but essential. This leads to:
        </p>
        <ul>
          <li>
            <strong>Duplicated effort</strong> across ecosystems, with each SDK
            maintaining its own interpretation of store APIs
          </li>
          <li>
            <strong>Inconsistent behavior</strong> causing revenue leakage,
            failed transactions, and poor user experiences
          </li>
          <li>
            <strong>Security gaps</strong> where receipt validation and fraud
            prevention are left as afterthoughts
          </li>
          <li>
            <strong>High maintenance burden</strong> as Apple, Google, and an
            expanding set of stores frequently change their billing APIs
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="what-is-openiap" level="h2">
          What OpenIAP Is
        </AnchorLink>
        <p>
          OpenIAP is an{' '}
          <strong>
            open cross-platform purchase interoperability standard
          </strong>{' '}
          — not just a library, but a shared specification layer that ensures
          consistent, secure, and verifiable in-app purchase behavior across all
          platforms and frameworks.
        </p>

        <AnchorLink id="core-components" level="h3">
          Core Components
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>GraphQL Schema</strong>
              </td>
              <td>
                Single source of truth for all purchase types, operations, and
                error codes
              </td>
            </tr>
            <tr>
              <td>
                <strong>IR-Based Code Generation</strong>
              </td>
              <td>
                Intermediate Representation system generating type-safe bindings
                for Swift, Kotlin, Dart, GDScript
              </td>
            </tr>
            <tr>
              <td>
                <strong>Platform Implementations</strong>
              </td>
              <td>
                Reference implementations for Apple StoreKit 2 and Google Play
                Billing 8.x
              </td>
            </tr>
            <tr>
              <td>
                <strong>Verification Profiles</strong>
              </td>
              <td>
                Standardized purchase verification and receipt validation
                patterns
              </td>
            </tr>
            <tr>
              <td>
                <strong>Conformance Tests</strong>
              </td>
              <td>
                Cross-platform test matrix ensuring behavioral consistency
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="vendor-neutral" level="h2">
          Why It Must Be Vendor-Neutral
        </AnchorLink>
        <p>
          In-app purchase infrastructure touches <strong>every</strong> mobile
          and game developer. When a single entity controls the standard:
        </p>
        <ul>
          <li>Competing frameworks hesitate to adopt it</li>
          <li>Platform-specific biases creep into the specification</li>
          <li>Security guidance becomes secondary to feature velocity</li>
          <li>Breaking changes happen without ecosystem consensus</li>
        </ul>
        <p>
          A neutral home ensures that Apple developers, Android developers, game
          studios, cross-platform framework teams, and verification service
          providers all have equal voice in shaping the standard.
        </p>
      </section>

      <section>
        <AnchorLink id="who-uses-it" level="h2">
          Who Uses It Today
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Ecosystem</th>
              <th>Integration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>React Native</strong>
              </td>
              <td>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  react-native-iap
                </a>{' '}
                (4.2M+ total downloads)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Expo</strong>
              </td>
              <td>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Flutter</strong>
              </td>
              <td>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Kotlin Multiplatform</strong>
              </td>
              <td>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Godot Engine</strong>
              </td>
              <td>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Native iOS/macOS</strong>
              </td>
              <td>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple
                </a>{' '}
                (StoreKit 2)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Native Android</strong>
              </td>
              <td>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-google
                </a>{' '}
                (Play Billing + Meta Horizon)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="traction" level="h3">
          Current Traction
        </AnchorLink>
        <ul>
          <li>
            <strong>Platforms</strong>: iOS, macOS, tvOS, watchOS, Android, Meta
            Quest/Horizon
          </li>
          <li>
            <strong>Languages Generated</strong>: Swift, Kotlin, Dart, GDScript
          </li>
          <li>
            <strong>Store APIs Supported</strong>: Apple StoreKit 2, Google Play
            Billing 8.x, Meta Horizon 1.1
          </li>
          <li>
            <strong>Sponsor</strong>: Meta (founding sponsor)
          </li>
          <li>
            <strong>Maintainer</strong>: Hyo (hyo.dev) — 500+ commits, 80+
            merged PRs
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="roadmap" level="h2">
          What We're Building Next
        </AnchorLink>

        <h4>Near-term (0–6 months)</h4>
        <ul>
          <li>Purchase verification profile specification</li>
          <li>Receipt validation best practices document</li>
          <li>Conformance test suite across all supported platforms</li>
          <li>Security guidance for transaction integrity</li>
        </ul>

        <h4>Mid-term (6–12 months)</h4>
        <ul>
          <li>Audit-friendly purchase schema with structured logging</li>
          <li>Secure provider interoperability specification</li>
          <li>Additional platform support (Unity, Unreal Engine)</li>
          <li>Formal specification versioning process</li>
        </ul>

        <h4>Long-term (12–24 months)</h4>
        <ul>
          <li>Industry-wide conformance certification</li>
          <li>Third-party auditor integration guidelines</li>
          <li>
            Emerging store API support (alternative app stores, regulatory
            compliance)
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="why-now" level="h2">
          Why Now
        </AnchorLink>
        <ol>
          <li>
            <strong>AI code generation era</strong>: Standardized APIs are
            critical — AI assistants need consistent, well-typed interfaces to
            generate correct purchase code
          </li>
          <li>
            <strong>Regulatory changes</strong>: EU DMA, Epic v. Apple —
            alternative payment systems need interoperability standards
          </li>
          <li>
            <strong>Platform API churn</strong>: Both Apple (StoreKit 2) and
            Google (Billing 8.x) have made breaking changes in recent years
          </li>
          <li>
            <strong>Security scrutiny</strong>: App store fraud and receipt
            manipulation are growing concerns requiring industry-standard
            verification
          </li>
        </ol>
      </section>

      <section>
        <AnchorLink id="contact" level="h2">
          Contact
        </AnchorLink>
        <ul>
          <li>
            <strong>Project Lead</strong>: Hyo —{' '}
            <a href="mailto:hyo@hyo.dev">hyo@hyo.dev</a>
          </li>
          <li>
            <strong>GitHub</strong>:{' '}
            <a
              href="https://github.com/hyodotdev/openiap"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/hyodotdev/openiap
            </a>
          </li>
          <li>
            <strong>Website</strong>:{' '}
            <a
              href="https://openiap.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              openiap.dev
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default OnePager;
