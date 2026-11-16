import { useCallback, useEffect } from 'react';
import {
  Link,
  NavigationType,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import httpBinding from '@hyodotdev/openiap-commerce-protocol/generated/bindings/http-binding.json';
import verifyRequest from '@hyodotdev/openiap-commerce-protocol/examples/verify-purchase-request.json';
import verifyResult from '@hyodotdev/openiap-commerce-protocol/examples/verify-purchase-result.json';
import CodeBlock from '../../components/CodeBlock';
import SEO from '../../components/SEO';
import CommerceEcosystem from '../../components/CommerceEcosystem';
import CommerceProtocolDiagram from '../../components/CommerceProtocolDiagram';
import CommerceBuildWalkthrough from '../../components/CommerceBuildWalkthrough';
import { keepsScroll } from '../../hooks/useScrollToHash';
import { COMMERCE_PROTOCOL_LINKS, IAPKIT_URL } from '../../lib/config';
import '../../styles/commerce-protocol.css';

interface RolePath {
  title: string;
  body: string;
  to: string;
}

// The sidebar lists every guide; the landing page links the three common starts.
const ROLE_PATHS: RolePath[] = [
  {
    title: 'From your app',
    body: 'what the app sends to your backend',
    to: '/commerce-protocol/client',
  },
  {
    title: 'Call a provider',
    body: 'verify, bind, and read access from your backend',
    to: '/commerce-protocol/getting-started',
  },
  {
    title: 'Receive events',
    body: 'verify and store signed renewal, refund, and revocation events',
    to: '/commerce-protocol/webhooks',
  },
];

const VERIFY = httpBinding.operations.find(
  (operation) => operation.name === 'verifyPurchase'
)!;

// The JWS is shortened; Call a provider shows the request for each store.
const VERIFY_REQUEST = {
  ...verifyRequest,
  apple: { jws: `${verifyRequest.apple.jws.slice(0, 10)}…` },
};

const VERIFY_EXAMPLE = `// Request
${JSON.stringify(VERIFY_REQUEST, null, 2)}

// Response
${JSON.stringify(verifyResult, null, 2)}`;

function CommerceProtocol(): React.JSX.Element {
  const location = useLocation();
  const { hash } = location;
  const keepScroll = keepsScroll(location.state);
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const stepMatch = /^#build-step-([1-9]\d*)$/.exec(hash);
  const requestedStep = stepMatch ? Number(stepMatch[1]) : null;
  const exampleStep =
    requestedStep !== null && Number.isSafeInteger(requestedStep)
      ? requestedStep
      : hash === '#build-walkthrough'
        ? 1
        : null;
  const showExample = useCallback(
    (step: number): void => {
      void navigate(`#build-step-${step}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (
      !hash ||
      hash.startsWith('#architecture-') ||
      keepScroll ||
      exampleStep !== null
    )
      return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1));
      target?.scrollIntoView({
        block: 'start',
        behavior:
          navigationType === NavigationType.Pop ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, keepScroll, exampleStep, navigationType]);
  return (
    <div className="doc-page commerce-protocol-page commerce-overview">
      <SEO
        title="OpenIAP Commerce Protocol"
        description="One server API for purchases across stores: a backend verifies purchases, reads access, and receives signed lifecycle events from any conforming provider, such as IAPKit or your own."
        path="/commerce-protocol"
      />
      <header className="commerce-hero">
        <div className="commerce-hero-topline">
          <span className="commerce-eyebrow">OpenIAP Commerce Protocol</span>
          <span className="commerce-standard-badge">Open standard</span>
        </div>
        <div className="commerce-hero-body">
          <div className="commerce-hero-copy">
            <h1>One server API for purchases across stores</h1>
            <p>
              Each store verifies purchases and reports subscription changes in
              its own format. The Commerce Protocol gives your backend one
              verify call, one way to read access, and one signed event format
              for all of them, instead of separate integrations with the App
              Store Server API, Google Play Developer API, Amazon Receipt
              Verification Service, and Meta Horizon&apos;s server API.
            </p>
            <Link className="commerce-hero-cta" to="#build-step-1">
              See a subscription in action
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="commerce-hero-example">
            <p>
              <code>
                {VERIFY.method} {VERIFY.path}
              </code>
              <span>
                Same call and result shape for each supported store; only the
                evidence changes.
              </span>
            </p>
            <CodeBlock language="json">{VERIFY_EXAMPLE}</CodeBlock>
          </div>
        </div>
        <p className="commerce-hero-provider">
          <a href={IAPKIT_URL}>IAPKit</a>, which OpenIAP runs, is the reference
          implementation today. Use it hosted, host it yourself, or implement
          the protocol in your own backend and check it with the{' '}
          <Link to="/commerce-protocol/conformance">conformance runner</Link>.
          The checks are a floor, not proof that a provider is correct. Compare{' '}
          <Link to="/commerce-protocol/capabilities">
            capability descriptors
          </Link>{' '}
          for the stores and profiles you need.
        </p>
        <div className="commerce-hero-footer">
          <span>Your infrastructure. Your partners. No central account.</span>
          <Link to="/commerce-protocol/whitepaper">
            <BookOpen size={15} aria-hidden="true" /> Read the whitepaper
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <section aria-labelledby="commerce-start">
        <h2 id="commerce-start">Start from your role</h2>
        <ul>
          {ROLE_PATHS.map((path) => (
            <li key={path.to}>
              <Link to={path.to}>{path.title}</Link>: {path.body}
            </li>
          ))}
        </ul>
        <h3>When it helps</h3>
        <ul>
          <li>
            Your server verifies purchases from more than one store and needs
            one access decision across them.
          </li>
          <li>
            You want that contract in a specification your provider does not
            own, so you can switch providers or run your own.
          </li>
        </ul>
        <p>
          It is optional: the client libraries also work with a store&apos;s own
          server API, your backend, or another verification service.
        </p>
      </section>
      <CommerceProtocolDiagram onShowExample={showExample} />
      <details
        id="build-walkthrough"
        className="commerce-explore-section"
        open={exampleStep !== null}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          if (open && exampleStep === null) showExample(1);
          if (!open && exampleStep !== null)
            void navigate('#architecture', {
              replace: true,
              state: { commerceKeepScroll: true },
            });
        }}
      >
        <summary>
          <span>See a subscription in action</span>
          <small>Purchase, access, cancellation, and recovery</small>
        </summary>
        {exampleStep !== null && (
          <div className="commerce-explore-content">
            <CommerceBuildWalkthrough
              selected={exampleStep}
              onSelect={showExample}
            />
          </div>
        )}
      </details>
      <details className="commerce-explore-section">
        <summary>
          <span>Explore the wider ecosystem</span>
          <small>Paywalls, commerce services, and data platforms</small>
        </summary>
        <div className="commerce-explore-content">
          <CommerceEcosystem />
        </div>
      </details>
      <section aria-labelledby="commerce-spec-links">
        <h2 id="commerce-spec-links">Specification</h2>
        <p>
          <Link to="/commerce-protocol/operations">Operations</Link> ·{' '}
          <Link to="/commerce-protocol/rest">REST</Link> ·{' '}
          <Link to="/commerce-protocol/graphql">GraphQL</Link> ·{' '}
          <Link to="/commerce-protocol/authentication">Authentication</Link> ·{' '}
          <Link to="/commerce-protocol/webhooks">Webhooks</Link> ·{' '}
          <Link to="/commerce-protocol/conformance">Conformance</Link>
        </p>
        <p>
          <a href={COMMERCE_PROTOCOL_LINKS.spec}>Normative specification</a> ·{' '}
          <a href="https://github.com/hyodotdev/openiap/tree/main/specs/commerce-protocol/schema">
            Authored schema
          </a>
        </p>
      </section>
    </div>
  );
}

export default CommerceProtocol;
