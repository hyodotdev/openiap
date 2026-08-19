import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function AiAssistantsPage() {
  return (
    <DocsPage
      slug="ai-assistants"
      title="AI assistants"
      description="Point Claude, Cursor, and other LLM-powered tools at IAPKit's llms.txt so they can answer IAPKit questions without crawling this site."
    >
      <p>
        IAPKit publishes two AI-friendly reference files that follow the{" "}
        <a
          href="https://llmstxt.org/"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          llmstxt.org
        </a>{" "}
        convention. Both are plain text, served from the same origin as the
        docs, and maintained alongside material changes to the API surface.
      </p>

      <div className="my-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">File</th>
              <th className="px-3 py-2 text-left font-medium">Purpose</th>
              <th className="px-3 py-2 text-left font-medium">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-2">
                <a
                  href="/llms.txt"
                  className="font-mono text-xs text-primary underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  /llms.txt
                </a>
              </td>
              <td className="px-3 py-2">
                Scannable quick reference: auth, endpoints, request shapes,
                response headers, status codes, docs link map.
              </td>
              <td className="px-3 py-2 text-muted-foreground">~14 KB</td>
            </tr>
            <tr>
              <td className="px-3 py-2">
                <a
                  href="/llms-full.txt"
                  className="font-mono text-xs text-primary underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  /llms-full.txt
                </a>
              </td>
              <td className="px-3 py-2">
                Exhaustive reference: architecture, authentication, full state
                table, error body shape, structured log line, retry policy,
                Sentry config, Convex data model, deployment.
              </td>
              <td className="px-3 py-2 text-muted-foreground">~25 KB</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Callout kind="tip" title="Cheaper than crawling the repo">
        <p>
          IAPKit is open source, but pointing an assistant at the monorepo costs
          a lot of tokens to answer a one-line API question. Serving a condensed
          reference as plain text at a stable URL lets any LLM-powered editor
          (Claude Code, Cursor, Zed, Continue, etc.) that supports URL loaders
          pull accurate context in one fetch.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Codex & Claude Code plugins
      </h2>
      <p>
        Codex and Claude Code can use IAPKit as an MCP-backed plugin through{" "}
        <code>https://kit.openiap.dev/mcp</code>. The plugin uses your IAPKit
        secret admin key, not the app&apos;s publishable key and not an OpenAI,
        ChatGPT, Anthropic, or Claude API key. See the{" "}
        <Link
          to="/docs/ai-assistants/codex-plugin"
          className="text-primary underline"
        >
          Codex plugin guide
        </Link>{" "}
        or the{" "}
        <Link
          to="/docs/ai-assistants/claude-plugin"
          className="text-primary underline"
        >
          Claude Code plugin guide
        </Link>{" "}
        for the IAPKit endpoint and key details.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Using the files</h2>

      <h3 className="mt-6 text-lg font-semibold">From a prompt</h3>
      <p>
        Paste the URL into the assistant's context / attachment panel and ask
        your question. Most tools treat it as a system-level knowledge
        attachment rather than inline user input:
      </p>
      <CodeBlock language="text">
        {`Use https://kit.openiap.dev/llms-full.txt as reference.

Question: What status codes does /v1/purchase/verify return, and
when does it carry a Retry-After header?`}
      </CodeBlock>

      <h3 className="mt-6 text-lg font-semibold">
        From a curl pipeline (one-shot)
      </h3>
      <CodeBlock language="bash">
        {`# Pipe the full reference into a local model or script.
curl -s https://kit.openiap.dev/llms-full.txt | \\
  your-llm-cli --system-from-stdin`}
      </CodeBlock>

      <h3 className="mt-6 text-lg font-semibold">
        In an agent's knowledge base
      </h3>
      <p>
        If your assistant supports external knowledge sources (Claude projects,
        Cursor rules, OpenAI Assistants retrieval, LangChain / LlamaIndex
        document loaders), register{" "}
        <code>https://kit.openiap.dev/llms.txt</code> for routine questions and{" "}
        <code>https://kit.openiap.dev/llms-full.txt</code> when the agent needs
        to reason about data model or operational behavior. Both files are
        content-typed <code>text/plain</code>, so standard URL loaders work
        without a custom parser.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Freshness</h2>
      <p>
        Both files are versioned summaries maintained with the canonical API
        routes, Convex schema, and docs in the OpenIAP monorepo. If a summary
        conflicts with those sources, the canonical implementation and docs take
        precedence; please{" "}
        <a
          href="mailto:hyo@hyo.dev"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          report any drift
        </a>{" "}
        and we'll land a fix.
      </p>

      <Callout kind="note" title="Scope">
        <p>
          These files document the <em>public</em> API surface and operational
          guarantees of IAPKit. They don't include private implementation
          details (specific Fly.io region, internal Convex function names beyond
          what the docs already expose, secret rotation cadence, etc.). Assume
          anything outside the published docs is not guaranteed to be stable.
        </p>
      </Callout>
    </DocsPage>
  );
}
