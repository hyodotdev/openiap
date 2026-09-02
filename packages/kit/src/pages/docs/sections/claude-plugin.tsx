import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function ClaudePluginPage() {
  return (
    <DocsPage
      slug="ai-assistants/claude-plugin"
      title="OpenIAP Claude Code plugin"
      description="Connect Claude Code to IAPKit through the OpenIAP MCP server."
    >
      <p>
        The OpenIAP plugin connects Claude Code to this IAPKit project through
        the hosted <code>/mcp</code> endpoint. This is the canonical setup page
        for installation, authentication, and safe IAPKit operations.
      </p>

      <Callout kind="note" title="IAPKit AI reference">
        <p>
          The{" "}
          <Link to="/docs/ai-assistants" className="text-primary underline">
            AI assistants overview
          </Link>{" "}
          links the IAPKit <code>llms.txt</code> files and the Codex setup.
        </p>
      </Callout>

      <Callout kind="note" title="Experimental">
        <p>
          This OpenIAP plugin is experimental. The MCP endpoint, tool names, and
          setup flow are available for early testing and may continue to evolve.
        </p>
      </Callout>

      <Callout kind="warning" title="Uses an IAPKit secret admin key">
        <p>
          Do not use an Anthropic or Claude API key for this plugin.
          Authentication is an <code>openiap-kit_sk_</code> secret admin key
          sent as <code>Authorization: Bearer &lt;IAPKit secret key&gt;</code>,
          read from the <code>IAPKIT_API_KEY</code> environment variable. Never
          reuse the app&apos;s publishable key for MCP.
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
              Bearer token = IAPKit secret admin key
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
        Add the OpenIAP marketplace, install the plugin, and set a secret admin
        key before launching Claude Code:
      </p>
      <CodeBlock language="bash">
        {`claude plugin marketplace add hyodotdev/openiap
claude plugin install openiap@openiap
export IAPKIT_API_KEY="openiap-kit_sk_<your-secret-key>"`}
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
        price, and billing period.
      </p>
    </DocsPage>
  );
}
