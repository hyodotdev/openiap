import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import CommerceProtocolDiagram from '../../../components/CommerceProtocolDiagram';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/openiap-kit/SPEC.md';
const GRAPHQL_VIEW_URL =
  'https://github.com/hyodotdev/openiap/tree/main/specs/openiap-kit/schema';

interface Principle {
  symbol: string;
  title: string;
  description: string;
}

const PRINCIPLES: Principle[] = [
  {
    symbol: '↗',
    title: 'One commerce contract',
    description:
      'Verify purchases, read entitlements, and receive normalized events across every store.',
  },
  {
    symbol: '⇄',
    title: 'Two transport bindings',
    description:
      'The same operations over REST or GraphQL, generated from one source.',
  },
  {
    symbol: '◌',
    title: 'Multiple backend implementations',
    description:
      'IAPKit, a managed provider, or your own backend — switch without rewriting the integration.',
  },
];

interface SectionLink {
  to: string;
  label: string;
  summary: string;
}

const SECTION_LINKS: SectionLink[] = [
  {
    to: '/docs/commerce-protocol/profiles',
    label: 'Profiles',
    summary: 'Verification, entitlements, events, account lifecycle',
  },
  {
    to: '/docs/commerce-protocol/operations',
    label: 'Operations',
    summary: 'The six portable operations and their rules',
  },
  {
    to: '/docs/commerce-protocol/rest',
    label: 'REST',
    summary: 'HTTP/JSON under /commerce/v1, with generated OpenAPI',
  },
  {
    to: '/docs/commerce-protocol/graphql',
    label: 'GraphQL',
    summary: 'One endpoint serving the generated schema projection',
  },
  {
    to: '/docs/webhooks',
    label: 'Events & Webhooks',
    summary: 'Signed, retried, idempotent event delivery',
  },
  {
    to: '/docs/commerce-protocol/authentication',
    label: 'Authentication',
    summary: 'Verification and server roles, fail-close trust',
  },
  {
    to: '/docs/commerce-protocol/capabilities',
    label: 'Capabilities',
    summary: 'The honest, machine-readable provider descriptor',
  },
  {
    to: '/docs/commerce-protocol/conformance',
    label: 'Conformance',
    summary: 'Certify any provider offline, on either binding',
  },
  {
    to: '/docs/commerce-protocol/versioning',
    label: 'Versioning',
    summary: 'MAJOR.MINOR rules callers can pin on',
  },
];

function CommerceProtocol() {
  return (
    <div className="doc-page commerce-protocol-page">
      <SEO
        title="OpenIAP Commerce Protocol"
        description="The open server-side contract that turns store purchase data into portable commerce events, entitlements, and signed webhooks."
        path="/docs/commerce-protocol"
        keywords="OpenIAP Commerce Protocol, server-side IAP specification, commerce events, entitlements, signed webhooks"
      />

      <header className="commerce-hero">
        <div className="commerce-hero-copy">
          <span className="commerce-kicker">
            OpenIAP Commerce Protocol <i>1.0</i>
          </span>
          <h1>
            Every store speaks differently.
            <span>Your backend shouldn&apos;t.</span>
          </h1>
          <p>
            Verify purchases, read entitlements, and deliver normalized events
            over <Link to="/docs/commerce-protocol/rest">REST</Link>,{' '}
            <Link to="/docs/commerce-protocol/graphql">GraphQL</Link>, and{' '}
            <Link to="/docs/webhooks">signed webhooks</Link> — without coupling
            the integration to one provider.
          </p>
          <div className="commerce-hero-actions">
            <a
              className="commerce-button commerce-button--primary no-icon btn"
              href={GRAPHQL_VIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Browse the GraphQL contract
              <ExternalLink size={15} aria-hidden="true" />
            </a>
            <a
              className="commerce-button no-icon btn"
              href={SPEC_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the specification
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
          <small>Open standard · No account · No central runtime</small>
        </div>

        <CommerceProtocolDiagram />
      </header>

      <section className="commerce-principles" aria-labelledby="principles">
        <div className="commerce-section-heading">
          <span>The promise</span>
          <h2 id="principles">
            One commerce contract. Two transport bindings. Multiple backend
            implementations.
          </h2>
        </div>
        <div className="commerce-principle-grid">
          {PRINCIPLES.map((principle) => (
            <article key={principle.title}>
              <span aria-hidden="true">{principle.symbol}</span>
              <div>
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="commerce-principles" aria-labelledby="explore">
        <div className="commerce-section-heading">
          <span>Read on</span>
          <h2 id="explore">The protocol, section by section.</h2>
        </div>
        <div className="commerce-principle-grid">
          {SECTION_LINKS.map((section) => (
            <article key={section.to}>
              <div>
                <h3>
                  <Link to={section.to}>{section.label}</Link>
                </h3>
                <p>{section.summary}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default CommerceProtocol;
