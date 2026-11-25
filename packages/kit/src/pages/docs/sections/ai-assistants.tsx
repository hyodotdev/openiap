import { Link } from "react-router-dom";

import { CONNECTOR_CHANGES, CONNECTOR_READS } from "@/lib/connectorAccess";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function AiAssistantsPage() {
  return (
    <DocsPage
      slug="ai-assistants"
      title="AI assistants"
      description="Connect Claude or ChatGPT to an IAPKit project, drive IAPKit from a coding agent, or point any LLM tool at IAPKit's llms.txt."
    >
      <h2
        id="connect-claude-or-chatgpt"
        className="mt-10 text-2xl font-semibold"
      >
        Connect Claude or ChatGPT
      </h2>
      <p>
        Add <code>https://kit.openiap.dev/mcp</code> as a connector, sign in
        with GitHub, pick one project, and approve. No key is copied. Then ask
        about the project in a chat, for example &ldquo;Which products are still
        drafts?&rdquo; or &ldquo;Why did this user&apos;s last purchase
        fail?&rdquo;
      </p>

      <h3 id="connect-claude" className="mt-8 text-xl font-semibold">
        Claude
      </h3>
      <p>
        A connector added on claude.ai also works in the Claude desktop and
        mobile apps.
      </p>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Open <strong>Plugins</strong> in the sidebar, then choose{" "}
          <strong>Add</strong> &rarr; <strong>Add custom connector</strong>.
          Name it <code>IAPKit</code>, enter{" "}
          <code>https://kit.openiap.dev/mcp</code>, and choose{" "}
          <strong>Continue</strong>.
        </li>
      </ol>
      <DocsScreenshot
        src="/docs/screenshots/connector-claude-add.webp"
        alt="Claude's Add custom connector dialog with the name IAPKit and the URL https://kit.openiap.dev/mcp"
        maxWidth={518}
      />
      <ol start={2} className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Claude detects that IAPKit signs users in with OAuth and reads
          Claude&apos;s published identity. Keep both defaults and choose{" "}
          <strong>Add</strong>.
        </li>
      </ol>
      <DocsScreenshot
        src="/docs/screenshots/connector-claude-sign-in.webp"
        alt="Claude's authentication options with Sign in now and Use Claude's published identity selected and marked Detected"
        maxWidth={518}
      />
      <ol start={3} className="my-3 list-decimal space-y-2 pl-6">
        <li>
          IAPKit opens. Sign in with GitHub, then{" "}
          <a href="#approve-the-connection" className="text-primary underline">
            approve the connection
          </a>
          .
        </li>
      </ol>

      <h3 id="connect-chatgpt" className="mt-8 text-xl font-semibold">
        ChatGPT
      </h3>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Open <strong>Plugins</strong>, choose <strong>Add</strong> (or{" "}
          <strong>+</strong>), then <strong>Add custom MCP server</strong>. If
          it is missing, turn on developer mode in ChatGPT&apos;s settings
          first.
        </li>
      </ol>
      <DocsScreenshot
        src="/docs/screenshots/connector-chatgpt-menu.webp"
        alt="ChatGPT's Plugins menu with Create plugin, Upload plugin archive and Add custom MCP server"
        maxWidth={390}
      />
      <ol start={2} className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Name it <code>IAPKit</code>, upload{" "}
          <a href="/icon-256.png" className="text-primary underline">
            the IAPKit icon
          </a>{" "}
          (ChatGPT cannot change it later), describe it as{" "}
          <code>
            kit.openiap.dev: in-app purchases, products and subscriptions
          </code>
          , enter <code>https://kit.openiap.dev/mcp</code> as the server URL,
          keep <strong>OAuth</strong>, tick{" "}
          <strong>I understand and want to continue</strong>, and choose{" "}
          <strong>Create as a plugin</strong>.
        </li>
      </ol>
      <DocsScreenshot
        src="/docs/screenshots/connector-chatgpt-server.webp"
        alt="ChatGPT's Add custom MCP server form with the IAPKit icon, the name IAPKit, a kit.openiap.dev description, the URL https://kit.openiap.dev/mcp, OAuth authentication and the risk acknowledgement ticked"
        maxWidth={370}
      />
      <ol start={3} className="my-3 list-decimal space-y-2 pl-6">
        <li>
          On the plugin&apos;s page, choose <strong>Connect</strong>. IAPKit
          opens; sign in with GitHub and{" "}
          <a href="#approve-the-connection" className="text-primary underline">
            approve the connection
          </a>
          .
        </li>
        <li>
          In a chat, mention <strong>@IAPKit</strong> and ask your question.
        </li>
      </ol>

      <h3 id="approve-the-connection" className="mt-8 text-xl font-semibold">
        Approve the connection
      </h3>
      <p>
        Choose the project and choose <strong>Connect</strong>. The connection
        reads {CONNECTOR_READS}. Tick <strong>Also allow changes</strong> to let
        it {CONNECTOR_CHANGES}.
      </p>
      <DocsScreenshot
        src="/docs/screenshots/connector-iapkit-approve.webp"
        alt="IAPKit's Connect to IAPKit page with a project selector, the read access summary and an unticked Also allow changes option"
        maxWidth={560}
      />
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Only organization owners and admins can approve, and only for a
          project in their organization.
        </li>
        <li>
          Each connection appears under <strong>Connected apps</strong> on the
          project&apos;s API keys page. <strong>Disconnect</strong> ends it at
          once; removing the member who approved it ends it too.
        </li>
        <li>
          To change access, disconnect and connect again. ChatGPT keeps the
          tools it loaded first, so choose <strong>Refresh tools</strong> in the
          plugin&apos;s settings afterwards.
        </li>
        <li>
          Deleting the plugin in ChatGPT does not end the IAPKit connection;
          disconnect it under <strong>Connected apps</strong> too.
        </li>
        <li>
          Coding agents such as Codex and Claude Code connect with a secret
          admin key instead; see the{" "}
          <Link
            to="/docs/ai-assistants/codex-plugin"
            className="text-primary underline"
          >
            Codex
          </Link>{" "}
          and{" "}
          <Link
            to="/docs/ai-assistants/claude-plugin"
            className="text-primary underline"
          >
            Claude Code
          </Link>{" "}
          plugin guides.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Use the CLI</h2>
      <p>
        Sign in once, then let your coding agent use IAPKit through commands
        with JSON results. The CLI uses IAPKit directly and keeps your existing
        organization permissions.
      </p>
      <CodeBlock language="bash">{`npx @hyodotdev/openiap kit login
npx --yes @hyodotdev/openiap kit projects list --json
npx --yes @hyodotdev/openiap kit schema keys create --json`}</CodeBlock>
      <p>
        See the{" "}
        <a href="https://github.com/hyodotdev/openiap/tree/main/packages/cli#operate-iapkit">
          CLI guide
        </a>{" "}
        for key management, store credentials, products, sync jobs, purchases,
        webhooks and scoped automation tokens.
      </p>
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
              <td className="px-3 py-2 text-muted-foreground">~18 KB</td>
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
              <td className="px-3 py-2 text-muted-foreground">~30 KB</td>
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
