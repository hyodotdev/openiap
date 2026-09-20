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
        Choose your app’s framework for install commands and working code. To
        have an assistant handle setup,{' '}
        <Link to="/docs/guides/ai-assistants">build with AI</Link>.
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
        <p>Complete your store’s setup before testing purchases:</p>
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
            <Link to="/docs/setup/store">Store Setup</Link> — Horizon OS, Fire
            OS, Vega OS, and alternative marketplace targets
          </li>
        </ul>
      </section>

      <details>
        <summary>API and implementation references</summary>
        <AnchorLink id="cross-cutting" level="h2">
          Shared references
        </AnchorLink>
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
      </details>
    </div>
  );
}

export default SetupIndex;
