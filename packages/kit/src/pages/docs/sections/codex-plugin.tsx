import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function CodexPluginPage() {
  return (
    <DocsPage
      slug="ai-assistants/codex-plugin"
      title="OpenIAP Codex plugin"
      description="Connect Codex to IAPKit through the OpenIAP MCP server."
    >
      <p>
        The OpenIAP Codex plugin connects Codex to this IAPKit project through
        the hosted <code>/mcp</code> endpoint. This is the canonical setup page
        for the IAPKit endpoint, authentication, and safe write workflow.
      </p>

      <Callout kind="note" title="IAPKit AI reference">
        <p>
          The{" "}
          <Link to="/docs/ai-assistants" className="text-primary underline">
            AI assistants overview
          </Link>{" "}
          links the IAPKit <code>llms.txt</code> files and the Claude Code
          setup.
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
          Do not use an OpenAI or ChatGPT API key for this plugin.
          Authentication is an <code>openiap-kit_sk_</code> secret admin key
          sent as <code>Authorization: Bearer &lt;IAPKit secret key&gt;</code>{" "}
          or provided to a private MCP server as <code>IAPKIT_API_KEY</code>.
          Never reuse the app&apos;s publishable key for MCP.
        </p>
      </Callout>

      <div
        data-testid="codex-plugin-settings"
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
        Add the OpenIAP marketplace, export an IAPKit secret admin key in the
        environment that launches Codex, then start a new task:
      </p>
      <CodeBlock language="bash">
        {`codex plugin marketplace add hyodotdev/openiap --ref main
export IAPKIT_API_KEY="openiap-kit_sk_<your-secret-key>"`}
      </CodeBlock>
      <p>Without the plugin bundle, configure the hosted server directly:</p>
      <CodeBlock language="toml">
        {`[mcp_servers.openiap]
url = "https://kit.openiap.dev/mcp"
bearer_token_env_var = "IAPKIT_API_KEY"
default_tools_approval_mode = "prompt"`}
      </CodeBlock>

      <p>
        Start with a read-only Codex prompt and keep product writes behind
        review. Store sync jobs should begin with <code>dryRun: true</code>;
        approve live writes only after checking the proposed platform, product
        id, price, and billing period.
      </p>
    </DocsPage>
  );
}
