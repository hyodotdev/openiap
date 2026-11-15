import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function IsExternalPurchaseLinkAvailable() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isExternalPurchaseLinkAvailable"
        description="Check whether this device and storefront may link out to an external purchase."
        path="/docs/apis/is-external-purchase-link-available"
        keywords="isExternalPurchaseLinkAvailable, external purchase, external offers, custom link"
      />
      <h1>isExternalPurchaseLinkAvailable</h1>
      <p>
        Check whether this device and storefront may link out to an external
        purchase with{' '}
        <Link to="/docs/apis/open-external-purchase-link">
          <code>openExternalPurchaseLink</code>
        </Link>
        .
      </p>
      <p>
        Available in Client Protocol 1.5.0 / <code>openiap-apple</code> 4.2.0 /{' '}
        <code>openiap-google</code> 4.2.0 (requires iOS 17.4+ or Play Billing
        8.2.1+).
      </p>
      <ul>
        <li>
          <strong>iOS:</strong> <code>true</code> when{' '}
          <code>ExternalPurchaseCustomLink.isEligible</code> (iOS 18.1+) or{' '}
          <code>ExternalPurchase.canPresent</code> (iOS 17.4+) is true.
        </li>
        <li>
          <strong>Google Play:</strong> <code>true</code> when the external
          offers program is enabled with{' '}
          <code>enableBillingProgramAndroid</code> and available to this user.
        </li>
        <li>
          <strong>
            Amazon, Meta Horizon, Vega OS, macOS, watchOS, iOS before 17.4:
          </strong>{' '}
          always <code>false</code>.
        </li>
      </ul>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`isExternalPurchaseLinkAvailable(): Promise<boolean>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func isExternalPurchaseLinkAvailable() async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun isExternalPurchaseLinkAvailable(): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun isExternalPurchaseLinkAvailable(): Boolean`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> isExternalPurchaseLinkAvailable();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<bool> IsExternalPurchaseLinkAvailableAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func is_external_purchase_link_available() -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>true</code> when <code>openExternalPurchaseLink</code> can show
        the store disclosure. It returns <code>false</code> instead of throwing
        when the program is not enabled or the user is not eligible. A
        connection failure still throws, except in Godot, which has no
        exceptions and returns <code>false</code> for any failure.
      </p>

      <h2>Example</h2>
      <CodeBlock language="typescript">{`import { isExternalPurchaseLinkAvailable } from 'expo-iap'; // or 'react-native-iap'

const showWebCheckout = await isExternalPurchaseLinkAvailable();`}</CodeBlock>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/features/external-purchase#external-purchase-link">
          External Purchase
        </Link>
      </p>
    </div>
  );
}

export default IsExternalPurchaseLinkAvailable;
