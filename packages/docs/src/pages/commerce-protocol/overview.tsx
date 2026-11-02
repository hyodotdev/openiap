import { useCallback, useEffect } from 'react';
import {
  Link,
  NavigationType,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import SEO from '../../components/SEO';
import CommerceEcosystem from '../../components/CommerceEcosystem';
import CommerceProtocolDiagram from '../../components/CommerceProtocolDiagram';
import CommerceBuildWalkthrough from '../../components/CommerceBuildWalkthrough';
import { keepsScroll } from '../../hooks/useScrollToHash';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import '../../styles/commerce-protocol.css';

interface RolePath {
  title: string;
  body: string;
  to: string;
}

const ROLE_PATHS: RolePath[] = [
  {
    title: 'From your app',
    body: 'what the app sends and why your backend, not the app, calls the protocol',
    to: '/commerce-protocol/client',
  },
  {
    title: 'Call a provider',
    body: 'verify, bind, and read access from your backend',
    to: '/commerce-protocol/getting-started',
  },
  {
    title: 'Receive events',
    body: 'verify and store signed lifecycle events',
    to: '/commerce-protocol/webhooks',
  },
  {
    title: 'Build a provider',
    body: 'what to implement and how to check it',
    to: '/commerce-protocol/implementation',
  },
  {
    title: 'Join the ecosystem',
    body: 'roles, composition, and how to get listed',
    to: '/commerce-protocol/ecosystem',
  },
];

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
        description="The open server API for in-app purchases: a backend verifies purchases, reads access, and receives lifecycle events from any conforming provider, such as IAPKit or your own."
        path="/commerce-protocol"
      />
      <header className="commerce-hero">
        <div className="commerce-hero-topline">
          <span className="commerce-eyebrow">OpenIAP Commerce Protocol</span>
          <span className="commerce-standard-badge">Open standard</span>
        </div>
        <div className="commerce-hero-copy">
          <h1>The open server API for in-app purchases</h1>
          <p>
            OpenIAP client libraries run the purchase in your app. The Commerce
            Protocol is the open server API a backend uses to verify that
            purchase, read access, and receive lifecycle events. IAPKit is one
            service that implements it; another conforming provider or your own
            backend works the same way.
          </p>
        </div>
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
        <h3>Do I need this?</h3>
        <ul>
          <li>
            Adopt it when a server verifies purchases from more than one store
            and you want one access decision across them, written in a
            specification your provider does not own.
          </li>
          <li>
            Selling in-app purchases does not require it: the client libraries
            work with a store&apos;s own server API, your backend, or a
            verification service.
          </li>
          <li>
            It runs nothing for you. A provider, hosted or your own backend,
            implements it, and the conformance checks are a floor, not proof
            that a provider is correct.
          </li>
        </ul>
        <p>
          <Link to="#architecture">Explore the architecture</Link> ·{' '}
          <Link to="#build-step-1">See a subscription working</Link>
        </p>
      </section>
      <CommerceProtocolDiagram onShowExample={showExample} />
      <details className="commerce-explore-section">
        <summary>
          <span>Explore the wider ecosystem</span>
          <small>Paywalls, commerce services, and data platforms</small>
        </summary>
        <div className="commerce-explore-content">
          <CommerceEcosystem />
        </div>
      </details>
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
