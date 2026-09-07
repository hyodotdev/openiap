import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import DataTable from '../../components/DataTable';
import SEO from '../../components/SEO';
import { COMMERCE_WHITEPAPER } from '../../lib/whitepapers';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import { useScrollToHash } from '../../hooks/useScrollToHash';

interface ReadingSection {
  section: string;
  question: string;
}

const READING_SECTIONS: ReadingSection[] = [
  {
    section: '§1–2 · Problem and evidence',
    question:
      'Which integration failures motivate the design, and what evidence supports the claims?',
  },
  {
    section: '§3 · Trust and domain model',
    question:
      'Who can verify, bind, read accounts, and change access? What do verification and entitlement actually mean?',
  },
  {
    section: '§4 · Protocol design',
    question:
      'How do operations, event timing, identity, and transport bindings preserve those distinctions?',
  },
  {
    section: '§5 · Implementation blueprint',
    question:
      'Which parts does my business supply? How do purchase, access, and event processing connect, and how do I implement them?',
  },
  {
    section: '§6–7 · Limits and adoption',
    question:
      'What is still provider-specific, what do the checks establish, and when is this contract useful?',
  },
];

function CommerceWhitepaper(): React.JSX.Element {
  useScrollToHash();
  const paper = COMMERCE_WHITEPAPER;
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Whitepaper"
        path="/commerce-protocol/whitepaper"
        description="Read the Commerce Protocol design whitepaper: trust boundaries, provider architecture, storage, processing algorithms, failure recovery, and conformance limits."
      />
      <h1>Whitepaper</h1>
      <p>
        The design behind the protocol, from the questions a purchase system
        must answer to the server architecture that can answer them. Read it to
        evaluate the design or plan an implementation with your team.
      </p>
      <section>
        <AnchorLink id={paper.id} level="h2">
          {paper.title}
        </AnchorLink>
        <p>
          Version {paper.version} · {paper.date} · Protocol 1.0 · MIT License
        </p>
        <p>
          <a href={paper.href} target="_blank" rel="noopener noreferrer">
            Read the PDF ↗
          </a>{' '}
          ·{' '}
          <a href={paper.href} download>
            Download PDF
          </a>{' '}
          · <a href={paper.source}>Read the Markdown source</a>
        </p>
        <p>{paper.summary}</p>
        <p>{paper.scope}</p>
      </section>
      <section>
        <AnchorLink id="reading-map" level="h2">
          Reading map
        </AnchorLink>
        <DataTable
          rows={READING_SECTIONS}
          rowKey={(row) => row.section}
          columns={[
            { header: 'Section', cell: (row: ReadingSection) => row.section },
            {
              header: 'Question it answers',
              cell: (row: ReadingSection) => row.question,
            },
          ]}
        />
      </section>
      <section>
        <AnchorLink id="apply-the-design" level="h2">
          Put the design into practice
        </AnchorLink>
        <p>
          See the{' '}
          <Link to="/commerce-protocol#build-walkthrough">
            recorded AI-built example
          </Link>{' '}
          in six milestones, then use the{' '}
          <Link to="/commerce-protocol/implementation">AI build brief</Link> in
          your own repository. Sections 5.6–5.7 connect business roles and the
          blueprint to the captured results and their limits. The{' '}
          <a href={COMMERCE_PROTOCOL_LINKS.spec}>normative specification</a> and
          authored schema decide the contract; the paper’s database and module
          layout are design guidance.
        </p>
        <p>
          See <Link to="/docs/foundation/research">Research Foundations</Link>{' '}
          for the research registry and evaluation limits, or{' '}
          <Link to="/docs/foundation/whitepapers">all whitepapers</Link>.
        </p>
      </section>
    </div>
  );
}

export default CommerceWhitepaper;
