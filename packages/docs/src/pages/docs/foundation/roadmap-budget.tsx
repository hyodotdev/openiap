import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function RoadmapBudget() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Roadmap & Budget"
        description="OpenIAP project roadmap and funding allocation plan — how sponsorship funds are used to build the open purchase interoperability standard."
        path="/docs/foundation/roadmap-budget"
        keywords="OpenIAP roadmap, funding plan, open source budget, IAP development roadmap"
      />
      <h1>Roadmap & Budget</h1>
      <p>
        This document outlines how OpenIAP plans to grow and how sponsorship
        funding is allocated. Full transparency on where every dollar goes.
      </p>

      <section>
        <AnchorLink id="roadmap" level="h2">
          Development Roadmap
        </AnchorLink>

        <AnchorLink id="phase-1" level="h3">
          Phase 1: Foundation (Q2–Q3 2026)
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Deliverable</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Open governance model</td>
              <td>
                Published governance document with maintainer policies and
                decision-making process
              </td>
              <td>Done</td>
            </tr>
            <tr>
              <td>Specification documentation</td>
              <td>
                Formal documentation of the GraphQL schema as the cross-platform
                purchase specification
              </td>
              <td>In Progress</td>
            </tr>
            <tr>
              <td>Purchase verification profile</td>
              <td>
                Standardized server-side receipt validation patterns for iOS and
                Android
              </td>
              <td>Planned</td>
            </tr>
            <tr>
              <td>Conformance test suite v1</td>
              <td>
                Basic cross-platform tests ensuring behavioral consistency
                across generated types
              </td>
              <td>Planned</td>
            </tr>
            <tr>
              <td>Founding supporter outreach</td>
              <td>Engage 3–5 organizations as initial supporters</td>
              <td>In Progress</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="phase-2" level="h3">
          Phase 2: Ecosystem Growth (Q4 2026–Q1 2027)
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Deliverable</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Security guidance document</td>
              <td>
                Transaction integrity best practices, fraud prevention patterns,
                audit-friendly purchase schema
              </td>
            </tr>
            <tr>
              <td>Expanded platform support</td>
              <td>
                Unity and Unreal Engine codegen plugins via the IR architecture
              </td>
            </tr>
            <tr>
              <td>Secure provider interoperability spec</td>
              <td>
                Standardized handoff protocol between stores, apps, and
                verification services
              </td>
            </tr>
            <tr>
              <td>Formal spec versioning</td>
              <td>
                Semantic versioning for the specification with migration guides
                per platform
              </td>
            </tr>
            <tr>
              <td>Open funding channel</td>
              <td>
                Transparent funding channel for individual and corporate donors
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="phase-3" level="h3">
          Phase 3: Industry Standard (Q2–Q4 2027)
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Deliverable</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Conformance certification</td>
              <td>
                Formal certification process for libraries claiming OpenIAP
                compatibility
              </td>
            </tr>
            <tr>
              <td>Third-party auditor guidelines</td>
              <td>Integration specs for verification service providers</td>
            </tr>
            <tr>
              <td>Alternative store support</td>
              <td>EU DMA compliance, alternative app store billing APIs</td>
            </tr>
            <tr>
              <td>Foundation hosting exploration</td>
              <td>
                Evaluate foundation hosting options for long-term neutral
                governance
              </td>
            </tr>
            <tr>
              <td>Mentorship program</td>
              <td>
                Structured onboarding themes for new contributors (bindings,
                tests, docs)
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="budget" level="h2">
          Budget Allocation
        </AnchorLink>
        <p>How sponsorship funds are allocated across project needs:</p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Allocation</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Maintainer Compensation</strong>
              </td>
              <td>40%</td>
              <td>
                Core maintainer time for spec development, code review,
                releases, and community management
              </td>
            </tr>
            <tr>
              <td>
                <strong>Infrastructure</strong>
              </td>
              <td>15%</td>
              <td>
                CI/CD compute (GitHub Actions), hosting (Vercel), domain
                registration, code signing certificates
              </td>
            </tr>
            <tr>
              <td>
                <strong>Security & Testing</strong>
              </td>
              <td>20%</td>
              <td>
                Conformance test infrastructure, security audits, verification
                profile development
              </td>
            </tr>
            <tr>
              <td>
                <strong>Documentation</strong>
              </td>
              <td>10%</td>
              <td>
                API documentation, migration guides, tutorials, AI context
                compilation
              </td>
            </tr>
            <tr>
              <td>
                <strong>Community & Outreach</strong>
              </td>
              <td>10%</td>
              <td>
                Contributor onboarding, mentorship programs, conference
                participation
              </td>
            </tr>
            <tr>
              <td>
                <strong>Reserve</strong>
              </td>
              <td>5%</td>
              <td>Emergency platform API changes, legal/compliance needs</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="current-costs" level="h2">
          Current Operational Costs
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Monthly Cost</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vercel hosting (docs site)</td>
              <td>$20</td>
              <td>openiap.dev</td>
            </tr>
            <tr>
              <td>Domain registration</td>
              <td>~$2</td>
              <td>openiap.dev annual amortized</td>
            </tr>
            <tr>
              <td>GitHub Actions CI/CD</td>
              <td>$0–50</td>
              <td>Variable based on PR volume</td>
            </tr>
            <tr>
              <td>Apple Developer account</td>
              <td>~$8</td>
              <td>$99/year amortized for testing</td>
            </tr>
            <tr>
              <td>Google Play Console</td>
              <td>~$2</td>
              <td>$25 one-time amortized</td>
            </tr>
            <tr>
              <td>
                <strong>Total baseline</strong>
              </td>
              <td>
                <strong>~$80/month</strong>
              </td>
              <td>Excluding maintainer time</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="funding-milestones" level="h2">
          Funding Milestones
        </AnchorLink>
        <p>What becomes possible at each funding level:</p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Monthly Funding</th>
              <th>Unlocks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>$500/mo</strong>
              </td>
              <td>
                Covers infrastructure costs + basic maintainer compensation for
                security updates
              </td>
            </tr>
            <tr>
              <td>
                <strong>$2,000/mo</strong>
              </td>
              <td>
                Part-time maintainer focus on spec development and conformance
                tests
              </td>
            </tr>
            <tr>
              <td>
                <strong>$5,000/mo</strong>
              </td>
              <td>
                Dedicated maintainer time + security audit + new platform
                bindings
              </td>
            </tr>
            <tr>
              <td>
                <strong>$10,000/mo</strong>
              </td>
              <td>
                Full-time spec development, mentorship program, conference
                presence, foundation hosting
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="transparency" level="h2">
          Transparency
        </AnchorLink>
        <p>
          OpenIAP is committed to financial transparency. As funding grows, we
          will:
        </p>
        <ul>
          <li>Publish quarterly financial reports on this page</li>
          <li>
            Disclose all sponsors and sponsorship amounts (with sponsor
            permission)
          </li>
          <li>Track spending against the budget allocation above</li>
          <li>Open the books to Advisory Board members</li>
        </ul>
      </section>
    </div>
  );
}

export default RoadmapBudget;
