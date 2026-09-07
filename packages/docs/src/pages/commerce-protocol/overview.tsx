import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BookOpen, Play } from 'lucide-react';
import SEO from '../../components/SEO';
import CommerceEcosystem from '../../components/CommerceEcosystem';
import CommerceProtocolDiagram from '../../components/CommerceProtocolDiagram';
import CommerceBuildWalkthrough from '../../components/CommerceBuildWalkthrough';
import { useScrollToHash } from '../../hooks/useScrollToHash';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import '../../styles/commerce-protocol.css';

function CommerceProtocol(): React.JSX.Element {
  useScrollToHash();
  const { hash } = useLocation();
  const [exampleStep, setExampleStep] = useState<number | null>(null);
  useEffect(() => {
    if (hash === '#build-walkthrough') setExampleStep(1);
  }, [hash]);
  const showExample = (step: number): void => {
    setExampleStep(step);
    requestAnimationFrame(() =>
      document
        .getElementById('build-walkthrough')
        ?.scrollIntoView({ block: 'start' })
    );
  };
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
            platforms. Bring your business to apps built with OpenIAP.
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
              <Play size={15} aria-hidden="true" /> See AI build it
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
      <CommerceEcosystem />
      <details className="commerce-explore-section">
        <summary>
          <span>Inside the commerce backend</span>
          <small>Verification, ownership, access, and delivery</small>
        </summary>
        <div className="commerce-explore-content">
          <CommerceProtocolDiagram onShowExample={showExample} />
        </div>
      </details>
      <details
        id="build-walkthrough"
        className="commerce-explore-section"
        open={exampleStep !== null}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          setExampleStep((current) => (open ? (current ?? 1) : null));
        }}
      >
        <summary>
          <span>See how AI built it</span>
          <small>Six source checkpoints · build, inspect, fix, recheck</small>
        </summary>
        {exampleStep !== null && (
          <div className="commerce-explore-content">
            <CommerceBuildWalkthrough
              selected={exampleStep}
              onSelect={setExampleStep}
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
