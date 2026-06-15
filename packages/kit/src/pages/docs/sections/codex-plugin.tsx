import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function CodexPluginPage() {
  return (
    <DocsPage
      slug="ai-assistants/codex-plugin"
      title="OpenIAP Codex plugin"
      description="Connect Codex to OpenIAP through MCP so it can review app purchase flows, help implement in-app purchases, inspect IAPKit data, and apply app code changes."
    >
      <p>
        The OpenIAP Codex plugin is an MCP-backed connector for in-app purchase
        implementation and review. Codex talks to <code>/mcp</code>, the
        connector exposes OpenIAP workflows backed by IAPKit project tools, and
        those tools call the same <code>/v1</code> API that the dashboard and
        SDK helpers use. Codex can then combine live project context with its
        normal workspace tools to inspect purchase flows, generate setup code,
        review product configuration, and apply app code changes.
      </p>

      <Callout kind="note" title="Experimental">
        <p>
          This OpenIAP plugin is experimental. The MCP endpoint, tool names, and
          setup flow are available for early testing, and we will keep improving
          the connector as Codex MCP support and IAPKit workflows evolve.
        </p>
      </Callout>

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
              iapkit_* tools through the OpenIAP plugin
            </code>
          </div>
        </div>
      </div>

      <DocsScreenshot
        src="/docs/screenshots/codex-plugin.webp"
        alt="OpenIAP Codex plugin documentation page"
        caption="This page rendered locally after the /mcp endpoint was added. The screenshot is captured from the actual docs route."
      />

      <h2 className="mt-10 text-2xl font-semibold">
        Install the OpenIAP plugin
      </h2>
      <p>
        After this repository marketplace is available, add it to Codex and
        install <strong>OpenIAP</strong> from the Plugin Directory. This is the
        installable plugin path. The public OpenAI-curated Plugin Directory does
        not yet support self-serve public publishing.
      </p>
      <CodeBlock language="bash">
        {`codex plugin marketplace add hyodotdev/openiap --ref main`}
      </CodeBlock>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Restart Codex after adding or updating the marketplace.</li>
        <li>
          Open <code>/plugins</code> or the Codex Plugin Directory.
        </li>
        <li>
          Select the <strong>OpenIAP</strong> marketplace.
        </li>
        <li>
          Install the <strong>OpenIAP</strong> plugin.
        </li>
        <li>
          Set <code>IAPKIT_API_KEY</code> in the environment that launches
          Codex, then open a new thread.
        </li>
      </ol>

      <CodeBlock language="bash">
        {`export IAPKIT_API_KEY="openiap-kit_your-project-key"`}
      </CodeBlock>

      <CodeBlock language="text">
        {`Use the OpenIAP plugin.

Review my app's in-app purchase flow and list the OpenIAP/IAPKit tools available.
Do not create products, start sync jobs, or modify files until I confirm.`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">
        Example: connect Martie in Codex
      </h2>
      <p>
        Use this sequence when following or recording a real app setup. Martie
        uses <code>dev.hyo.martie</code> as both the iOS bundle id and Android
        package name. Enter that identifier in the IAPKit project{" "}
        <strong>Settings</strong> first; the sync tools read the package and
        bundle identifiers from IAPKit, not from the Codex prompt.
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Configure store credentials in IAPKit:{" "}
          <Link
            to="/docs/verification/apple"
            className="text-primary underline"
          >
            Apple App Store
          </Link>{" "}
          for <code>dev.hyo.martie</code>, and{" "}
          <Link
            to="/docs/verification/google"
            className="text-primary underline"
          >
            Google Play
          </Link>{" "}
          for package <code>dev.hyo.martie</code>.
        </li>
        <li>
          Ask Codex to inspect the IAPKit project and app workspace before any
          writes.
        </li>
        <li>
          Let Codex create or confirm the local IAPKit catalog rows for the
          Martie subscription products.
        </li>
        <li>
          Run store sync as <code>dryRun: true</code>, review the diff, then
          approve <code>dryRun: false</code> only when the proposed App Store
          Connect or Google Play changes are correct.
        </li>
        <li>
          Ask Codex to apply the Expo setup snippet to the app and run the
          app&apos;s typecheck/tests.
        </li>
      </ol>

      <CodeBlock title="1. Inspect first" language="text">
        {`Use the OpenIAP plugin in this workspace.

The app is Martie:
- iOS bundle id: dev.hyo.martie
- Android package name: dev.hyo.martie
- framework: Expo

Inspect the IAPKit project, list existing products, and review the app's purchase code.
Do not create products, start sync jobs, or edit files until I approve.`}
      </CodeBlock>

      <CodeBlock title="2. Create the local catalog rows" language="text">
        {`Use the OpenIAP plugin.

Create or update these Martie subscription products in IAPKit's local catalog:
- premium_monthly: Subscription, monthly, USD 4.99
- premium_yearly: Subscription, yearly, USD 39.99

Create both iOS and Android rows.
For iOS, use subscriptionGroupName "Martie Premium".
After creating them, list products and summarize exactly what changed.`}
      </CodeBlock>

      <CodeBlock title="3. Preview store sync" language="text">
        {`Use the OpenIAP plugin.

Run a dry-run product sync for Martie:
- platform Android, direction push, dryRun true
- platform IOS, direction push, dryRun true

Poll each sync job until it finishes.
Show the proposed store changes and wait for my approval before running dryRun false.`}
      </CodeBlock>

      <CodeBlock title="4. Wire the Expo app" language="text">
        {`Use the OpenIAP plugin and update the Expo app.

Call iapkit_setup for framework expo and productId premium_monthly.
Apply the generated snippet to the app's purchase screen or purchase hook.
Keep IAPKIT_API_KEY out of source code; read it from runtime configuration.
Run the app's typecheck and tests after editing.`}
      </CodeBlock>

      <Callout kind="warning" title="Record dry-runs, not live writes">
        <p>
          For public demos and docs recordings, stop at{" "}
          <code>dryRun: true</code> unless the video is captured against a
          disposable sandbox project. A live <code>dryRun: false</code> sync can
          write products to App Store Connect or Google Play.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Manual MCP config</h2>
      <p>
        If you do not want to install the plugin bundle, configure the hosted
        MCP server directly. Use the hosted endpoint after this Kit deployment
        is live. If you are reviewing a pull request or testing unreleased MCP
        changes, use the local setup in the next section.
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Create or rotate an IAPKit project API key from the project&apos;s{" "}
          <strong>API keys</strong> tab.
        </li>
        <li>
          Export it in the shell that launches Codex. This keeps the key out of
          the Codex config file.
        </li>
        <li>
          Add the hosted IAPKit MCP server to <code>~/.codex/config.toml</code>.
        </li>
        <li>
          Restart Codex or open a new thread, then verify that the{" "}
          <code>iapkit_*</code> tools are listed.
        </li>
      </ol>

      <CodeBlock language="bash">
        {`export IAPKIT_API_KEY="openiap-kit_your-project-key"`}
      </CodeBlock>

      <CodeBlock language="toml">
        {`[mcp_servers.openiap]
url = "https://kit.openiap.dev/mcp"
bearer_token_env_var = "IAPKIT_API_KEY"
default_tools_approval_mode = "prompt"`}
      </CodeBlock>

      <CodeBlock language="text">
        {`Use the OpenIAP MCP server.

Inspect my IAPKit project and summarize subscription purchases this month, grouped by currency.
Do not create products, start sync jobs, or modify files until I confirm.`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">
        Test local changes before deployment
      </h2>
      <p>
        When testing a pull request or an unreleased MCP change, run the local
        HTTP server from the monorepo and point Codex at the local MCP URL
        instead of the hosted endpoint.
      </p>
      <CodeBlock language="bash">
        {`# From the monorepo root
IAPKIT_API_KEY="openiap-kit_your-project-key" \\
  bun run --filter @hyodotdev/openiap-mcp-server start:http

# The local MCP URL is:
# http://127.0.0.1:3939/mcp`}
      </CodeBlock>

      <CodeBlock language="toml">
        {`[mcp_servers.openiap-local]
url = "http://127.0.0.1:3939/mcp"
default_tools_approval_mode = "prompt"`}
      </CodeBlock>

      <p>
        The local Codex config does not need a bearer token because the local
        MCP server process already has <code>IAPKIT_API_KEY</code>. With the
        local server running, open Codex and use <code>/mcp</code> to confirm
        that <code>openiap-local</code> is connected. Then start with a
        read-only prompt:
      </p>
      <CodeBlock language="text">
        {`Use the OpenIAP MCP server. List the available iapkit tools.`}
      </CodeBlock>

      <p>
        A healthy connection exposes 13 tools. For a safe functional test that
        does not write to IAPKit, ask Codex to generate a setup snippet:
      </p>
      <CodeBlock language="text">
        {`Use the OpenIAP MCP server. Call iapkit_setup for framework expo and productId premium_monthly. Do not modify files.`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">What Codex can do</h2>
      <p>
        The OpenIAP plugin gives Codex purchase-flow implementation help and
        live IAPKit project operations. Codex&apos;s normal workspace tools
        still handle source edits, tests, and pull-request work. Together, a
        single thread can inspect app purchase code, generate SDK setup
        snippets, review this month&apos;s purchase counts, create an IAPKit
        catalog row, enqueue an App Store or Play sync, poll the sync job, and
        update the app code that calls the corresponding OpenIAP SDK.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Self-hosted connector</h2>
      <p>
        Self-hosting is the safest path for a single project because the IAPKit
        project key stays in your MCP server process instead of being typed into
        a chat. Run the same HTTP server used for local testing, then expose it
        through an HTTPS tunnel or deploy it behind your own HTTPS URL. The
        server still talks to the hosted IAPKit API by default.
      </p>
      <CodeBlock language="bash">
        {`# Public HTTPS tunnel or deployment should forward to:
# http://127.0.0.1:3939/mcp`}
      </CodeBlock>
      <CodeBlock language="toml">
        {`[mcp_servers.openiap-self-hosted]
url = "https://your-mcp-host.example.com/mcp"
default_tools_approval_mode = "prompt"`}
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
