import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function PurchaseUpdatedListenerOptions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="PurchaseUpdatedListenerOptions"
        description="Options for purchaseUpdatedListener, including iOS StoreKit duplicate replay delivery."
        path="/docs/types/purchase-updated-listener-options"
        keywords="PurchaseUpdatedListenerOptions, purchaseUpdatedListener options, includeDuplicateTransactionUpdatesIOS"
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
                <code>includeDuplicateTransactionUpdatesIOS</code>
              </td>
              <td>
                <code>boolean?</code>
              </td>
              <td>
                iOS only. Defaults to <code>false</code>. When true, the
                listener also receives StoreKit replay events for a transaction
                ID already emitted during the current connection session.
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
          session. Enable the flag only when you need to inspect native StoreKit
          replay behavior or build your own duplicate handling.
        </p>

        <AnchorLink id="examples" level="h3">
          Examples
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`purchaseUpdatedListener(onPurchase, {
  includeDuplicateTransactionUpdatesIOS: true,
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`OpenIapModule.shared.purchaseUpdatedListener(
    onPurchase,
    options: PurchaseUpdatedListenerOptions(
        includeDuplicateTransactionUpdatesIOS: true
    )
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`kmpIAP.purchaseUpdatedListener(
    PurchaseUpdatedListenerOptions(
        includeDuplicateTransactionUpdatesIOS = true
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`FlutterInappPurchase.instance.purchaseUpdatedListenerWithOptions(
  const PurchaseUpdatedListenerOptions(
    includeDuplicateTransactionUpdatesIOS: true,
  ),
);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`Iap.Instance.PurchaseUpdatedWithOptions(
    new PurchaseUpdatedListenerOptions
    {
        IncludeDuplicateTransactionUpdatesIOS = true,
    });`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var options = Types.PurchaseUpdatedListenerOptions.new()
options.include_duplicate_transaction_updates_ios = true
iap.set_purchase_updated_listener_options(options)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default PurchaseUpdatedListenerOptions;
