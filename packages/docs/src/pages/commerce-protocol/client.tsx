import httpBinding from '@hyodotdev/openiap-commerce-protocol/generated/bindings/http-binding.json';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';

interface EvidenceRow {
  store: string;
  evidence: ReactNode;
  from: ReactNode;
}

// Evidence members from specs/commerce-protocol/schema/05-operations.graphql;
// sources from the client Purchase type (specs/client/src/type*.graphql).
const VERIFY_PATH = httpBinding.operations.find(
  (operation) => operation.name === 'verifyPurchase'
)!.path;

const EVIDENCE_ROWS: EvidenceRow[] = [
  {
    store: 'apple',
    evidence: <code>apple.jws</code>,
    from: (
      <>
        <code>purchase.purchaseToken</code> (the JWS on iOS)
      </>
    ),
  },
  {
    store: 'google',
    evidence: <code>google.purchaseToken</code>,
    from: <code>purchase.purchaseToken</code>,
  },
  {
    store: 'amazon',
    evidence: (
      <>
        <code>amazon.receiptId</code>, <code>amazon.userId</code>,{' '}
        <code>amazon.sandbox</code>
      </>
    ),
    from: (
      <>
        <code>purchase.purchaseToken</code>, <code>purchase.userIdAmazon</code>,
        and whether the build is an App Tester build
      </>
    ),
  },
  {
    store: 'horizon',
    evidence: (
      <>
        <code>horizon.sku</code>, <code>horizon.userId</code>
      </>
    ),
    from: (
      <>
        <code>purchase.productId</code>, and the Meta app-scoped user id from
        the Platform SDK (<code>Purchase</code> does not carry it)
      </>
    ),
  },
];

function CommerceClient() {
  useScrollToHash(120);

  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol From Your App"
        description="What an app sends to its backend, how each store's purchase fields map to Commerce Protocol evidence, and why the backend, not the app, calls the protocol."
        path="/commerce-protocol/client"
        keywords="OpenIAP Commerce Protocol client, purchase evidence, verifyPurchase, app backend"
      />
      <h1>From your app</h1>
      <p>
        <strong>
          Your backend calls the Commerce Protocol; the app sends it the
          purchase.
        </strong>{' '}
        The OpenIAP client libraries run the purchase and hand you the store's
        evidence. Send that evidence to your authenticated backend, which calls
        a provider's <code>verifyPurchase</code> and decides access.
      </p>

      <AnchorLink id="evidence" level="h2">
        Map a purchase to evidence
      </AnchorLink>
      <p>
        <code>verifyPurchase</code> takes the purchase's <code>store</code> (the
        same value as <code>purchase.store</code>) and one evidence member for
        that store:
      </p>
      <DataTable
        rows={EVIDENCE_ROWS}
        rowKey={(row) => row.store}
        columns={[
          { header: 'store', cell: (row) => <code>{row.store}</code> },
          { header: 'Evidence', cell: (row) => row.evidence },
          { header: 'From the client', cell: (row) => row.from },
        ]}
      />
      <p>
        Keep the store's user identifiers separate from your own account id.
        Only your backend chooses the <code>userId</code> it binds a purchase
        to.
      </p>

      <AnchorLink id="backend-call" level="h2">
        Call the provider from your backend
      </AnchorLink>
      <p>
        The provider documents its base URL and issues the credential. A
        verification-role credential may ship in an app, but calling from your
        backend keeps the access decision there.
      </p>
      <CodeBlock language="typescript">{`// On your backend, after the app posts a Google Play purchase token
const response = await fetch(\`\${PROVIDER_BASE_URL}${VERIFY_PATH}\`, {
  method: 'POST',
  headers: {
    authorization: \`Bearer \${PROVIDER_CREDENTIAL}\`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ store: 'google', google: { purchaseToken } }),
});
// A failed call is not an invalid purchase: keep it unfinished and retry later.
if (!response.ok) throw new Error(\`verifyPurchase failed: \${response.status}\`);
const verdict = await response.json();
// { store, isValid, state, productId?, environment? }: require isValid and the
// expected productId, then bind the purchase and read entitlements.`}</CodeBlock>
      <p>
        Verification is not an access grant: bind the purchase under your
        ownership policy, read current entitlements, and grant durably before
        the app finishes the store transaction. The{' '}
        <Link to="/commerce-protocol/getting-started">Call a provider</Link>{' '}
        guide walks through all three calls.
      </p>

      <AnchorLink id="without-a-backend" level="h3">
        Without a backend
      </AnchorLink>
      <p>
        An app with no backend may call <code>verifyPurchase</code> itself: the
        specification lets a verification-role credential ship in an app. Accept
        on <code>isValid</code> together with the store and the{' '}
        <code>productId</code> you expected; <code>state</code> is advisory.
        Binding and entitlement reads need the server role, which never ships in
        an app, so the app cannot link the purchase to a user or read access
        from the provider.
      </p>

      <AnchorLink id="verify-purchase-with-provider" level="h2">
        What verifyPurchaseWithProvider is
      </AnchorLink>
      <p>
        The client API <code>verifyPurchaseWithProvider</code> calls IAPKit's
        own verification API, not the Commerce Protocol. Changing its provider
        name or base URL does not turn it into a generic protocol client. To use
        another provider, call the protocol from your backend as shown above.
      </p>
      <p>
        The example repository's <code>client-bridge.mjs</code> runs on an app
        backend and maps Apple, Google, Amazon, and Horizon purchase fields into
        verification input. Run <code>npm run demo:bridge</code> in the{' '}
        <a href={COMMERCE_PROTOCOL_LINKS.example}>example repository</a> to
        check the request boundary; it does not make a live store purchase.
      </p>
    </div>
  );
}

export default CommerceClient;
