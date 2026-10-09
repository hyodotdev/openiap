import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import Accordion from './Accordion';
import CodeBlock from './CodeBlock';
import { SHOWCASE_GUIDE_URL } from './ShowcaseCards';

export default function ShowcaseSubmissionGuide(): ReactElement {
  return (
    <section
      id="submit"
      className="showcase-submission-guide"
      aria-labelledby="showcase-submit-title"
    >
      <h2 id="showcase-submit-title">Add your app with AI</h2>
      <p>
        Ask your assistant to find your app details and submit them for review.
      </p>
      <Accordion title="Copy a prompt for your AI">
        <CodeBlock language="text">{`Submit my app to the OpenIAP showcase via https://www.openiap.dev/mcp.
Help connect MCP if needed. Use this project or an app link I share to find app details, the icon, store links and OpenIAP/IAPKit usage.
Ask only for missing details. Confirm my contact email, ownership and listing consent before submitting.
Submit for review and give me the receipt ID.`}</CodeBlock>
        <p className="showcase-submission-note">
          Some assistants require you to add the MCP server or restart first. No
          IAPKit API key is needed.
        </p>
      </Accordion>
      <p>
        Apps appear after approval. Submissions stay private, and your email is
        never published.
      </p>
      <p className="showcase-submission-links">
        <a href={SHOWCASE_GUIDE_URL} target="_blank" rel="noreferrer">
          Submission guide
        </a>
        <a href="mailto:hyo@hyo.dev?subject=OpenIAP%20Showcase%20Request">
          Email us
        </a>
        <Link to="/showcase/admin">Maintainer review</Link>
      </p>
    </section>
  );
}
