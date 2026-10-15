import { Link } from "react-router-dom";

import { Callout } from "../../components/Callout";
import { CodeBlock } from "../../components/CodeBlock";
import { DocsPage } from "../../components/DocsPage";
import confirmPurchaseSource from "./confirm-purchase.ts?raw";

const STATES: {
  status: string;
  meaning: string;
  guidance: string;
}[] = [
  {
    status: "store_pending",
    meaning:
      "Payment is pending at the store: Ask to Buy, or an Android pending payment. The store delivers the purchase again when it completes.",
    guidance: "payment_pending",
  },
  {
    status: "verification_delayed",
    meaning:
      "IAPKit or the store could not answer yet. Retry after retryAfterMs.",
    guidance: "verification_delayed",
  },
  {
    status: "ownership_conflict",
    meaning:
      "The purchase belongs to another account in your app. alreadyGranted is true once that account has access, and the app then finishes the purchase. Ask the user to sign in to that account or contact support.",
    guidance: "owned_by_another_account",
  },
  {
    status: "test_account_restricted",
    meaning:
      "A sandbox or test purchase your backend does not accept. Settled, like invalid.",
    guidance: "test_purchase_not_accepted",
  },
  {
    status: "invalid",
    meaning:
      "The store rejected the purchase for good; reason carries the IAPKit state, such as INAUTHENTIC or EXPIRED. Anything that may still change is verification_delayed.",
    guidance: "purchase_not_valid",
  },
  {
    status: "verified",
    meaning: "Valid, but not linked to the user yet.",
    guidance: "access_pending",
  },
  {
    status: "linked",
    meaning: "Valid and linked, but access is not granted yet.",
    guidance: "access_pending",
  },
  {
    status: "entitled",
    meaning: "Access is granted; alreadyGranted is true on a repeat.",
    guidance: "access_granted",
  },
  {
    status: "failed",
    meaning:
      "The backend call failed or returned an unknown body. Retry later.",
    guidance: "try_again_later",
  },
];

export default function PurchaseFlowPage() {
  return (
    <DocsPage
      slug="purchase-flow"
      title="Purchase flow"
      description="Confirm purchases through your backend: verify with IAPKit, link to the user, grant access, then finish."
    >
      <p>
        Use this flow when your backend owns user accounts and grants access.
        The app finishes a valid purchase only after your backend reports access
        granted, so a paid purchase is never lost and never asked for twice.
        React Native IAP and Expo IAP ship the client half as{" "}
        <code>createPurchaseFlow</code>; this page includes a tested reference
        backend. The flow supports Apple App Store and Google Play purchases
        only, so the Vega entry point does not export it.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Who does what</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>OpenIAP SDK (app)</strong> — buys, restores, and finishes
          transactions.
        </li>
        <li>
          <strong>IAPKit</strong> — verifies with the store, links a purchase to
          your user id, tracks subscription state, and sends verified{" "}
          <Link to="/docs/webhooks" className="text-primary underline">
            commerce events
          </Link>{" "}
          to your backend.
        </li>
        <li>
          <strong>Your backend</strong> — authenticates the user, decides
          ownership policy, and grants access: once per purchase, per period for
          a subscription.
        </li>
      </ul>
      <p>
        IAPKit never decides app policy: a bind never moves a purchase to
        another user, and IAPKit never pushes events to the app.
      </p>
      <CodeBlock language="text">{`app ──purchase──▶ your backend ──verify──────▶ IAPKit
                               ──ownerOf─────▶ your ledger
                               ──bind-user───▶ IAPKit
                               ──grant───────▶ your ledger
app ◀──status──── your backend
app: finishTransaction when access is granted, or the purchase is rejected on iOS`}</CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">Client</h2>
      <CodeBlock title="Expo IAP (React Native IAP is identical)" language="ts">
        {`import {Platform} from 'react-native';
import {
  createPurchaseFlow,
  finishTransaction,
  getAvailablePurchases,
  getPendingTransactionsIOS,
  toPurchaseConfirmationRequest,
} from 'expo-iap';

const flow = createPurchaseFlow({
  confirmWithBackend: async (purchase) => {
    const response = await fetch(\`\${API_URL}/purchases/confirm\`, {
      method: 'POST',
      headers: {
        authorization: \`Bearer \${sessionToken}\`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(toPurchaseConfirmationRequest(purchase)),
    });
    if (!response.ok) throw new Error(\`Backend returned \${response.status}\`);
    return response.json();
  },
  finishTransaction,
  isConsumable: (productId) => CONSUMABLE_IDS.includes(productId),
  getAvailablePurchases,
  getPendingTransactionsIOS:
    Platform.OS === 'ios' ? getPendingTransactionsIOS : undefined,
});

// In onPurchaseSuccess:
const status = await flow.processPurchase(purchase);
// At launch and on returning to the foreground:
const outcomes = await flow.recoverPurchases();`}
      </CodeBlock>
      <p>
        <code>describePurchaseFlowStatus(status)</code> returns a neutral{" "}
        <code>key</code> to map to your own copy, <code>offerPurchase</code>{" "}
        (false whenever the user may already have paid), and{" "}
        <code>retryAfterMs</code> when a retry can help. Pass{" "}
        <code>getPendingTransactionsIOS</code> on iOS: recovery throws without
        it rather than miss an unfinished transaction. The{" "}
        <a
          href="https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap/example/src/components/BackendEntitlementFlow.tsx"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Expo IAP example
        </a>{" "}
        shows every state: pick <strong>App backend</strong> as the verification
        method on its In-App Purchase Flow screen.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">States</h2>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[42rem] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">status</th>
              <th className="px-3 py-2 text-left font-medium">Meaning</th>
              <th className="px-3 py-2 text-left font-medium">Guidance key</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {STATES.map(({ status, meaning, guidance }) => (
              <tr key={status}>
                <td className="px-3 py-2 font-mono text-xs">{status}</td>
                <td className="px-3 py-2">{meaning}</td>
                <td className="px-3 py-2 font-mono text-xs">{guidance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <code>verified</code>, <code>linked</code>, and <code>entitled</code>{" "}
        are successive steps. Only an <code>invalid</code> purchase the user
        just made offers the product again: recovery marks its{" "}
        <code>invalid</code> outcomes <code>recovered</code>, so an old expired
        renewal never asks a subscriber to buy twice. iOS Ask to Buy arrives as
        a <code>deferred-payment</code> purchase error rather than a purchase;
        show it as <code>store_pending</code>.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Finish rules</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Finish <code>entitled</code>, with <code>isConsumable</code> from your
          product config. iOS finishes the transaction; Android consumes a
          consumable and acknowledges everything else. A wrong answer on Android
          consumes a non-consumable or blocks rebuying a consumable.
        </li>
        <li>
          Finish <code>ownership_conflict</code> when{" "}
          <code>alreadyGranted</code> is true. The other account already has
          access, so finishing grants the signed-in user nothing, and Google
          Play no longer refunds the purchase after three days.
        </li>
        <li>
          Finish <code>invalid</code> and <code>test_account_restricted</code>{" "}
          on iOS only. They are settled rejections, so finishing grants nothing
          and stops iOS from delivering them again at every launch. On Google
          Play leave them unacknowledged: Google refunds a purchase that is not
          acknowledged within three days.
        </li>
        <li>
          Never finish any other status, so iOS and Google Play deliver it again
          until it settles.
        </li>
        <li>
          If finishing fails after the grant, the status stays{" "}
          <code>entitled</code> with <code>finishError</code>; recovery finishes
          it later.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Recovery and restore</h2>
      <p>
        Call <code>recoverPurchases()</code> at launch and when the app returns
        to the foreground. It confirms only unfinished purchases (iOS{" "}
        <code>getPendingTransactionsIOS</code>, unacknowledged Android
        purchases), because the flow finishes only settled ones. For a restore
        button, call{" "}
        <code>recoverPurchases({"{ includeFinished: true }"})</code>: the same
        account gets <code>entitled</code> with <code>alreadyGranted</code>, and
        another account gets <code>ownership_conflict</code>. Nothing is
        transferred.
      </p>
      <p>
        Repeating is safe: your backend grants a purchase once and records each
        subscription period once, finishing twice is harmless, and concurrent
        deliveries of one transaction share a backend call. IAPKit replay-limits
        each receipt to about one verification a minute after a burst, so
        respect <code>retryAfterMs</code> instead of looping. The reference
        backend reports <code>429 REPEATED_FAILURE</code>, a receipt IAPKit
        rejected in the last five minutes, as <code>invalid</code>.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Ownership</h2>
      <p>
        A link in IAPKit never moves, so your backend first checks its own
        ledger: a purchase already granted to another user returns{" "}
        <code>ownership_conflict</code> with <code>alreadyGranted: true</code>{" "}
        without binding. Otherwise it calls{" "}
        <code>POST /v1/subscriptions/bind-user</code> with the secret key and
        acts on <code>reason</code>:
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <code>bound</code>, <code>already_bound</code> — linked to this user.
          Every purchase verify called valid links, including a Google purchase
          still awaiting acknowledgment and an unconsumed consumable.
        </li>
        <li>
          <code>bound_to_other_user</code> — return{" "}
          <code>ownership_conflict</code> and grant nothing.
        </li>
        <li>
          <code>not_found</code>, <code>not_bindable</code> — IAPKit keeps no
          link, for example for a user at the link limit; your ledger is the
          only owner record.
        </li>
        <li>
          Any other reason — fail closed: the reference backend throws and
          grants nothing.
        </li>
      </ul>
      <p>
        A publishable key gets no <code>reason</code>, so an app cannot probe
        who owns a purchase. See{" "}
        <Link to="/docs/api" className="text-primary underline">
          Binding from your backend
        </Link>
        .
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Identifiers</h2>
      <p>
        Verify with <code>includeTransactionDetails: true</code> to get the
        identifiers commerce events use:
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <code>transactionId</code> — Apple transaction id or Google order id.
          Both change on every renewal, and Google assigns its order id only
          after acknowledgement.
        </li>
        <li>
          <code>originalTransactionId</code> — Apple only; the same for a
          purchase and all its renewals.
        </li>
        <li>
          <code>expiresAt</code> — end of subscription access, epoch
          milliseconds.
        </li>
        <li>
          <code>commerceEnvironment</code> — <code>production</code> or{" "}
          <code>sandbox</code>.
        </li>
        <li>
          <code>correlationId</code> — quote it to support.
        </li>
      </ul>
      <p>
        Key grants by a value that never changes: Apple{" "}
        <code>originalTransactionId</code>, Google purchase token. Grant a
        one-time purchase once. A subscription is a period instead: a verify
        that returns <code>expiresAt</code> moves the row to that period and
        product, so renewals and plan changes are not lost, and an older
        transaction never shortens it.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Test purchases</h2>
      <p>
        App Review and TestFlight buy in the Apple sandbox against your
        production backend, so the reference backend accepts sandbox and test
        purchases by default. Refusing them fails App Review. To limit who gets
        free test purchases, pass <code>acceptSandbox</code> an allow-list check
        that includes your App Review demo account. Any{" "}
        <code>commerceEnvironment</code> other than <code>production</code>{" "}
        counts as a test purchase.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Reference backend</h2>
      <Callout kind="warning" title="Server only">
        <p>
          <code>confirmPurchase</code> uses the IAPKit secret key. Never ship it
          in an app.
        </p>
      </Callout>
      <p>
        Framework-agnostic and tested. Wire it to a route that authenticates the
        user, answer 400 for a <code>TypeError</code>, and 502 for other errors.
        The result types come from{" "}
        <code>@hyodotdev/openiap-client-protocol/purchase-flow</code>.
      </p>
      <CodeBlock title="confirm-purchase.ts" language="ts">
        {confirmPurchaseSource}
      </CodeBlock>
    </DocsPage>
  );
}
