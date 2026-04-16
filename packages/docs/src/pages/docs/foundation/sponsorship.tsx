import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { Link } from 'react-router-dom';

function Sponsorship() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Sponsorship"
        description="Why sponsor OpenIAP — reduce your IAP integration costs, support vendor-neutral purchase interoperability, and gain visibility across the ecosystem."
        path="/docs/foundation/sponsorship"
        keywords="OpenIAP sponsorship, open source funding, IAP sponsor, founding supporter"
      />
      <h1>Sponsorship</h1>
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderLeft: '3px solid var(--primary-color)',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
        }}
      >
        <strong>Draft</strong> — The Foundation section is currently being
        prepared. Content may change as the governance structure is finalized.
      </div>
      <p>
        OpenIAP is the open interoperability standard for in-app purchases. Your
        sponsorship directly funds the infrastructure, security, and
        documentation that the entire mobile and game ecosystem depends on.
      </p>

      <section>
        <AnchorLink id="why-sponsor" level="h2">
          Why Sponsor OpenIAP
        </AnchorLink>
        <p>
          This isn't about supporting "a nice open-source project." Sponsoring
          OpenIAP <strong>reduces your company's costs and risks</strong>:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Benefit</th>
              <th>What It Means for You</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Reduced bus factor</strong>
              </td>
              <td>
                Multiple maintainers and a governance structure ensure the
                project doesn't depend on one person
              </td>
            </tr>
            <tr>
              <td>
                <strong>Interoperability standard</strong>
              </td>
              <td>
                One specification across iOS, Android, and emerging platforms —
                less integration work for your team
              </td>
            </tr>
            <tr>
              <td>
                <strong>Conformance and test matrix</strong>
              </td>
              <td>
                Cross-platform tests catch regressions before they hit your
                production apps
              </td>
            </tr>
            <tr>
              <td>
                <strong>Security verification profiles</strong>
              </td>
              <td>
                Industry-standard receipt validation and fraud prevention
                patterns you don't have to build yourself
              </td>
            </tr>
            <tr>
              <td>
                <strong>Documentation and onboarding</strong>
              </td>
              <td>
                Better docs means your developers ship faster with fewer support
                tickets
              </td>
            </tr>
            <tr>
              <td>
                <strong>Release stability</strong>
              </td>
              <td>
                Funded testing and CI/CD infrastructure means fewer breaking
                changes
              </td>
            </tr>
            <tr>
              <td>
                <strong>Platform policy response</strong>
              </td>
              <td>
                When Apple or Google change billing APIs, we update the spec so
                you don't scramble
              </td>
            </tr>
            <tr>
              <td>
                <strong>Ecosystem trust</strong>
              </td>
              <td>
                Neutral governance gives all parties confidence to adopt and
                contribute
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="tiers" level="h2">
          Sponsorship Tiers
        </AnchorLink>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginTop: '1.5rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '2rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3
              style={{
                color: '#cd7f32',
                marginBottom: '0.5rem',
                fontSize: '1.2rem',
              }}
            >
              Bronze
            </h3>
            <p
              style={{
                color: 'var(--primary-color)',
                fontWeight: '600',
                fontSize: '1.5rem',
                marginBottom: '1rem',
              }}
            >
              $100/month
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <li>Logo on project README</li>
              <li>Listed on sponsors page</li>
              <li>Community supporter badge</li>
            </ul>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '2rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3
              style={{
                color: '#C0C0C0',
                marginBottom: '0.5rem',
                fontSize: '1.2rem',
              }}
            >
              Silver
            </h3>
            <p
              style={{
                color: 'var(--primary-color)',
                fontWeight: '600',
                fontSize: '1.5rem',
                marginBottom: '1rem',
              }}
            >
              $300/month
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <li>Everything in Bronze</li>
              <li>Logo featured in README with link</li>
              <li>Quarterly progress report</li>
            </ul>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '2rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3
              style={{
                color: '#FFD700',
                marginBottom: '0.5rem',
                fontSize: '1.2rem',
              }}
            >
              Gold
            </h3>
            <p
              style={{
                color: 'var(--primary-color)',
                fontWeight: '600',
                fontSize: '1.5rem',
                marginBottom: '1rem',
              }}
            >
              $500/month
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <li>Everything in Silver</li>
              <li>Large logo across all repositories</li>
              <li>Priority issue triage</li>
              <li>Monthly maintainer sync call</li>
            </ul>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '2rem',
              borderRadius: '0.75rem',
              border: '2px solid var(--primary-color)',
            }}
          >
            <h3
              style={{
                color: 'var(--primary-color)',
                marginBottom: '0.5rem',
                fontSize: '1.2rem',
              }}
            >
              Founding Supporter
            </h3>
            <p
              style={{
                color: 'var(--primary-color)',
                fontWeight: '600',
                fontSize: '1.5rem',
                marginBottom: '1rem',
              }}
            >
              $999/month
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <li>Everything in Gold</li>
              <li>Named as Founding Supporter permanently</li>
              <li>Advisory Board seat (when formed)</li>
              <li>Input on roadmap priorities</li>
              <li>Featured case study on website</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="what-funding-supports" level="h2">
          What Your Funding Supports
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>Activities</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Specification Development</strong>
              </td>
              <td>
                GraphQL schema evolution, IR codegen plugins, new platform
                bindings
              </td>
            </tr>
            <tr>
              <td>
                <strong>Security</strong>
              </td>
              <td>
                Verification profiles, receipt validation patterns, audit-ready
                schemas
              </td>
            </tr>
            <tr>
              <td>
                <strong>Testing Infrastructure</strong>
              </td>
              <td>
                Conformance tests, CI/CD pipelines, cross-platform test matrix
              </td>
            </tr>
            <tr>
              <td>
                <strong>Documentation</strong>
              </td>
              <td>
                API docs, migration guides, tutorials, AI assistant context
              </td>
            </tr>
            <tr>
              <td>
                <strong>Community</strong>
              </td>
              <td>
                Contributor onboarding, mentorship programs, conference presence
              </td>
            </tr>
            <tr>
              <td>
                <strong>Operations</strong>
              </td>
              <td>Hosting, domain, CI compute, release management</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="security-narrative" level="h2">
          The Security Value
        </AnchorLink>
        <p>
          OpenIAP is more than developer experience — it's purchase
          infrastructure with a security layer:
        </p>
        <ul>
          <li>
            <strong>Purchase verification profiles</strong> — standardized
            server-side validation
          </li>
          <li>
            <strong>Receipt validation best practices</strong> — cross-platform
            guidance to prevent manipulation
          </li>
          <li>
            <strong>Transaction integrity</strong> — audit-friendly schemas with
            structured logging
          </li>
          <li>
            <strong>Secure provider interoperability</strong> — safe handoffs
            between stores and apps
          </li>
          <li>
            <strong>Fraud reduction</strong> — shared patterns to detect and
            prevent purchase fraud
          </li>
        </ul>
        <p>
          By building security into the standard itself, every library in the
          OpenIAP ecosystem inherits these protections — reducing risk for the
          entire community.
        </p>
      </section>

      <section>
        <AnchorLink id="current-sponsors" level="h2">
          Current Sponsors
        </AnchorLink>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '2rem',
            background: 'var(--bg-secondary)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
          }}
        >
          <a
            href="https://meta.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <img
              src="/meta.svg"
              alt="Meta"
              style={{ height: '48px', objectFit: 'contain' }}
            />
            <img
              src="/meta-txt.svg"
              alt="Meta"
              style={{
                height: '48px',
                objectFit: 'contain',
                filter: 'var(--logo-text-filter, none)',
              }}
            />
          </a>
          <span style={{ color: 'var(--text-secondary)' }}>
            Founding Sponsor
          </span>
        </div>
      </section>

      <section>
        <AnchorLink id="get-started" level="h2">
          Get Started
        </AnchorLink>
        <p>
          Interested in sponsoring OpenIAP? We'd love to discuss how your
          organization can benefit.
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <a href="mailto:hyo@hyo.dev" className="btn btn-primary">
            Contact Us
          </a>
          <Link
            to="/docs/foundation/founding-supporters"
            className="btn btn-secondary"
          >
            Become a Founding Supporter
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Sponsorship;
