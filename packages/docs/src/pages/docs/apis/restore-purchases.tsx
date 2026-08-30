import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import StoreConnectionCallout from '../../../components/StoreConnectionCallout';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function RestorePurchases() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="restorePurchases"
        description="Restore completed transactions. Use this to implement a Restore Purchases button for users who reinstall the app."
        path="/docs/apis/restore-purchases"
        keywords="restorePurchases, restore, transaction history"
      />
      <h1>restorePurchases</h1>
      <p>
        Restore completed transactions. Use this to implement a "Restore
        Purchases" button for users who reinstall the app.
      </p>
      <p>
        <strong>iOS:</strong> Triggers <code>AppStore.sync()</code> to refresh
        StoreKit's transaction state; restored purchases are then read via{' '}
        <Link to="/docs/apis/get-available-purchases">
          <code>getAvailablePurchases</code>
        </Link>{' '}
        (or directly via <code>Transaction.currentEntitlements</code>). Asks the
        user to authenticate.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/appstore/sync()"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Calls <code>queryPurchasesAsync</code> for
        both <code>INAPP</code> and <code>SUBS</code>. No system-level UI prompt
        — Play has no concept of an explicit "restore" action.{' '}
        <a
          href="https://developer.android.com/google/play/billing/integrate"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>

      <StoreConnectionCallout />

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`restorePurchases(): Promise<void>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func restorePurchases() async throws`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun restorePurchases()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun restorePurchases()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<void> restorePurchases();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<VoidResult> RestorePurchasesAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func restore_purchases() -> Types.VoidResult`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;void&gt;</code> — Resolves once the platform finishes
        the restore. The restored purchases are emitted via{' '}
        <code>purchaseUpdatedListener</code> / surface as{' '}
        <code>getAvailablePurchases</code> results, depending on platform. In
        MAUI/C#, <code>RestorePurchasesAsync</code> returns{' '}
        <code>Task&lt;VoidResult&gt;</code>. Godot returns a{' '}
        <code>VoidResult</code>; check <code>success</code> because a failed
        store query must not be treated as a successful restore.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { useEffect } from 'react';
import { Button } from 'react-native';

// expo-iap
import {
  restorePurchases,
  getAvailablePurchases,
  finishTransaction,
  useIAP,
} from 'expo-iap';
// Same API in react-native-iap:
// import {
//   restorePurchases,
//   getAvailablePurchases,
//   finishTransaction,
//   useIAP,
// } from 'react-native-iap';

const handleRestore = () => {
  void (async () => {
    await restorePurchases();
    const purchases = await getAvailablePurchases();

    for (const purchase of purchases) {
      // Always verify before granting — restored purchases can include
      // refunded or revoked transactions that must not re-grant entitlement.
      // yourBackend is your authenticated verification client.
      if (!(await yourBackend.verifyPurchase(purchase))) continue;

      await grantProduct(purchase.productId);
      await finishTransaction({ purchase, isConsumable: false });
    }
  })().catch((error) => {
    console.warn('Purchase restore failed:', error);
  });
};

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP's restorePurchases() and getAvailablePurchases() both return
// Promise<void> and update the reactive availablePurchases array — react
// to it inside an effect.

function RestoreButton() {
  const {
    connected,
    availablePurchases,
    restorePurchases,
    finishTransaction,
  } = useIAP();

  const handleRestore = () => {
    void restorePurchases().catch((error) => {
      console.warn('Purchase restore failed:', error);
    });
  };

  useEffect(() => {
    void (async () => {
      for (const purchase of availablePurchases) {
        if (!(await yourBackend.verifyPurchase(purchase))) continue;
        await grantProduct(purchase.productId);
        await finishTransaction({ purchase, isConsumable: false });
      }
    })().catch((error) => {
      console.warn('Restored purchase processing failed:', error);
    });
  }, [availablePurchases, finishTransaction]);

  return (
    <Button
      title="Restore Purchases"
      disabled={!connected}
      onPress={handleRestore}
    />
  );
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.restorePurchases()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.restorePurchases()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`kmpIAP.restorePurchases()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.restorePurchases();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

await ((MutationResolver)OpenIapClient.Instance).RestorePurchasesAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var result = await iap.restore_purchases()
if not result.success:
    push_error("Purchase restore failed")
    return`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default RestorePurchases;
