import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { Link } from 'react-router-dom';

function FoundingSupporters() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Become a Founding Supporter"
        description="Join OpenIAP as a Founding Supporter — help shape the open standard for in-app purchases and gain early influence on the project's direction."
        path="/docs/foundation/founding-supporters"
        keywords="OpenIAP founding supporter, open source sponsor, IAP standard supporter"
      />
      <h1>Become a Founding Supporter</h1>
      <p>
        We're building OpenIAP into a vendor-neutral, open standard for in-app
        purchases — and we're looking for organizations to join as Founding
        Supporters. This isn't just sponsorship. It's an invitation to help
        shape the standard from day one.
      </p>

      <section>
        <AnchorLink id="what-we-are-building" level="h2">
          What We're Building
        </AnchorLink>
        <p>
          OpenIAP is transitioning from a single-maintainer library to an open
          interoperability standard with neutral governance. We need
          organizations who understand why this matters:
        </p>
        <ul>
          <li>
            A <strong>common specification</strong> for purchase types, error
            codes, and verification across iOS, Android, and emerging platforms
          </li>
          <li>
            <strong>Generated, type-safe bindings</strong> for Swift, Kotlin,
            Dart, GDScript — and more to come
          </li>
          <li>
            <strong>Security-first design</strong> with verification profiles
            and fraud prevention patterns
          </li>
          <li>
            <strong>Open governance</strong> so no single company controls the
            purchase interoperability layer
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="why-founding" level="h2">
          Why "Founding" Matters
        </AnchorLink>
        <p>
          Founding Supporters get permanent recognition and early influence that
          later sponsors won't:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Benefit</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Permanent recognition</strong>
              </td>
              <td>
                Listed as a Founding Supporter on the website, README, and all
                future governance documents — forever
              </td>
            </tr>
            <tr>
              <td>
                <strong>Advisory Board seat</strong>
              </td>
              <td>
                When the Advisory Board is formed, Founding Supporters get
                guaranteed seats with input on roadmap priorities
              </td>
            </tr>
            <tr>
              <td>
                <strong>Roadmap influence</strong>
              </td>
              <td>
                Priority input on which platforms, features, and security
                capabilities are built next
              </td>
            </tr>
            <tr>
              <td>
                <strong>Featured case study</strong>
              </td>
              <td>
                A dedicated case study on the OpenIAP website highlighting how
                your organization uses the standard
              </td>
            </tr>
            <tr>
              <td>
                <strong>Direct maintainer access</strong>
              </td>
              <td>
                Monthly sync calls with the project lead and priority issue
                triage
              </td>
            </tr>
            <tr>
              <td>
                <strong>Community voice</strong>
              </td>
              <td>
                As OpenIAP grows, Founding Supporters are recognized as the
                initial supporting organizations that helped shape the standard
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="who-should-join" level="h2">
          Who Should Join
        </AnchorLink>
        <p>
          We're looking for organizations in these areas — but we're open to
          anyone who benefits from purchase interoperability:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>App payment SDKs/infrastructure</strong>
              </td>
              <td>Companies building payment tooling for mobile apps</td>
            </tr>
            <tr>
              <td>
                <strong>Cross-platform frameworks</strong>
              </td>
              <td>React Native, Expo, Flutter, KMP ecosystem companies</td>
            </tr>
            <tr>
              <td>
                <strong>Game engines/plugins</strong>
              </td>
              <td>
                Studios or plugin authors building on Unity, Unreal, Godot
              </td>
            </tr>
            <tr>
              <td>
                <strong>Verification/fraud prevention</strong>
              </td>
              <td>Server-side receipt validation and anti-fraud services</td>
            </tr>
            <tr>
              <td>
                <strong>App publishers/studios</strong>
              </td>
              <td>Large-scale app or game publishers with IAP revenue</td>
            </tr>
            <tr>
              <td>
                <strong>Developer tooling</strong>
              </td>
              <td>
                Companies building developer tools that integrate with purchase
                APIs
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="what-we-ask" level="h2">
          What We're Asking
        </AnchorLink>
        <p>
          We're not asking for a big commitment. The first step is simply this:
        </p>
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '2rem',
            borderRadius: '0.75rem',
            border: '2px solid var(--primary-color)',
            marginTop: '1rem',
          }}
        >
          <p
            style={{
              fontSize: '1.1rem',
              lineHeight: '1.8',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            "We're taking OpenIAP from a personal repo to a{' '}
            <strong>neutral, open interoperability standard</strong>. We'd like
            your organization to be listed as an initial supporting
            organization. This signals to the broader community that the project
            has multi-stakeholder backing. There's no financial commitment
            required at this stage."
          </p>
        </div>
        <p style={{ marginTop: '1.5rem' }}>
          If you're also interested in financial sponsorship, see our{' '}
          <Link to="/docs/foundation/sponsorship">sponsorship tiers</Link>.
        </p>
      </section>

      <section>
        <AnchorLink id="timeline" level="h2">
          Timeline
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>When</th>
              <th>What Happens</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Now</strong>
              </td>
              <td>
                Reach out — we'll discuss how OpenIAP fits your organization
              </td>
            </tr>
            <tr>
              <td>
                <strong>Week 1–2</strong>
              </td>
              <td>
                Sign a lightweight letter of support (no legal obligations)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Month 1–2</strong>
              </td>
              <td>Your logo appears on the website as a Founding Supporter</td>
            </tr>
            <tr>
              <td>
                <strong>Month 3–6</strong>
              </td>
              <td>
                Advisory Board forms with Founding Supporters as initial members
              </td>
            </tr>
            <tr>
              <td>
                <strong>Month 6–12</strong>
              </td>
              <td>
                Foundation hosting exploration with your organization listed as
                a supporting entity
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="contact" level="h2">
          Get in Touch
        </AnchorLink>
        <p>Ready to join, or just want to learn more? Reach out directly:</p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginTop: '1rem',
          }}
        >
          <p>
            <strong>Hyo</strong> — Project Lead
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="mailto:hyo@hyo.dev" className="btn btn-primary">
              Email hyo@hyo.dev
            </a>
            <a
              href="https://github.com/hyodotdev/openiap"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FoundingSupporters;
