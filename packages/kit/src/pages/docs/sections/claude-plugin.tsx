import { DOCS_URL } from "../../../config/env";
import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

const MCP_SERVER_GUIDE_URL = `${DOCS_URL}/docs/guides/mcp-server`;

export default function ClaudePluginPage() {
  return (
    <DocsPage
      slug="ai-assistants/claude-plugin"
      title="OpenIAP Claude Code plugin"
      description="Connect Claude Code to IAPKit through the OpenIAP MCP server."
    >
      <p>
        The OpenIAP plugin connects Claude Code to this IAPKit project through
        the hosted <code>/mcp</code> endpoint. Use this page for the Kit-local
        endpoint and key details; use the OpenIAP MCP Server guide for the full
        installation flow, local PR testing, tool list, safety rules, and
        Example App walkthrough.
      </p>

      <Callout kind="note" title="OpenIAP MCP guide">
        <p>
          For the full setup guide, local PR testing steps, tool list, safety
          notes, and Example App walkthrough, open{" "}
          <a
            href={MCP_SERVER_GUIDE_URL}
            className="text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            /docs/guides/mcp-server
          </a>
          .
        </p>
      </Callout>

      <Callout kind="note" title="Experimental">
        <p>
          This OpenIAP plugin is experimental. The MCP endpoint, tool names, and
          setup flow are available for early testing and may continue to evolve.
        </p>
      </Callout>

      <Callout kind="note" title="Uses an IAPKit key">
        <p>
          Do not use an Anthropic or Claude API key for this plugin.
          Authentication is an IAPKit project API key sent as{" "}
          <code>Authorization: Bearer &lt;IAPKit project key&gt;</code>, read
          from the <code>IAPKIT_API_KEY</code> environment variable.
        </p>
      </Callout>

      <div
        data-testid="claude-plugin-settings"
        className="my-6 rounded-lg border border-border bg-muted/20 p-4"
      >
        <h2 className="mt-0 text-xl font-semibold">Plugin settings</h2>
        <div className="mt-4 grid gap-3 text-sm">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Remote MCP URL
            </div>
            <code className="mt-1 block break-all rounded border border-border bg-background px-3 py-2">
              https://kit.openiap.dev/mcp
            </code>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Authentication
            </div>
            <code className="mt-1 block break-all rounded border border-border bg-background px-3 py-2">
              Bearer token = IAPKit project API key
            </code>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Tool prefix
            </div>
            <code className="mt-1 block break-all rounded border border-border bg-background px-3 py-2">
              iapkit_* tools through the OpenIAP plugin
            </code>
          </div>
        </div>
      </div>

      <h2 className="mt-10 text-2xl font-semibold">Install</h2>
      <p>
        Add the OpenIAP marketplace, install the plugin, and set the project key
        before launching Claude Code:
      </p>
      <CodeBlock language="bash">
        {`claude plugin marketplace add hyodotdev/openiap
claude plugin install openiap@openiap
export IAPKIT_API_KEY="openiap-kit_your-project-key"`}
      </CodeBlock>
      <p>Without the plugin bundle, register the hosted MCP server directly:</p>
      <CodeBlock language="bash">
        {`claude mcp add --transport http openiap https://kit.openiap.dev/mcp \\
  --header "Authorization: Bearer \${IAPKIT_API_KEY}"`}
      </CodeBlock>

      <p>
        Start with a read-only prompt and keep product writes behind review.
        Store sync jobs should begin with <code>dryRun: true</code>; approve
        live writes only after checking the proposed platform, product id,
        price, and billing period in the OpenIAP MCP Server guide.
      </p>
    </DocsPage>
  );
}
