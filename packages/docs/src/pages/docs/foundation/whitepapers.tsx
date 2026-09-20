import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import { Link } from 'react-router-dom';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

import { WHITEPAPERS } from '../../../lib/whitepapers';

function Whitepapers() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Whitepapers"
        description="OpenIAP whitepapers — the reasoning behind the specification's design decisions, published as citable PDFs."
        path="/docs/foundation/whitepapers"
        keywords="OpenIAP whitepaper, commerce protocol, in-app purchase specification, design rationale"
      />
      <h1>Whitepapers</h1>
      <p>
        Longer-form documents that explain the reasoning behind OpenIAP’s
        design, published as PDFs so they can be read and cited outside the
        repository. Each states its own scope and what it does not establish.
        The <Link to="/commerce-protocol">specification</Link> remains
        authoritative for normative wording.
      </p>

      {WHITEPAPERS.map((paper) => (
        <section key={paper.id}>
          <AnchorLink id={paper.id} level="h2">
            {paper.title}
          </AnchorLink>
          <p>
            Version {paper.version} · {paper.date} ·{' '}
            <a href={paper.href} target="_blank" rel="noopener noreferrer">
              read the PDF
            </a>{' '}
            ·{' '}
            <a href={paper.source} target="_blank" rel="noopener noreferrer">
              Markdown source
            </a>
          </p>
          <p>{paper.summary}</p>
          <p>
            <em>{paper.scope}</em>
          </p>
        </section>
      ))}

      <section>
        <AnchorLink id="related" level="h2">
          Related reading
        </AnchorLink>
        <p>
          The studies these documents draw on, and the engineering backlog
          derived from them, are catalogued under{' '}
          <Link to="/docs/foundation/research">Research Foundations</Link>.
        </p>
      </section>
    </div>
  );
}

export default Whitepapers;
