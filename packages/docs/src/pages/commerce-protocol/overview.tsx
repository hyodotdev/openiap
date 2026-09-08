import { useCallback, useEffect } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import { ArrowRight, BookOpen, Play } from 'lucide-react';
import SEO from '../../components/SEO';
import CommerceEcosystem from '../../components/CommerceEcosystem';
import CommerceProtocolDiagram from '../../components/CommerceProtocolDiagram';
import CommerceBuildWalkthrough from '../../components/CommerceBuildWalkthrough';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import '../../styles/commerce-protocol.css';

function CommerceProtocol(): React.JSX.Element {
  const { hash, state } = useLocation();
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
      navigate(`#build-step-${step}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (
      !hash ||
      hash.startsWith('#architecture-') ||
      state?.commerceKeepScroll ||
      exampleStep !== null
    )
      return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1));
      target?.scrollIntoView({
        block: 'start',
        behavior:
          navigationType === 'POP' ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, state, exampleStep, navigationType]);
  return (
    <div className="doc-page commerce-protocol-page commerce-overview">
      <SEO
        title="OpenIAP Commerce Protocol"
        description="Build your part of the OpenIAP ecosystem: paywalls, commerce services, or data platforms. Explore the architecture and follow a working AI-built backend."
        path="/commerce-protocol"
      />
      <header className="commerce-hero">
        <div className="commerce-hero-topline">
          <span className="commerce-eyebrow">OpenIAP Commerce Protocol</span>
          <span className="commerce-standard-badge">Open standard</span>
        </div>
        <div className="commerce-hero-copy">
          <h1>
            Build your part.
            <span>Connect the whole.</span>
          </h1>
          <p>
            A shared contract for paywalls, commerce services, and data
            platforms. Understand how the parts connect, choose what your
            product owns, and give AI the contract to implement it.
          </p>
          <div className="commerce-actions">
            <Link className="btn btn-primary" to="#architecture">
              Explore the architecture{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <button
              className="btn btn-secondary"
              onClick={() => showExample(1)}
            >
              <Play size={15} aria-hidden="true" /> See it working
            </button>
          </div>
        </div>
        <div className="commerce-hero-footer">
          <span>Your infrastructure. Your partners. No central account.</span>
          <Link to="/commerce-protocol/whitepaper">
            <BookOpen size={15} aria-hidden="true" /> Read the whitepaper
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>
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
          if (!open && exampleStep !== null) navigate('#architecture');
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
          <span>Find the specification</span>
          <small>APIs, roles, events, and conformance</small>
        </summary>
        <div className="commerce-explore-content">
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
        </div>
      </details>
    </div>
  );
}

export default CommerceProtocol;
