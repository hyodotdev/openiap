import build from '../../public/commerce-example/fresh-build.json';
import AnchorLink from './AnchorLink';
import CodeBlock from './CodeBlock';

const source = `${build.repository}/blob/${build.sourceCommit}`;

export default function CommerceFreshBuild() {
  return (
    <section className="commerce-fresh-build">
      <AnchorLink id="fresh-commerce-build" level="h3">
        From an empty folder to a working backend
      </AnchorLink>
      <p>
        The CLI printed a brief. AI then wrote and tested this purchase backend
        in seven commits. Follow the{' '}
        <a href={`${source}/evidence/ai-input.md`}>actual input</a>,{' '}
        <a href={`${build.repository}/tree/${build.sourceCommit}`}>
          finished code
        </a>
        , and results below.
      </p>
      <figure>
        <a href="/commerce-example/fresh-screen.jpg">
          <img
            src="/commerce-example/fresh-screen.jpg"
            alt="Actual example run: Alice keeps Premium after canceling renewal, and the receiver has saved two events."
            loading="lazy"
            width="1265"
            height="712"
          />
        </a>
        <figcaption>
          Verified → connected to Alice → renewal canceled → events delivered.
          Premium stays open for the time she paid for.
        </figcaption>
      </figure>
      <p className="commerce-fresh-verification">
        <a href={`${source}/evidence/08-tested-final.json`}>
          {build.verification.tests} tests passed, including{' '}
          {build.verification.portableCases} REST conformance cases
        </a>{' '}
        with fictional purchases and real local HTTP, SQLite, and signatures.
      </p>
      <details>
        <summary>Try the finished build</summary>
        <p>
          Install Bun and Node.js/npm. Run this in a new folder’s parent
          directory:
        </p>
        <CodeBlock language="bash">{`git clone --branch ${build.branch} --single-branch ${build.repository}.git
cd openiap-commerce-protocol-example
git checkout ${build.sourceCommit}
npm ci
npm test
npm start`}</CodeBlock>
        <p>
          Open <code>http://127.0.0.1:5196</code>. Click <strong>Verify</strong>
          , then <strong>Connect</strong>: Alice gets Premium. Cancel renewal to
          keep it; move past expiry to lock it. Select Bob and try claiming
          Alice’s purchase: he stays locked.
        </p>
        <p>
          Each button shows its HTTP request and response. Restarting preserves
          the database; a fresh checkout starts empty.{' '}
          <a href="/commerce-example/from-scratch.md">Full run instructions</a>{' '}
          ·{' '}
          <a href="/commerce-example/fresh-source.tar.gz">
            Download this source
          </a>{' '}
          ·{' '}
          <a href="/commerce-example/fresh-public-replay.json">
            Verified from a fresh GitHub clone
          </a>
        </p>
      </details>
      <details>
        <summary>
          Follow the build: initial commit + seven working steps
        </summary>
        <p>
          Each row points to the code and evidence saved at that moment. All
          eight commits also passed a{' '}
          <a href={`${source}/evidence/history-replay.json`}>
            separate clean-checkout replay
          </a>
          .
        </p>
        <table className="commerce-outcome-table commerce-fresh-commits">
          <thead>
            <tr>
              <th>What AI added</th>
              <th>What worked</th>
              <th>Evidence at that commit</th>
            </tr>
          </thead>
          <tbody>
            {build.milestones.map((step) => (
              <tr key={step.commit}>
                <th scope="row">
                  {step.step}. {step.title}
                </th>
                <td>{step.result}</td>
                <td>
                  <a href={`${build.repository}/tree/${step.commit}`}>Code</a> ·{' '}
                  <a href={`${build.repository}/commit/${step.commit}`}>Diff</a>{' '}
                  ·{' '}
                  <a
                    href={`${build.repository}/blob/${step.commit}/${step.report}`}
                  >
                    Run
                  </a>
                  {step.screen && (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        href={`${build.repository}/blob/${step.commit}/${step.screen}`}
                      >
                        Screen
                      </a>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <details>
        <summary>
          What was tested, what failed, and what this does not prove
        </summary>
        <p>
          The{' '}
          <a href={`${source}/evidence/07-first-conformance.json`}>
            first conformance run failed
          </a>
          . Its source patch and subsequent correction are preserved. The final
          suite exercises ownership, expiry, redelivery, process restart, and
          erasure. Deliberately breaking the{' '}
          <a href={`${source}/evidence/negative-ownership-guard.json`}>
            ownership guard
          </a>{' '}
          or{' '}
          <a href={`${source}/evidence/negative-expiry-boundary.json`}>
            expiry boundary
          </a>{' '}
          makes the tests fail.
        </p>
        <p>
          This was an iterative AI build with prior conversation context. The
          old example runtime was not copied. It does not prove that one prompt
          always works, or verify real store purchases, native SDK checkout,
          external product integrations, or production events.{' '}
          <a href={`${source}/evidence/comparison.md`}>
            Scope and IAPKit comparison
          </a>
        </p>
      </details>
    </section>
  );
}
