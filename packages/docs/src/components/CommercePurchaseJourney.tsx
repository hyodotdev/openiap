import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  Server,
  Smartphone,
  Store,
  UserRound,
} from 'lucide-react';
import CommerceImplementationComparison from './CommerceImplementationComparison';

const STEPS = [
  {
    id: 'buy',
    label: 'Buy',
    title: 'Alice chooses Premium.',
    description:
      'Your paywall—the screen offering Premium—shows the offer. Your app uses OpenIAP’s client SDK to open the store’s purchase screen. Apple or Google takes the payment and returns purchase evidence: a signed transaction or purchase token.',
    nodes: [
      { kind: 'app', title: 'Your app', detail: 'Alice chooses Premium' },
      { kind: 'store', title: 'Apple / Google', detail: 'Handles the payment' },
      { kind: 'app', title: 'Your app', detail: 'Receives purchase evidence' },
    ],
    result: 'Payment returned. Premium is still locked.',
    unlocked: false,
    reason:
      'The app sends the evidence to your backend using Alice’s signed-in session. A pending, canceled, or failed purchase creates no new access.',
    term: 'Purchase evidence',
    definition:
      'The store’s record of the purchase. It is something the backend can check; it is not proof of which app account owns it.',
    reference: '/commerce-protocol/operations#verifyPurchase',
    referenceLabel: 'How verification works',
  },
  {
    id: 'verify',
    label: 'Verify',
    title: 'Check the purchase with the store.',
    description:
      'Your backend asks the commerce provider to check the evidence. The provider is the service responsible for purchase verification and access records. It can be IAPKit, another compatible service, or a backend you run.',
    nodes: [
      { kind: 'server', title: 'Your backend', detail: 'Sends the evidence' },
      {
        kind: 'server',
        title: 'Commerce provider',
        detail: 'Checks with the store',
      },
      {
        kind: 'check',
        title: 'Valid purchase',
        detail: 'No user attached yet',
      },
    ],
    result: 'The purchase is valid. Premium is still locked.',
    unlocked: false,
    reason:
      'A successful check answers “is this evidence valid?” It does not decide who gets access. If verification is unavailable, retry according to your policy; an outage is not a new purchase or a revocation.',
    term: 'Verification',
    definition:
      'Checking store evidence. The API call is verifyPurchase; its isValid result is separate from the user’s access.',
    reference: '/commerce-protocol/operations#verifyPurchase',
    referenceLabel: 'Verification reference',
  },
  {
    id: 'bind',
    label: 'Connect the user',
    title: 'This purchase belongs to Alice.',
    description:
      'Your backend knows who signed in and checks whether that person may claim the purchase. It asks the provider to associate the verified purchase with Alice’s account. This association is called binding.',
    nodes: [
      {
        kind: 'user',
        title: 'Alice’s session',
        detail: 'Identified by your backend',
      },
      {
        kind: 'server',
        title: 'Commerce provider',
        detail: 'Connects purchase to Alice',
      },
      { kind: 'user', title: 'Alice’s account', detail: 'Ownership recorded' },
    ],
    result: 'Alice owns the purchase. Now read her access.',
    unlocked: false,
    reason:
      'Bob cannot take the same purchase by submitting Alice’s receipt. A failed binding stops this attempt. Repeating Alice’s successful request leaves the same owner in place.',
    term: 'Authentication',
    definition:
      'Your app login identifies Alice. A separate server credential lets your backend call the provider. The provider credential never replaces your app’s login.',
    reference: '/commerce-protocol/authentication',
    referenceLabel: 'Who may make each request',
  },
  {
    id: 'access',
    label: 'Open Premium',
    title: 'Ask what Alice can use now.',
    description:
      'Your backend reads Alice’s current entitlements: the products she is allowed to use. If Premium is in that answer, your backend lets her open the paid content. It records fulfillment before the app finishes the store transaction.',
    nodes: [
      {
        kind: 'server',
        title: 'Commerce provider',
        detail: 'Returns current access',
      },
      {
        kind: 'server',
        title: 'Your backend',
        detail: 'Allows the Premium feature',
      },
      { kind: 'app', title: 'Alice’s app', detail: 'Opens paid content' },
    ],
    result: 'Alice can use Premium.',
    unlocked: true,
    reason:
      'Access is a current answer, not a permanent flag. An empty product list grants nothing. Respect expiry and freshness when caching; a failed read is not a successful access decision.',
    term: 'Entitlements',
    definition:
      'What this user may access now. Subscription status explains the subscription; entitlements answer which products it currently unlocks.',
    reference: '/commerce-protocol/operations#entitlements',
    referenceLabel: 'Access reference',
  },
  {
    id: 'changes',
    label: 'Keep it current',
    title: 'Cancellation keeps the paid time.',
    description:
      'Alice turns off renewal. She keeps Premium until the end of her paid period. When that deadline arrives, access ends—even if a store notification is late. Your backend reads the current answer when it needs to authorize her.',
    nodes: [
      {
        kind: 'store',
        title: 'Apple / Google',
        detail: 'Reports subscription changes',
      },
      {
        kind: 'server',
        title: 'Commerce provider',
        detail: 'Updates the subscription',
      },
      {
        kind: 'server',
        title: 'Your backend',
        detail: 'Receives a signed event',
      },
    ],
    result: 'Renewal off → Premium stays open → expiry locks it.',
    unlocked: false,
    reason:
      'Events travel between servers. Your receiver checks the signature and saves each event once before acknowledging it. Retries must not repeat fulfillment.',
    term: 'Webhook',
    definition:
      'An HTTP message the provider sends to your backend when something changes. A signature lets your backend check who sent it and whether it was altered.',
    reference: '/commerce-protocol/webhooks',
    referenceLabel: 'Events and delivery reference',
  },
  {
    id: 'erase',
    label: 'Delete the account',
    title: 'Alice deletes her account.',
    description:
      'Your backend disables Alice’s session and removes her saved event copies. It then asks every commerce provider holding her records to erase her identity. The example completes this in SQLite; IAPKit completes a queued job in Convex.',
    nodes: [
      { kind: 'user', title: 'Alice’s account', detail: 'Session disabled' },
      {
        kind: 'server',
        title: 'Your backend',
        detail: 'Erases delivered copies',
      },
      {
        kind: 'server',
        title: 'Commerce provider',
        detail: 'Erases account identity',
      },
    ],
    result: 'Identity removed. Old requests cannot restore the account.',
    unlocked: false,
    reason:
      'Keep unfinished deletion requests until the provider confirms completion. Your receiver must discard late events for the deleted account, including after restart. This removes account identity; it does not cancel the store subscription.',
    term: 'Account erasure',
    definition:
      'Removing the link to the app user from provider records and copies held by your services. An accepted job can still be queued; wait for completed before considering provider cleanup finished.',
    reference: '/commerce-protocol/operations#eraseUser',
    referenceLabel: 'Erasure reference',
  },
] as const;

const ICONS = {
  app: Smartphone,
  store: Store,
  server: Server,
  user: UserRound,
  check: Check,
};

export default function CommercePurchaseJourney(): React.JSX.Element {
  const { hash, search } = useLocation();
  const requestedStore = new URLSearchParams(search).get('store');
  const store =
    requestedStore === 'amazon' ||
    requestedStore === 'horizon' ||
    requestedStore === 'google'
      ? requestedStore
      : 'apple';
  const storeLabel = {
    apple: 'Apple',
    google: 'Google Play',
    amazon: 'Amazon',
    horizon: 'Meta Horizon',
  }[store];
  const recheck = store === 'amazon' || store === 'horizon';
  const steps = STEPS.map((entry) => {
    if (entry.id === 'buy')
      return {
        ...entry,
        description: `Alice chooses Premium on your paywall. Your app opens ${storeLabel}’s purchase screen through its OpenIAP client library. A successful purchase gives your backend the evidence it needs to ask the store for verification.`,
        nodes: entry.nodes.map((node) =>
          node.kind === 'store' ? { ...node, title: storeLabel } : node
        ),
        reason: recheck
          ? 'Send the result through Alice’s signed-in session. Your backend must also verify that her store account belongs to that session. An app user ID and a store user ID are different identities.'
          : entry.reason,
      };
    if (entry.id === 'changes' && recheck)
      return {
        ...entry,
        title: 'Check whether Alice still owns Premium.',
        description: `Your backend requests Alice’s entitlements. IAPKit asks ${storeLabel} again using the saved store identity and purchase evidence. A negative answer removes Premium from the result. A store outage fails the request so your app can apply its retry policy.`,
        nodes: [
          {
            kind: 'server' as const,
            title: 'Your backend',
            detail: 'Requests current access',
          },
          {
            kind: 'server' as const,
            title: 'IAPKit',
            detail: 'Rechecks saved purchases',
          },
          {
            kind: 'store' as const,
            title: storeLabel,
            detail: 'Returns current ownership',
          },
        ],
        result:
          'Confirmed ownership → Premium. Rejected ownership → no access.',
        reason:
          'IAPKit does not currently emit Amazon or Horizon subscription lifecycle events. Use entitlements.productIds for access; an empty subscriptions list does not mean that no product is owned. Do not infer renewal, refund, or expiry dates from a verification verdict.',
        term: 'Current ownership',
        definition:
          'A store answer at the time of the check. Your backend owns caching and retry policy. Consumable credits need a separate durable fulfillment ledger; an owned SKU is not a quantity to credit repeatedly.',
        reference: '/commerce-protocol/operations#entitlements',
        referenceLabel: 'Access reference',
      };
    if (entry.id === 'changes')
      return {
        ...entry,
        nodes: entry.nodes.map((node) =>
          node.kind === 'store' ? { ...node, title: storeLabel } : node
        ),
      };
    return entry;
  });
  const selected = Math.max(
    0,
    steps.findIndex((step) => hash === `#purchase-${step.id}`)
  );
  const step = steps[selected];
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(selected);

  useEffect(() => {
    if (previous.current !== selected && hash.startsWith('#purchase-')) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest('.commerce-journey')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    }
    previous.current = selected;
  }, [selected, hash]);

  return (
    <section className="commerce-journey" aria-label="Follow Alice’s purchase">
      <nav
        className="language-tabs-header commerce-store-selector"
        aria-label="Choose your store"
      >
        {(['apple', 'google', 'amazon', 'horizon'] as const).map((id) => (
          <Link
            key={id}
            to={{ search: `?store=${id}`, hash }}
            className={`language-tab ${store === id ? 'active' : ''}`}
            aria-current={store === id ? 'true' : undefined}
          >
            {
              {
                apple: 'Apple',
                google: 'Google Play',
                amazon: 'Amazon',
                horizon: 'Meta Horizon',
              }[id]
            }
          </Link>
        ))}
      </nav>
      {recheck && (
        <p className="commerce-store-context">
          {store === 'horizon'
            ? 'For Quest, link the Meta user to your app session before binding the verified SKU. IAPKit keeps the Meta app secret on the server.'
            : 'For Amazon, keep the store user and receipt together. App Tester uses sandbox evidence; production receipts use the production RVS environment.'}{' '}
          <Link
            to={`/docs/setup/store/${store === 'horizon' ? 'horizon' : 'amazon'}`}
          >
            Store setup →
          </Link>
        </p>
      )}
      {typeof window === 'undefined' && (
        <noscript>
          <style>{`.commerce-journey-steps, .commerce-journey-content, .commerce-journey-controls { display: none; }`}</style>
          <p>
            Read the purchase flow in order below. Enable JavaScript to use the
            step navigator.
          </p>
          {steps.map((entry, index) => (
            <section key={entry.id}>
              <h2>
                {index + 1}. {entry.title}
              </h2>
              <p>{entry.description}</p>
              <p>
                <strong>{entry.result}</strong> {entry.reason}
              </p>
              <p>
                <strong>{entry.term}:</strong> {entry.definition}
              </p>
              <CommerceImplementationComparison
                topic={entry.id === 'changes' ? 'events' : entry.id}
              />
              <Link to={entry.reference}>{entry.referenceLabel}</Link>
            </section>
          ))}
        </noscript>
      )}
      <nav className="commerce-journey-steps" aria-label="Purchase steps">
        {steps.map((entry, index) => (
          <Link
            key={entry.id}
            id={`purchase-${entry.id}`}
            to={{ search, hash: `#purchase-${entry.id}` }}
            state={{ commerceKeepScroll: true }}
            aria-current={index === selected ? 'step' : undefined}
          >
            <span>{index + 1}</span>
            {entry.label}
          </Link>
        ))}
      </nav>
      <div className="commerce-journey-content" key={`${store}-${step.id}`}>
        <div className="commerce-journey-heading">
          <span>
            Step {selected + 1} of {STEPS.length}
          </span>
          <h2 ref={heading} tabIndex={-1}>
            {step.title}
          </h2>
          <p>{step.description}</p>
        </div>
        <figure
          className="commerce-journey-map"
          aria-label={step.nodes
            .map((node) => `${node.title}: ${node.detail}`)
            .join(' → ')}
        >
          {step.nodes.map((node, index) => {
            const Icon = ICONS[node.kind];
            return (
              <div className="commerce-journey-node" key={node.title + index}>
                <Icon size={24} aria-hidden="true" />
                <strong>{node.title}</strong>
                <span>{node.detail}</span>
                {index < step.nodes.length - 1 && (
                  <ArrowRight
                    className="commerce-journey-arrow"
                    size={20}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </figure>
        <div className="commerce-journey-result">
          {step.unlocked ? (
            <Check size={20} aria-hidden="true" />
          ) : (
            <LockKeyhole size={20} aria-hidden="true" />
          )}
          <strong>{step.result}</strong>
        </div>
        <p>{step.reason}</p>
        <aside className="commerce-journey-term">
          <strong>{step.term}</strong>
          <p>{step.definition}</p>
          <Link to={step.reference}>{step.referenceLabel} →</Link>
        </aside>
        <CommerceImplementationComparison
          topic={
            recheck && step.id === 'bind'
              ? 'storeBind'
              : recheck && (step.id === 'access' || step.id === 'changes')
                ? 'storeAccess'
                : step.id === 'changes'
                  ? 'events'
                  : step.id
          }
        />
      </div>
      <div className="commerce-journey-controls">
        {selected > 0 ? (
          <Link
            className="btn btn-secondary"
            to={{ search, hash: `#purchase-${steps[selected - 1].id}` }}
            state={{ commerceKeepScroll: true }}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Previous
          </Link>
        ) : (
          <span />
        )}
        {selected < STEPS.length - 1 ? (
          <Link
            className="btn btn-primary"
            to={{ search, hash: `#purchase-${steps[selected + 1].id}` }}
            state={{ commerceKeepScroll: true }}
          >
            Next: {STEPS[selected + 1].label}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <Link
            className="btn btn-primary"
            to={{ pathname: '/commerce-protocol/implementation', search }}
          >
            Build this for your app
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
