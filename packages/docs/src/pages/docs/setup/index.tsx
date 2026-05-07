import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

interface FrameworkRow {
  to: string;
  name: string;
  language: string;
  description: string;
}

const FRAMEWORKS: FrameworkRow[] = [
  {
    to: '/docs/setup/expo',
    name: 'Expo',
    language: 'TypeScript',
    description:
      'Expo SDK projects via Expo Modules. Same API surface as react-native-iap, including the `useIAP` hook, with managed-workflow-friendly install. Recommended for any Expo app.',
  },
  {
    to: '/docs/setup/react-native',
    name: 'React Native',
    language: 'TypeScript',
    description:
      'Bare React Native CLI projects (RN 0.79+). Built on Nitro Modules with the `useIAP` hook, error normalization, and full StoreKit 2 / Play Billing 8 coverage.',
  },
  {
    to: '/docs/setup/flutter',
    name: 'Flutter',
    language: 'Dart',
    description:
      'Flutter apps via the `flutter_inapp_purchase` package. Generated `types.dart`, sealed-class results, and a Stream-based event API that mirrors the OpenIAP schema.',
  },
  {
    to: '/docs/setup/kmp',
    name: 'Kotlin Multiplatform',
    language: 'Kotlin',
    description:
      'KMP / Compose Multiplatform via the `kmp-iap` library. Flow-based API on top of OpenIAP, with CocoaPods integration for iOS targets and shared business logic across platforms.',
  },
  {
    to: '/docs/setup/maui',
    name: '.NET MAUI',
    language: 'C#',
    description:
      '.NET MAUI / C# 12 via the `maui-iap` library (Hyo.OpenIap.Maui). Ships as one NuGet package with generated `Types.cs`, flattened Android AAR bindings, and StoreKit xcframework resources for iOS / macCatalyst.',
  },
  {
    to: '/docs/setup/godot',
    name: 'Godot',
    language: 'GDScript',
    description:
      'Godot 4.x via the `godot-iap` plugin (iOS GDExtension + Android AAR). Exposes the same OpenIAP function set so the same purchase flow can ship across mobile + console targets.',
  },
];

function SetupIndex() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Framework Setup"
        description="Choose an OpenIAP-powered framework — Expo, React Native, Flutter, Kotlin Multiplatform, .NET MAUI, or Godot — and follow the install guide."
        path="/docs/setup"
        keywords="OpenIAP, Framework Setup, expo-iap, react-native-iap, flutter_inapp_purchase, kmp-iap, maui-iap, godot-iap"
      />
      <h1>Framework Setup</h1>
      <p>
        Pick the framework you ship in. Every supported framework wraps the same
        OpenIAP specification, so the API surface, type names, and event
        patterns are consistent across stacks — only the install steps differ.
      </p>

      <section>
        <AnchorLink id="frameworks" level="h2">
          Supported Frameworks
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Framework</th>
              <th>Language</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {FRAMEWORKS.map((row) => (
              <tr key={row.to}>
                <td>
                  <Link to={row.to}>
                    <strong>{row.name}</strong>
                  </Link>
                </td>
                <td>
                  <code>{row.language}</code>
                </td>
                <td>{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="before-you-start" level="h2">
          Before You Start
        </AnchorLink>
        <p>
          Each framework guide assumes you've already finished the platform
          store configuration. Complete those first:
        </p>
        <ul>
          <li>
            <Link to="/docs/ios-setup">iOS Setup</Link> — App Store Connect
            agreement, capabilities, sandbox testers
          </li>
          <li>
            <Link to="/docs/android-setup">Android Setup</Link> — Play Console
            account, license testers, billing permission
          </li>
          <li>
            <Link to="/docs/horizon-setup">Horizon OS Setup</Link> — Meta Quest
            developer dashboard for the Horizon Store
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="cross-cutting" level="h2">
          Cross-Cutting Topics
        </AnchorLink>
        <p>
          These pages apply regardless of which framework you pick — read them
          once, then jump back to your framework guide:
        </p>
        <ul>
          <li>
            <Link to="/docs/apis">API Reference</Link> — every function,
            organized by symbol
          </li>
          <li>
            <Link to="/docs/types">Type Definitions</Link> — every type with
            field tables and cross-links
          </li>
          <li>
            <Link to="/docs/events">Events & Listeners</Link> — purchase / error
            / promoted-product event patterns
          </li>
          <li>
            <Link to="/docs/features/validation">Validation</Link> — server
            verification, IAPKit integration
          </li>
          <li>
            <Link to="/docs/errors">Error Handling</Link> — unified{' '}
            <Link to="/docs/errors#error-structure">
              <code>PurchaseError</code>
            </Link>{' '}
            shape and error codes
          </li>
        </ul>
      </section>
    </div>
  );
}

export default SetupIndex;
