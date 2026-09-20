import CommerceImplementationComparison from '../../components/CommerceImplementationComparison';
import { Link } from 'react-router-dom';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import httpBinding from '@hyodotdev/openiap-commerce-protocol/generated/bindings/http-binding.json';
import AnchorLink from '../../components/AnchorLink';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

const EXPLANATIONS = [
  {
    name: 'providerCapabilities',
    implementation: 'capabilities',
    title: 'Check what a provider supports',
    description:
      'Before connecting, ask which services, stores, and API formats this backend supports. This public answer contains no customer purchase data.',
    result: 'Use it to choose a compatible provider before sending purchases.',
  },
  {
    name: 'verifyPurchase',
    implementation: 'verify',
    title: 'Check the purchase evidence',
    description:
      'Send the store’s evidence and receive isValid. A valid purchase is not yet connected to an app user and does not by itself grant access.',
    result: 'Alice’s receipt is valid. Next, authorize and record who owns it.',
  },
  {
    name: 'bindPurchase',
    implementation: 'bind',
    title: 'Connect the purchase to its owner',
    description:
      'Your authenticated backend selects Alice and asks the provider to associate the verified purchase with her. Repeating this request keeps the same owner.',
    result:
      'Continue on bound: true. A false result covers both unknown evidence and an ownership conflict; it never tells Bob whose purchase exists.',
  },
  {
    name: 'entitlements',
    implementation: 'access',
    title: 'Read which products the user can access',
    description:
      'Ask for Alice’s current productIds. Your backend unlocks a feature only when its product is in that list. The answer includes supporting subscription records, without purchase tokens.',
    result:
      'Premium in the list: allow Premium. Empty list: no current access. A request failure is not an empty list or a new grant.',
  },
  {
    name: 'subscriptionStatus',
    implementation: 'status',
    title: 'Read the subscription’s current status',
    description:
      'Use this for a subscription status screen or an “any active subscription?” check. It returns active and, when available, a supporting subscription record.',
    result:
      'Canceling renewal can leave active: true until expiry. For product-specific access, use entitlements.',
  },
  {
    name: 'eraseUser',
    implementation: 'erase',
    title: 'Remove the user’s identity',
    description:
      'When Alice deletes her account, ask the provider to remove her identity from its subscription records and protocol event store. Repeating the request is safe.',
    result:
      'accepted acknowledges the request. A provider may report an erasure job. Your backend and other event recipients must erase their own copies separately.',
  },
] as const;

export default function CommerceOperations(): React.JSX.Element {
  useScrollToHash(120);
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Operations"
        path="/commerce-protocol/operations"
        description="What each API call does, when to use it, and how to read its result."
      />
      <h1>Operations</h1>
      <p>
        An operation is one request your software makes to the commerce
        provider. For a purchase, the important order is{' '}
        <strong>verify → connect the owner → read access</strong>.
      </p>
      <p>
        These calls keep separate questions separate: a valid receipt, its
        owner, and today’s access can have different answers.{' '}
        <Link to="/commerce-protocol/getting-started#purchase-verify">
          Follow Alice through those steps →
        </Link>
      </p>
      <AnchorLink id="operation-table" level="h2">
        Find the call you need
      </AnchorLink>
      {EXPLANATIONS.map((entry) => {
        const operation = httpBinding.operations.find(
          (item) => item.name === entry.name
        )!;
        return (
          <article className="commerce-operation" key={entry.name}>
            <AnchorLink id={entry.name} level="h3">
              {entry.title}
            </AnchorLink>
            <p>{entry.description}</p>
            <p>{entry.result}</p>
            <CommerceImplementationComparison
              topic={entry.implementation}
              collapsed
            />
            <details>
              <summary>API details · {entry.name}</summary>
              <dl>
                <dt>Operation</dt>
                <dd>
                  <code>{operation.name}</code>
                </dd>
                <dt>REST request</dt>
                <dd>
                  <code>
                    {operation.method} {operation.path}
                  </code>
                </dd>
                <dt>Responsibility</dt>
                <dd>
                  {operation.profile === 'core' ? (
                    'Core: every provider supports discovery.'
                  ) : (
                    <Link to="/commerce-protocol/profiles">
                      <code>{operation.profile}</code> profile
                    </Link>
                  )}
                </dd>
                <dt>Credential</dt>
                <dd>
                  <Link to="/commerce-protocol/authentication">
                    {operation.auth === 'none'
                      ? 'None: public discovery'
                      : `${operation.auth} role`}
                  </Link>
                </dd>
              </dl>
            </details>
          </article>
        );
      })}
      <p>
        The same operation meanings apply over{' '}
        <Link to="/commerce-protocol/rest">REST</Link> and{' '}
        <Link to="/commerce-protocol/graphql">GraphQL</Link>. Repeated requests
        are idempotent: they do not repeat the business effect. Providers must
        report an error when they cannot produce a complete answer.
      </p>
      <p>
        Exact inputs, outputs, and behavior:{' '}
        <a href={`${COMMERCE_PROTOCOL_LINKS.spec}#4-operations`}>SPEC.md §4</a>.
      </p>
    </div>
  );
}
