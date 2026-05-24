import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { LIBRARIES } from '../../../lib/images';

interface FrameworkRow {
  to: string;
  name: string;
  language: string;
  description: string;
}

const FRAMEWORKS: FrameworkRow[] = LIBRARIES.map((library) => ({
  to: library.setupPath,
  name: library.frameworkName,
  language: library.language,
  description: library.setupDescription,
}));

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
          <li>
            <Link to="/docs/fireos-setup">Fire OS Setup</Link> — Android{' '}
            <code>amazon</code> flavor for Amazon Appstore distribution
          </li>
          <li>
            <Link to="/docs/features/vega-os">Vega OS Runtime</Link> — React
            Native / Expo JavaScript adapter for Amazon Vega apps
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
