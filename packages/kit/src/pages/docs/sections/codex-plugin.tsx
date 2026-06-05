import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function CodexPluginPage() {
  return (
    <DocsPage
      slug="ai-assistants/codex-plugin"
      title="Codex plugin"
      description="Connect Codex to IAPKit through MCP so people can chat with IAPKit, inspect purchases, manage products, sync stores, and apply app code changes."
    >
      <p>
        The IAPKit Codex plugin is an MCP-backed connector. Codex talks to{" "}
        <code>/mcp</code>, the connector exposes IAPKit tools, and those tools
        call the same <code>/v1</code> API that the dashboard and SDK helpers
        use. Codex can then combine IAPKit project context with its normal
        workspace tools to answer questions, propose product operations, and
        edit application code.
      </p>

      <Callout kind="note" title="Uses an IAPKit key">
        <p>
          Do not use an OpenAI or ChatGPT API key for this plugin.
          Authentication is an IAPKit project API key: either send it as{" "}
          <code>Authorization: Bearer &lt;IAPKit project key&gt;</code> from an
          MCP client that supports bearer auth, or set{" "}
          <code>IAPKIT_API_KEY</code> on your private MCP server so the secret
          stays in your own process.
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
        src="/docs/screenshots/codex-plugin.webp"
        alt="IAPKit Codex plugin documentation page"
        caption="This page rendered locally after the /mcp endpoint was added. The screenshot is captured from the actual docs route."
      />

      <h2 className="mt-10 text-2xl font-semibold">Connect from Codex</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Open Codex plugin or MCP connector settings.</li>
        <li>
          Create a new plugin or MCP connector named <strong>IAPKit</strong>.
        </li>
        <li>
          Set the MCP URL to <code>https://kit.openiap.dev/mcp</code>.
        </li>
        <li>
          Configure bearer authentication with the IAPKit project API key from
          the project&apos;s <strong>API keys</strong> tab. If the client does
          not support bearer auth, self-host the MCP server and set{" "}
          <code>IAPKIT_API_KEY</code> in that server&apos;s environment.
        </li>
        <li>
          Save the connector, open a new Codex thread, and ask it to inspect or
          change your IAPKit project.
        </li>
      </ol>

      <CodeBlock language="text">
        {`Use the IAPKit plugin.

How many subscription purchases happened this month, grouped by currency?
Then create an iOS monthly subscription product and update my app code to use it.`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">What Codex can do</h2>
      <p>
        IAPKit tools give Codex live project operations. Codex&apos;s normal
        workspace tools still handle source edits, tests, and pull-request work.
        Together, a single thread can inspect this month&apos;s purchase counts,
        create an IAPKit catalog row, enqueue an App Store or Play sync, poll
        the sync job, and update the app code that calls the corresponding
        OpenIAP SDK.
      </p>

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
        The connector exposes 13 tools for project inspection, purchase and
        revenue questions, catalog changes, webhook simulation, and store sync.
        Codex sees them with the <code>iapkit_</code> prefix:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <code>iapkit_revenue_analytics</code> - subscription purchases,
          renewals, cancellations, refunds, and revenue rollups.
        </li>
        <li>
          <code>iapkit_check_status</code> - active subscription status for one
          user.
        </li>
        <li>
          <code>iapkit_inspect_state</code> - metrics, product catalog, webhook
          URLs.
        </li>
        <li>
          <code>iapkit_list_products</code> - product catalog reads.
        </li>
        <li>
          <code>iapkit_view_subscribers</code> - subscriber list reads.
        </li>
        <li>
          <code>iapkit_create_product</code> and{" "}
          <code>iapkit_manage_product</code> - product catalog writes.
        </li>
        <li>
          <code>iapkit_simulate_purchase</code> - sandbox purchase guidance for
          Apple or Google.
        </li>
        <li>
          <code>iapkit_simulate_webhook</code> - synthetic webhook delivery for
          local/dev verification.
        </li>
        <li>
          <code>iapkit_sync_products</code> and <code>iapkit_sync_status</code>{" "}
          - App Store Connect / Google Play catalog sync jobs.
        </li>
        <li>
          <code>iapkit_setup</code> - framework integration snippets for Expo,
          React Native, Flutter, KMP, Godot, native iOS, and native Android.
        </li>
        <li>
          <code>iapkit_troubleshoot</code> - health, metrics, and optional user
          status probes.
        </li>
      </ul>

      <Callout kind="warning" title="Treat operations as real writes">
        <p>
          Product management tools call the live IAPKit product endpoints, and
          store sync jobs can write to App Store Connect or Google Play when{" "}
          <code>dryRun</code> is false. Ask Codex to inspect state first, run
          sync jobs as <code>dryRun: true</code>, then review the proposed
          product ID, platform, type, price, and billing period before allowing
          a write.
        </p>
      </Callout>
    </DocsPage>
  );
}
