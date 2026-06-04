import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function ChatGptPluginPage() {
  return (
    <DocsPage
      slug="ai-assistants/chatgpt-plugin"
      title="ChatGPT plugin"
      description="Connect ChatGPT to IAPKit through the MCP endpoint so it can inspect products, subscriptions, webhook URLs, and setup state."
    >
      <p>
        The IAPKit ChatGPT plugin is an MCP connector. ChatGPT talks to{" "}
        <code>/mcp</code>, the connector exposes IAPKit tools, and those tools
        call the same <code>/v1</code> API that the dashboard and SDK helpers
        use.
      </p>

      <Callout kind="note" title="No OpenAI API key">
        <p>
          Do not use an OpenAI API key for this connector. Authentication is an
          IAPKit project API key: either send it as{" "}
          <code>Authorization: Bearer &lt;IAPKit project key&gt;</code> from an
          MCP client that supports bearer auth, or set{" "}
          <code>IAPKIT_API_KEY</code> on your private MCP server so ChatGPT
          never sees the secret.
        </p>
      </Callout>

      <div
        data-testid="chatgpt-plugin-settings"
        className="my-6 rounded-lg border border-border bg-muted/20 p-4"
      >
        <h2 className="mt-0 text-xl font-semibold">Connector settings</h2>
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
              iapkit_*
            </code>
          </div>
        </div>
      </div>

      <DocsScreenshot
        src="/docs/screenshots/chatgpt-plugin.webp"
        alt="IAPKit ChatGPT plugin documentation page"
        caption="This page rendered locally after the /mcp endpoint was added. The screenshot is captured from the actual docs route."
      />

      <h2 className="mt-10 text-2xl font-semibold">Connect from ChatGPT</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Open ChatGPT's connector or developer-mode connector settings.</li>
        <li>
          Create a new MCP connector named <strong>IAPKit</strong>.
        </li>
        <li>
          Set the MCP URL to <code>https://kit.openiap.dev/mcp</code>.
        </li>
        <li>
          If the connector UI asks for bearer authentication, paste the IAPKit
          project API key from your project&apos;s <strong>API keys</strong>{" "}
          tab. If it does not support bearer auth, self-host the MCP server and
          set <code>IAPKIT_API_KEY</code> in that server&apos;s environment.
        </li>
        <li>
          Save the connector, open a new ChatGPT thread, and ask it to inspect
          your IAPKit project.
        </li>
      </ol>

      <CodeBlock language="text">
        {`Use the IAPKit connector.

List my products and tell me which ones are missing a billing period.
Then show the lifecycle webhook URL I need to paste into App Store Connect.`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">Self-hosted connector</h2>
      <p>
        Self-hosting is the safest path for a single project because the IAPKit
        project key stays in your MCP server process instead of being typed into
        a chat. The server still talks to the hosted IAPKit API by default.
      </p>
      <CodeBlock language="bash">
        {`# From the monorepo root
IAPKIT_API_KEY="openiap-kit_your-project-key" \\
  bun run --filter @hyodotdev/openiap-mcp-server start:http

# Public HTTPS tunnel or deployment should forward to:
# http://localhost:3939/mcp`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">Available tools</h2>
      <p>
        The connector exposes read-only tools for project inspection and
        write-capable tools for product catalog changes or webhook simulation.
        ChatGPT sees them with the <code>iapkit_</code> prefix:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <code>iapkit_inspect_state</code> - metrics, product catalog, webhook
          URLs.
        </li>
        <li>
          <code>iapkit_list_products</code> and{" "}
          <code>iapkit_view_subscribers</code> - catalog and subscriber reads.
        </li>
        <li>
          <code>iapkit_create_product</code> and{" "}
          <code>iapkit_manage_product</code> - product catalog writes.
        </li>
        <li>
          <code>iapkit_troubleshoot</code> - health, metrics, and optional user
          status probes.
        </li>
      </ul>

      <Callout kind="warning" title="Treat product changes as real writes">
        <p>
          Product management tools call the live IAPKit product endpoints. Ask
          ChatGPT to inspect state first, then review the proposed product ID,
          platform, type, price, and billing period before allowing a write.
        </p>
      </Callout>
    </DocsPage>
  );
}
