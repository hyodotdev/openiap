import CommerceImplementationComparison from '../../components/CommerceImplementationComparison';
import type { CommerceImplementationTopic } from '../../lib/commerceImplementations';
import { Link } from 'react-router-dom';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import httpBinding from 'openiap-commerce-protocol/generated/bindings/http-binding.json';
import AnchorLink from '../../components/AnchorLink';
import SEO from '../../components/SEO';

const PROFILES: Record<
  string,
  {
    question: string;
    explanation: string;
    example: string;
    implementation: CommerceImplementationTopic;
  }
> = {
  verification: {
    implementation: 'verify',
    question: 'Is the store evidence valid?',
    explanation:
      'Checks a store purchase without assigning it to an app account.',
    example:
      'A verification service can specialize in checking purchases while another service owns user access.',
  },
  accountLifecycle: {
    implementation: 'erase',
    question: 'Whose purchase is it?',
    explanation:
      'Connects purchases to your users and removes their identity when requested. Both binding and erasure are required.',
    example:
      'Alice owns her purchase. Bob cannot take it. Deleting Alice also removes her identity from the provider’s records.',
  },
  entitlements: {
    implementation: 'access',
    question: 'What can this user use now?',
    explanation:
      'Returns current subscription status and allowed products without exposing purchase tokens.',
    example:
      'Alice keeps Premium after turning renewal off and loses access at the end of her paid time.',
  },
  events: {
    implementation: 'events',
    question: 'How does my backend hear about changes?',
    explanation:
      'Sends subscription and access changes as signed webhook messages, with retry rules.',
    example:
      'Your backend or data service receives the same event meaning regardless of which compatible provider sent it.',
  },
};

export default function CommerceProfiles(): React.JSX.Element {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Profiles"
        path="/commerce-protocol/profiles"
        description="A profile is a complete service responsibility: verification, ownership, access, or event delivery."
      />
      <h1>Profiles</h1>
      <p>
        A <strong>profile</strong> is a named set of responsibilities a provider
        promises to handle. It helps you answer “does this service do the part I
        need?”
      </p>
      <p>
        For example, a purchase-checking service may offer verification. A
        backend that also owns user access needs account lifecycle and
        entitlements. A service can offer several profiles; you do not need a
        separate company for each one.
      </p>
      <AnchorLink id="profile-table" level="h2">
        Four responsibilities
      </AnchorLink>
      {Object.entries(PROFILES).map(([name, content]) => (
        <article className="commerce-operation" key={name}>
          <h3>{content.question}</h3>
          <p>{content.explanation}</p>
          <p>{content.example}</p>
          <CommerceImplementationComparison
            topic={content.implementation}
            collapsed
          />
          <details>
            <summary>Contract name: {name}</summary>
            <p>
              Version{' '}
              <code>
                {
                  httpBinding.profiles[
                    name as keyof typeof httpBinding.profiles
                  ]
                }
              </code>
              .{' '}
              {name === 'events' ? (
                <Link to="/commerce-protocol/webhooks">
                  Event and webhook obligations
                </Link>
              ) : (
                httpBinding.operations
                  .filter((op) => op.profile === name)
                  .map((op, index) => (
                    <span key={op.name}>
                      {index > 0 && ' · '}
                      <Link to={`/commerce-protocol/operations#${op.name}`}>
                        <code>{op.name}</code>
                      </Link>
                    </span>
                  ))
              )}
            </p>
          </details>
        </article>
      ))}
      <h2>Choose by responsibility, then check the promise</h2>
      <p>
        Every provider supports basic discovery, shared errors, and version
        rules. That common foundation is called <strong>core</strong>; it is not
        another optional profile.
      </p>
      <p>
        The provider lists its complete profiles in{' '}
        <Link to="/commerce-protocol/capabilities">capabilities</Link>. An
        unfinished profile must not be advertised.{' '}
        <Link to="/commerce-protocol/conformance">Conformance checks</Link> test
        the promise against the contract.
      </p>
      <p>
        An analytics service that only receives events follows the receiver
        rules. It does not have to implement the provider’s events profile or a
        purchase backend.
      </p>
      <p>
        Full obligations and independent profile versions:{' '}
        <a href={`${COMMERCE_PROTOCOL_LINKS.spec}#3-profiles`}>SPEC.md §3</a>.
      </p>
    </div>
  );
}
