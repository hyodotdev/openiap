import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

/**
 * Renders the docs page for purchase update listener options.
 * @returns The PurchaseUpdatedListenerOptions documentation page.
 */
function PurchaseUpdatedListenerOptions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="PurchaseUpdatedListenerOptions"
        description="Options for purchaseUpdatedListener, including iOS StoreKit duplicate replay delivery."
        path="/docs/types/purchase-updated-listener-options"
        keywords="PurchaseUpdatedListenerOptions, purchaseUpdatedListener options, dedupeTransactionIOS"
      />
      <h1>PurchaseUpdatedListenerOptions</h1>

      <section>
        <AnchorLink id="purchase-updated-listener-options" level="h2">
          PurchaseUpdatedListenerOptions
        </AnchorLink>
        <p>
          Options passed when registering{' '}
          <Link to="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </Link>
          . The current option is iOS-only and controls whether a listener
          receives StoreKit replay events for transaction IDs already delivered
          during the current connection session.
        </p>

        <AnchorLink id="fields" level="h3">
          Fields
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>dedupeTransactionIOS</code>
              </td>
              <td>
                <code>boolean?</code>
              </td>
              <td>
                iOS only. Defaults to <code>true</code>. When false, the
                listener also receives StoreKit replay events for a transaction
                ID already emitted during the current connection session.
                Android ignores this option.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="default-behavior" level="h3">
          Default Behavior
        </AnchorLink>
        <p>
          The default is designed for entitlement safety: purchase success
          handlers run once per iOS transaction ID during one connection
          session. Set the flag to <code>false</code> only when you need to
          inspect native StoreKit replay behavior or build your own duplicate
          handling.
        </p>

        <AnchorLink id="examples" level="h3">
          Examples
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`purchaseUpdatedListener(onPurchase, {
  dedupeTransactionIOS: false,
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`OpenIapModule.shared.purchaseUpdatedListener(
    onPurchase,
    options: PurchaseUpdatedListenerOptions(
        dedupeTransactionIOS: false
    )
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`kmpIAP.purchaseUpdatedListener(
    PurchaseUpdatedListenerOptions(
        dedupeTransactionIOS = false
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`FlutterInappPurchase.instance.purchaseUpdatedListenerWithOptions(
  const PurchaseUpdatedListenerOptions(
    dedupeTransactionIOS: false,
  ),
);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`OpenIapClient.Instance.PurchaseUpdatedWithOptions(
    new PurchaseUpdatedListenerOptions
    {
        DedupeTransactionIOS = false,
    });`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var options = Types.PurchaseUpdatedListenerOptions.new()
options.dedupe_transaction_ios = false
iap.set_purchase_updated_listener_options(options)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default PurchaseUpdatedListenerOptions;
