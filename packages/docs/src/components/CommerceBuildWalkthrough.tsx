import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CodeBlock from './CodeBlock';

const RECORDING = '/commerce-example';

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
    source: string;
    changes: string;
    report: string;
    previousSource?: string;
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
  const selectedIndex = run.milestones.findIndex(
    (milestone) => milestone.step === selected
  );
  const step = run.milestones[selectedIndex];

  return (
    <div className="commerce-walkthrough">
      <p>
        Ask AI for one feature → run it → inspect the screen and responses → fix
        what failed → repeat the check. These six source checkpoints record that
        process in a separate example project.
      </p>
      <div className="commerce-run-meta">
        <span>Recorded {run.recordedAt.slice(0, 10)}</span>
        <span>{run.checks.length} checks in the completed example</span>
        <a href={`${RECORDING}/REVIEW.md`}>Review and correction log</a>
      </div>
      <div
        className="language-tabs-header commerce-build-tabs"
        role="group"
        aria-label="Recorded build milestones"
      >
        {run.milestones.map((milestone) => (
          <button
            key={milestone.step}
            type="button"
            className={`language-tab ${milestone.step === selected ? 'active' : ''}`}
            aria-current={milestone.step === selected ? 'step' : undefined}
            aria-controls="commerce-build-result"
            onClick={() => onSelect(milestone.step)}
          >
            {milestone.step}. {milestone.build.label}
          </button>
        ))}
      </div>
      <div id="commerce-build-result" className="commerce-build-result">
        <div className="commerce-build-caption" aria-live="polite">
          <div>
            <h3>{step.title}</h3>
            <p>{step.result}</p>
            <small>
              Added: {step.built} · {step.build.passed} checks passed
            </small>
          </div>
          <div className="commerce-step-controls">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={selectedIndex === 0}
              onClick={() => onSelect(run.milestones[selectedIndex - 1].step)}
              aria-label="Previous milestone"
            >
              ←
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={selectedIndex === run.milestones.length - 1}
              onClick={() => onSelect(run.milestones[selectedIndex + 1].step)}
              aria-label="Next milestone"
            >
              →
            </button>
          </div>
        </div>
        <p>
          <strong>AI task summary:</strong> {step.build.request}
        </p>
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
        <details key={`review-${step.step}`} className="commerce-run-details">
          <summary>What AI changed, reviewed, and corrected</summary>
          <p>
            <strong>Changed:</strong> {step.build.change}
          </p>
          <p>
            <strong>Reviewed and rechecked:</strong> {step.build.review}
          </p>
          <p>
            Extract this checkpoint into an empty folder, install dependencies
            with your favorite package manager, and run its test and start
            scripts. This example uses Bun; the protocol does not require it.
          </p>
          {step.build.previousSource && (
            <p>
              This reviewed revision’s patch starts from the{' '}
              <a href={`${RECORDING}/${step.build.previousSource}`} download>
                preceding source revision
              </a>
              .
            </p>
          )}
          <div className="commerce-actions">
            <a
              className="btn btn-secondary"
              href={`${RECORDING}/${step.build.source}`}
              download
            >
              Run this source checkpoint ↓
            </a>
            <a
              className="btn btn-secondary"
              href={`${RECORDING}/${step.build.changes}`}
              download
            >
              Code changes ↓
            </a>
          </div>
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
          <a href={`${RECORDING}/${step.build.report}`} download>
            Recorded AI task and full report ↓
          </a>
        </details>
      </div>
      <p className="commerce-capture-note">
        Each screenshot runs that step’s saved source. This incremental example
        uses published openiap-commerce-protocol@{run.standalone.version}. HTTP,
        SQLite, and signatures run locally; the store and clock are fixtures.{' '}
        <Link to="/commerce-protocol/implementation#iapkit">
          Compare its scope with IAPKit
        </Link>
        .
      </p>
    </div>
  );
}

export default CommerceBuildWalkthrough;
