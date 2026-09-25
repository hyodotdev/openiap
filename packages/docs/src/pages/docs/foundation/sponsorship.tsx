import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import DataTable from '../../../components/DataTable';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import {
  CURRENT_SPONSORS,
  FUNDING_LINKS,
  SPONSOR_TIERS,
} from '../../../lib/sponsors';
import { Link } from 'react-router-dom';

const formatUsd = (usd: number): string => `$${usd.toLocaleString('en-US')}`;

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
      <Callout kind="note" title="Draft">
        The Foundation section is currently being prepared. Content may change
        as the governance structure is finalized.
      </Callout>
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
                The project has one maintainer today; sponsorship funds the
                maintainer time and governance meant to reduce that risk
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
                Shared behavioral tests run every store implementation through
                the same expectations, so normalization regressions are caught
                before they reach your production apps
              </td>
            </tr>
            <tr>
              <td>
                <strong>Verification profile</strong>
              </td>
              <td>
                A standard server-side purchase verification contract, the
                Commerce Protocol, that your backend or provider can implement
                instead of building its own
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
                When source stores change billing APIs, we update the spec so
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
        <p>
          Monthly tiers, as offered on{' '}
          <a
            href={SPONSOR_TIERS.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Sponsors
          </a>
          :
        </p>
        <DataTable
          rows={[...SPONSOR_TIERS.monthly]}
          rowKey={(row) => row.name}
          columns={[
            { header: 'Tier', cell: (row) => <strong>{row.name}</strong> },
            { header: 'Monthly', cell: (row) => formatUsd(row.usd) },
            { header: 'Includes', cell: (row) => row.includes },
          ]}
        />
        <p>
          One-time support:{' '}
          {SPONSOR_TIERS.oneTime
            .map((tier) => `${tier.name} (${formatUsd(tier.usd)})`)
            .join(', ')}
          . Sponsorship buys recognition and priority, not a service-level
          agreement or reserved engineering capacity.
        </p>
      </section>

      <section>
        <AnchorLink id="channels" level="h2">
          Sponsorship Channels
        </AnchorLink>
        <p>
          Sponsor through{' '}
          <a
            href={FUNDING_LINKS.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Sponsors
          </a>{' '}
          or{' '}
          <a
            href={FUNDING_LINKS.openCollectiveUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenCollective
          </a>
          , which offers the same monthly tiers with a public ledger. The{' '}
          <Link to="/sponsors">Sponsors page</Link> lists every channel.
        </p>
      </section>

      <section>
        <AnchorLink id="what-funding-supports" level="h2">
          What Funding Supports
        </AnchorLink>
        <p>
          The planned split of sponsorship funds is on{' '}
          <Link to="/docs/foundation/roadmap-budget#budget">
            Roadmap &amp; Budget
          </Link>
          .
        </p>
      </section>

      <section>
        <AnchorLink id="security-narrative" level="h2">
          The Security Value
        </AnchorLink>
        <p>
          Purchase verification is standardized in the Commerce Protocol{' '}
          <Link to="/commerce-protocol/profiles">verification profile</Link>,
          with <Link to="/docs/features/validation">validation guidance</Link>{' '}
          for each store. Integrity and fraud guidance is on the{' '}
          <Link to="/docs/foundation/roadmap-budget#roadmap">roadmap</Link>.
        </p>
      </section>

      <section>
        <AnchorLink id="current-sponsors" level="h2">
          Current Sponsors
        </AnchorLink>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(2rem, 8vw, 5rem)',
            padding: '2rem',
            background: 'var(--bg-secondary)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
          }}
        >
          {CURRENT_SPONSORS.map((sponsor) => {
            const Wordmark = sponsor.Wordmark;

            return (
              <a
                key={sponsor.id}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${sponsor.name}`}
                style={{
                  display: 'flex',
                  minWidth: '180px',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                <Wordmark className="foundation-sponsor-wordmark" />
                <span>{sponsor.tier}</span>
              </a>
            );
          })}
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
          <a href={FUNDING_LINKS.companyContactUrl} className="btn btn-primary">
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
