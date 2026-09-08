import { useEffect, useRef, useState } from 'react';
import { Link, useNavigationType } from 'react-router-dom';
import CodeBlock from './CodeBlock';
import CommerceImplementationComparison from './CommerceImplementationComparison';
import { COMMERCE_PROTOCOL_LINKS } from '../lib/config';

const RECORDING = '/commerce-example';
const IMPLEMENTATION_TOPICS = [
  'capabilities',
  'verify',
  'bind',
  'status',
  'events',
  'access',
  'erase',
] as const;

interface Milestone {
  step: number;
  title: string;
  built: string;
  result: string;
  screenshot: string;
  checks: string[];
  responses: unknown[];
  build: {
    label: string;
    request: string;
    change: string;
    review: string;
    report: string;
    passed: number;
  };
}

interface RecordedRun {
  recordedAt: string;
  checks: string[];
  milestones: Milestone[];
  standalone: { version: string; passed: number };
}

function CommerceBuildWalkthrough({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (step: number) => void;
}): React.JSX.Element {
  const [run, setRun] = useState<RecordedRun | null>(null);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const navigationType = useNavigationType();
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${RECORDING}/run.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Recording unavailable');
        return response.json() as Promise<RecordedRun>;
      })
      .then(setRun)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const selectedIndex =
    run?.milestones.findIndex((milestone) => milestone.step === selected) ?? -1;
  const resolvedIndex = selectedIndex < 0 ? 0 : selectedIndex;
  const step = run?.milestones[resolvedIndex];

  useEffect(() => {
    if (!step) return;
    const frame = requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      tabsRef.current?.scrollIntoView({
        block: 'start',
        behavior:
          navigationType === 'POP' ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, navigationType]);

  if (!run) {
    return (
      <p role="status">
        {failed
          ? 'The recording could not be loaded. '
          : 'Loading the recorded build…'}
        {failed && (
          <a href={`${RECORDING}/run.json`}>Open the execution report</a>
        )}
      </p>
    );
  }
  if (!step) return <p role="status">No recorded checkpoints are available.</p>;

  return (
    <div className="commerce-walkthrough">
      <p>
        See what happens to one subscription in{' '}
        <a href={COMMERCE_PROTOCOL_LINKS.example}>
          openiap-commerce-protocol-example
        </a>
        . Follow the purchase, access, and delivery results in its recorded
        dashboard.
      </p>
      <div
        ref={tabsRef}
        className="language-tabs-header commerce-build-tabs"
        role="group"
        aria-label="Recorded build milestones"
      >
        {run.milestones.map((milestone) => (
          <button
            key={milestone.step}
            type="button"
            className={`language-tab ${milestone.step === step.step ? 'active' : ''}`}
            aria-current={milestone.step === step.step ? 'step' : undefined}
            aria-controls="commerce-build-result"
            onClick={() => onSelect(milestone.step)}
          >
            {milestone.step}. {milestone.build.label}
          </button>
        ))}
      </div>
      <div
        key={step.step}
        id="commerce-build-result"
        className="commerce-build-result"
      >
        <div className="commerce-build-caption" aria-live="polite">
          <div>
            <h3 ref={headingRef} id={`build-step-${step.step}`} tabIndex={-1}>
              {step.title}
            </h3>
            <p>{step.result}</p>
          </div>
          <div className="commerce-step-controls">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={resolvedIndex === 0}
              onClick={() => onSelect(run.milestones[resolvedIndex - 1].step)}
              aria-label="Previous milestone"
            >
              ←
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={resolvedIndex === run.milestones.length - 1}
              onClick={() => onSelect(run.milestones[resolvedIndex + 1].step)}
              aria-label="Next milestone"
            >
              →
            </button>
          </div>
        </div>
        <a
          className="commerce-capture-link no-icon"
          href={`${RECORDING}/${step.screenshot}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open full-size capture: ${step.title}`}
        >
          <img
            src={`${RECORDING}/${step.screenshot}`}
            alt={`Running source checkpoint ${step.step}: ${step.result}`}
            loading="lazy"
          />
        </a>
        <CommerceImplementationComparison
          topic={IMPLEMENTATION_TOPICS[resolvedIndex] ?? 'checks'}
          collapsed
        />
        <details key={`review-${step.step}`} className="commerce-run-details">
          <summary>Implementation and review details</summary>
          <p>
            <strong>AI task:</strong> {step.build.request}
          </p>
          <p>
            <strong>Changed:</strong> {step.build.change}
          </p>
          <p>
            <strong>Reviewed and rechecked:</strong> {step.build.review}
          </p>
          <p>
            {step.built} · {step.build.passed} checks passed.{' '}
            <a href={`${RECORDING}/REVIEW.md`}>Review and correction log</a>
          </p>
        </details>
        <details key={`results-${step.step}`} className="commerce-run-details">
          <summary>Inspect this step’s checks and actual responses</summary>
          <ul>
            {step.checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
          <CodeBlock language="json">
            {JSON.stringify(step.responses, null, 2)}
          </CodeBlock>
          <a href={`${RECORDING}/${step.build.report}`}>
            Full execution report
          </a>
        </details>
      </div>
      <p className="commerce-capture-note">
        Recorded {run.recordedAt.slice(0, 10)} · {run.checks.length} checks in
        the completed example · openiap-commerce-protocol@
        {run.standalone.version}. HTTP, SQLite, and signatures run locally; the
        store and clock are fixtures.
      </p>
      <p>
        <Link to="/commerce-protocol/implementation#build-brief">
          Build this into your product with AI →
        </Link>
      </p>
    </div>
  );
}

export default CommerceBuildWalkthrough;
