import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import DataTable from '../../../components/DataTable';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

interface Study {
  name: string;
  href: string;
  finding: string;
  applied: ReactNode;
}

interface StudyGroup {
  id: string;
  title: string;
  studies: Study[];
}

const STUDY_GROUPS: StudyGroup[] = [
  {
    id: 'payment-security',
    title: 'Payment security',
    studies: [
      {
        name: 'VirtualSwindle — Mulliner, Robertson, Kirda. AsiaCCS 2014',
        href: 'https://www.mulliner.org/collin/publications/virtualswindle_asiaccs2014_mulliner.pdf',
        finding:
          'The first automated attack on Android in-app billing cracked 60% of 85 popular apps that trusted client-side purchase state.',
        applied: (
          <>
            The server-side verification requirement in{' '}
            <Link to="/docs/features/validation">Validation</Link>, and the
            conformance MUST behavior{' '}
            <code>verification.forged-token-is-invalid</code>.
          </>
        ),
      },
      {
        name: 'Show Me the Money! — Yang et al. NDSS 2017',
        href: 'https://www.ndss-symposium.org/wp-content/uploads/2017/09/ndss2017_05A-2_Yang_paper.pdf',
        finding:
          'Payment vulnerabilities trace back to payment SDK design, ambiguous documentation, and vulnerable sample code rather than app code.',
        applied: (
          <>
            The reason OpenIAP exists as one audited specification with
            consistent SDKs and a{' '}
            <Link to="/docs/security/compliance#conformance">
              conformance suite
            </Link>
            , instead of per-store integrations.
          </>
        ),
      },
    ],
  },
  {
    id: 'conformance-testing',
    title: 'Conformance and differential testing',
    studies: [
      {
        name: 'Frankencerts — Brubaker et al. IEEE S&P 2014',
        href: 'https://www.cs.columbia.edu/~suman/docs/frankencert.pdf',
        finding:
          'When several implementations of one specification disagree on the same input, the disagreement itself is a bug oracle — 8.1M mutated inputs exposed 208 discrepancies in SSL/TLS validation.',
        applied: (
          <>
            The differential mode of the conformance runner, which runs adapters
            side by side and reports divergences. Ships as{' '}
            <code>openiap-conformance/differential</code> with suite 3.0.0.
          </>
        ),
      },
      {
        name: 'Parsing JSON is a Minefield — Seriot, 2016',
        href: 'https://seriot.ch/security/parsing_json.html',
        finding:
          'No two of 34 JSON parsers behave identically; whatever a specification leaves loose, implementations will diverge on.',
        applied: (
          <>
            The versioned behavior registry: each behavior pins down semantics
            the GraphQL schema alone cannot, so six SDKs cannot drift apart
            silently.
          </>
        ),
      },
      {
        name: 'Metamorphic Testing — Chen et al. ACM Computing Surveys 2018',
        href: 'https://dl.acm.org/doi/10.1145/3143561',
        finding:
          'Systems without a predictable expected output are verified through relations between executions instead of exact outputs.',
        applied: (
          <>
            The metamorphic relation registry used to verify live store behavior
            — for example, a purchased item must appear in a following restore.
            Ships as <code>openiap-conformance/metamorphic</code> with suite
            3.0.0.
          </>
        ),
      },
    ],
  },
  {
    id: 'versioning',
    title: 'Versioning and API evolution',
    studies: [
      {
        name: 'Raemaekers, van Deursen, Visser. Journal of Systems and Software 2017',
        href: 'https://dl.acm.org/doi/10.1016/j.jss.2016.04.008',
        finding:
          'About one third of releases across 22,000 Maven libraries introduce breaking changes regardless of their version label.',
        applied: (
          <>
            The schema semver guard: CI diffs the GraphQL schema on every pull
            request and fails on any breaking change that has not been
            explicitly acknowledged as release-planned.
          </>
        ),
      },
      {
        name: 'Breaking Bad? — Ochoa et al. Empirical Software Engineering 2022',
        href: 'https://dl.acm.org/doi/10.1007/s10664-021-10052-y',
        finding:
          '20.1% of non-major upgrades in Maven Central contain breaking changes.',
        applied: (
          <>
            The same guard, plus the version floor policy in{' '}
            <code>openiap-versions.json</code> that release audits enforce.
          </>
        ),
      },
      {
        name: 'Why and How Java Developers Break APIs — Brito et al. SANER 2018',
        href: 'https://arxiv.org/abs/1801.05198',
        finding:
          'Breaking changes are mostly deliberate — new features, simplification, maintainability — so detection cannot rely on author intent.',
        applied: (
          <>
            Mechanical, review-independent detection: the guard runs on every
            schema change, not only on releases someone marked as risky.
          </>
        ),
      },
    ],
  },
  {
    id: 'learnability-misuse',
    title: 'API learnability and misuse',
    studies: [
      {
        name: 'What Makes APIs Hard to Learn? — Robillard. IEEE Software 2009',
        href: 'https://www.cs.mcgill.ca/~martin/papers/software2009a.pdf',
        finding:
          'Across 440+ professional developers, documentation is the dominant obstacle to learning an API.',
        applied: (
          <>
            The reader-first standard every OpenIAP doc follows, and the
            issue-mining pipeline that collects nine years of failure reports
            across the six SDK ecosystems as the evidence base for
            troubleshooting docs.
          </>
        ),
      },
      {
        name: 'MUBench — Amann et al. MSR 2016',
        href: 'https://dl.acm.org/doi/10.1145/2901739.2903506',
        finding:
          'API misuse is a rare but disproportionately severe bug class — misuses almost always cause crashes, data loss, or security issues.',
        applied: (
          <>
            The{' '}
            <a
              href="https://github.com/hyodotdev/openiap/blob/main/knowledge/research/misuse-catalog.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              IAP misuse catalog
            </a>{' '}
            — patterns like granting entitlement from unverified local state or
            skipping{' '}
            <Link to="/docs/apis/finish-transaction">finishTransaction</Link> —
            mapped, where a mechanical check exists, to the conformance behavior
            that detects it.
          </>
        ),
      },
    ],
  },
  {
    id: 'supply-chain',
    title: 'Supply chain',
    studies: [
      {
        name: 'Small World with High Risks — Zimmermann et al. USENIX Security 2019',
        href: 'https://www.usenix.org/conference/usenixsecurity19/presentation/zimmerman',
        finding:
          'A small number of packages or compromised maintainer accounts can reach most of an ecosystem; unmaintained packages ship known vulnerabilities for years.',
        applied: (
          <>
            The published SBOM, provenance, dependency snapshot, and Scorecard
            posture described in{' '}
            <Link to="/docs/security/overview">Supply Chain Security</Link>.
          </>
        ),
      },
    ],
  },
  {
    id: 'ai-agents',
    title: 'AI agents and MCP',
    studies: [
      {
        name: 'MCP at First Glance — Hasan et al. 2025',
        href: 'https://arxiv.org/abs/2506.13538',
        finding:
          'The first large-scale study of 1,899 open-source MCP servers measured recurring security and maintainability failures.',
        applied: (
          <>
            The threat-model review of the hosted IAPKit MCP server, kept next
            to the server code and re-run when tools or auth change.
          </>
        ),
      },
      {
        name: 'MCP: Landscape, Security Threats — Hou et al. ACM TOSEM 2025',
        href: 'https://arxiv.org/abs/2503.23278',
        finding:
          'Decomposes the MCP server lifecycle into four phases with a threat model per phase.',
        applied: (
          <>
            The structure that same review follows: creation, deployment,
            operation, and maintenance are audited as separate tables.
          </>
        ),
      },
    ],
  },
];

function Research() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Research Foundations"
        description="The peer-reviewed research behind OpenIAP's design — payment security, conformance testing, versioning, and supply-chain decisions, each mapped to where the project applies it."
        path="/docs/foundation/research"
        keywords="OpenIAP research, in-app purchase security research, receipt validation research, conformance testing, differential testing, semantic versioning study"
      />
      <h1>Research Foundations</h1>
      <p>
        This page lists the studies behind OpenIAP&apos;s guarantees: what each
        one showed, and where the project applies it. Inline citations across
        the docs link back to these sources.
      </p>

      {STUDY_GROUPS.map((group) => (
        <section key={group.id}>
          <AnchorLink id={group.id} level="h2">
            {group.title}
          </AnchorLink>
          <DataTable
            rows={group.studies}
            rowKey={(row) => row.name}
            columns={[
              {
                header: 'Study',
                cell: (row) => (
                  <a href={row.href} target="_blank" rel="noopener noreferrer">
                    {row.name}
                  </a>
                ),
              },
              { header: 'What it showed', cell: (row) => row.finding },
              {
                header: 'Where OpenIAP applies it',
                cell: (row) => row.applied,
              },
            ]}
          />
        </section>
      ))}

      <section>
        <AnchorLink id="registry" level="h2">
          The full registry
        </AnchorLink>
        <p>
          The annotated bibliography — including the engineering backlog items
          derived from each study — lives in the repository:{' '}
          <a
            href="https://github.com/hyodotdev/openiap/blob/main/knowledge/research/bibliography.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            knowledge/research
          </a>
          . Every entry records where it is applied, and code derived from a
          study cites it back by key.
        </p>
      </section>
    </div>
  );
}

export default Research;
