import { Link } from 'react-router-dom';

import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function MCPServer() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="MCP Server"
        description="Connect Codex and other MCP clients to IAPKit through the OpenIAP MCP server."
        path="/docs/guides/mcp-server"
        keywords="OpenIAP MCP, IAPKit MCP, Codex plugin, Model Context Protocol, AI assistants"
      />
      <h1>MCP Server</h1>
      <p>
        OpenIAP ships an IAPKit-backed MCP server so Codex and other MCP clients
        can inspect in-app purchase configuration, generate setup snippets,
        manage IAPKit catalog rows, run safe store sync previews, and review app
        purchase code from the same thread.
      </p>
      <p>
        If you only use the OpenIAP SDKs directly in your app, you do not need
        IAPKit or this MCP server. IAPKit is the optional managed
        receipt-validation backend for OpenIAP projects: it stores your product
        catalog, validates App Store / Google Play purchases, tracks
        subscriptions, and exposes project tools that Codex can call through
        MCP. Create or open an IAPKit project at{' '}
        <a
          href="https://kit.openiap.dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          kit.openiap.dev
        </a>{' '}
        before using the hosted MCP endpoint.
      </p>

      <TLDRBox>
        <ul>
          <li>
            IAPKit dashboard:{' '}
            <a
              href="https://kit.openiap.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://kit.openiap.dev
            </a>
          </li>
          <li>
            Hosted endpoint: <code>https://kit.openiap.dev/mcp</code>
          </li>
          <li>
            Authentication:{' '}
            <code>Authorization: Bearer &lt;IAPKit project key&gt;</code>
          </li>
          <li>
            Local testing: run <code>@hyodotdev/openiap-mcp-server</code> from
            the monorepo.
          </li>
          <li>
            Store writes should start with <code>dryRun: true</code>.
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="where-to-open-it" level="h2">
          Where to open it
        </AnchorLink>
        <p>
          In this OpenIAP docs site, this page lives at{' '}
          <code>/docs/guides/mcp-server</code> under{' '}
          <strong>Setup Guide → AI Assistants → MCP Server</strong>. It covers
          MCP setup, local PR testing, tool behavior, safety, and the recorded
          Example App walkthrough.
        </p>
        <p>
          The IAPKit dashboard keeps a shorter Codex plugin page at{' '}
          <code>/docs/ai-assistants/codex-plugin</code> for Kit-local endpoint
          and API-key details. That page links back here instead of duplicating
          the full MCP guide. On a local checkout, Vite may assign different
          ports to the OpenIAP docs site and the Kit dashboard, so use the page
          path rather than the port number when opening the guide.
        </p>
      </section>

      <section>
        <AnchorLink id="codex-plugin" level="h2">
          Codex plugin
        </AnchorLink>
        <p>
          Use the OpenIAP plugin when you want Codex to call IAPKit tools while
          it also edits and tests your app workspace. Install the plugin from
          the OpenIAP marketplace, set <code>IAPKIT_API_KEY</code> in the
          environment that launches Codex, then open a new thread.
        </p>
        <CodeBlock language="bash">{`codex plugin marketplace add hyodotdev/openiap --ref main
export IAPKIT_API_KEY="openiap-kit_your-project-key"`}</CodeBlock>
        <CodeBlock language="text">{`Use the OpenIAP plugin.

Review my app's in-app purchase flow and list the OpenIAP/IAPKit tools available.
Do not create products, start sync jobs, or modify files until I confirm.`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="manual-config" level="h2">
          Manual MCP config
        </AnchorLink>
        <p>
          If you do not install the plugin bundle, configure the hosted MCP
          server directly in Codex. Keep the project key in an environment
          variable instead of hardcoding it into config files.
        </p>
        <CodeBlock language="toml">{`[mcp_servers.openiap]
url = "https://kit.openiap.dev/mcp"
bearer_token_env_var = "IAPKIT_API_KEY"
default_tools_approval_mode = "prompt"`}</CodeBlock>
        <p>
          For unreleased PR testing, run the local HTTP transport and point
          Codex at it:
        </p>
        <CodeBlock language="bash">{`# From the monorepo root
IAPKIT_API_KEY="openiap-kit_your-project-key" \\
  bun run --filter @hyodotdev/openiap-mcp-server start:http

# Local MCP URL:
# http://127.0.0.1:3939/mcp`}</CodeBlock>
        <CodeBlock language="toml">{`[mcp_servers.openiap-local]
url = "http://127.0.0.1:3939/mcp"
default_tools_approval_mode = "prompt"`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="recorded-expo-test" level="h2">
          Recorded Expo app test
        </AnchorLink>
        <p>
          This recording uses the generated CPK Expo app at{' '}
          <code>/Users/hyo/Github/others/OpenIapMcpTestApp</code>. The local
          OpenIAP MCP server is started on <code>localhost:3939/mcp</code> and a
          Codex prompt asks MCP to generate the Expo setup hook. After the hook
          is applied, the app loads the store products, connects Buy to{' '}
          <code>requestPurchase</code>, validates the receipt against the dev
          Kit API, and finishes the transaction on a connected iPhone.
        </p>
        <p>The recording covers these concrete checks:</p>
        <ul>
          <li>
            Create the CPK Expo app in <code>/Users/hyo/Github/others</code> and
            configure <code>dev.hyo.martie</code> as the sample iOS bundle id
            and Android package name. The app UI still shows only Example App
            product names, prices, and Buy buttons.
          </li>
          <li>
            Start the local MCP HTTP transport, call <code>initialize</code>,
            confirm the <code>iapkit_*</code> tools list, and request the Expo
            setup snippet with <code>iapkit_setup</code>.
          </li>
          <li>
            Confirm the generated Expo IAP hook fetches the subscription and
            in-app products: Premium, 10 Bulbs, and 30 Bulbs.
          </li>
          <li>
            Verify <code>fetchProducts</code> returns all three products, then
            press Buy in the app and confirm <code>requestPurchase</code> opens
            the native Apple sandbox purchase sheet on the connected iPhone.
          </li>
          <li>
            Confirm the dev Kit validation endpoint returns{' '}
            <code>isValid: true</code>, the purchase state is{' '}
            <code>READY_TO_CONSUME</code>, <code>finishTransaction</code>{' '}
            completes, and the dev database records the purchase row.
          </li>
          <li>
            Run <code>npm run typecheck</code>,{' '}
            <code>npm test -- --runInBand</code>, and a native iOS run.
          </li>
        </ul>
        <figure style={{ margin: '1.5rem 0' }}>
          <video
            src="/docs/videos/openiap-mcp-expo-test.webm?v=progressive-v2"
            controls
            muted
            playsInline
            preload="metadata"
            style={{
              width: '100%',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              background: '#0b0d10',
            }}
          >
            Recorded OpenIAP MCP and Expo app smoke test.
          </video>
          <figcaption
            style={{
              marginTop: '0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            Real-device verification: MCP initialize/tools/list/iapkit_setup
            succeeds, the generated Expo hook loads Premium and Bulbs products,
            Buy opens the native Apple sandbox purchase sheet, and dev receipt
            validation plus <code>finishTransaction</code> completes.
          </figcaption>
        </figure>
        <p>
          The recording uses local PR code with the dev Kit backend; it does not
          require the production MCP endpoint to be deployed. The same MCP
          thread can also connect the app to its IAPKit project, check
          entitlement status, inspect webhook URLs, and review revenue or
          subscriber state without leaving Codex.
        </p>
      </section>

      <section>
        <AnchorLink id="example-app" level="h2">
          Example App setup
        </AnchorLink>
        <p>
          For a concrete recording or walkthrough, use Example App with{' '}
          <code>dev.hyo.martie</code> as the sample iOS bundle id and Android
          package name. Configure that identifier in the IAPKit project settings
          first; store sync tools read the package and bundle identifiers from
          IAPKit. Keep the app UI focused on product names such as Premium, 10
          Bulbs, and 30 Bulbs.
        </p>

        <h4>1. Inspect first</h4>
        <CodeBlock language="text">{`Use the OpenIAP plugin in this workspace.

The app is Example App:
- iOS bundle id: dev.hyo.martie
- Android package name: dev.hyo.martie
- framework: Expo

Inspect the IAPKit project, list existing products, and review the app's purchase code.
Do not create products, start sync jobs, or edit files until I approve.`}</CodeBlock>

        <h4>2. Create local catalog rows</h4>
        <CodeBlock language="text">{`Use the OpenIAP plugin.

Create or update these Example App products in IAPKit's local catalog:
- Premium: Subscription, monthly
- 10 Bulbs: Consumable
- 30 Bulbs: Consumable

Create both iOS and Android rows.
For iOS, put Premium in subscriptionGroupName "Example Premium".
After creating them, list products and summarize exactly what changed.`}</CodeBlock>

        <h4>3. Preview store sync</h4>
        <CodeBlock language="text">{`Use the OpenIAP plugin.

Run a dry-run product sync for Example App:
- platform Android, direction push, dryRun true
- platform IOS, direction push, dryRun true

Poll each sync job until it finishes.
Show the proposed store changes and wait for my approval before running dryRun false.`}</CodeBlock>

        <h4>4. Wire the Expo app</h4>
        <CodeBlock language="text">{`Use the OpenIAP plugin and update the Expo app.

Call iapkit_setup for framework expo and the Premium product.
Apply the generated snippet to the app's purchase screen or purchase hook.
Fetch Premium, 10 Bulbs, and 30 Bulbs, and connect Buy to requestPurchase.
Keep IAPKIT_API_KEY out of source code; read it from runtime configuration.
Run the app's typecheck and tests after editing.`}</CodeBlock>

        <h4>5. Add receipt validation</h4>
        <CodeBlock language="text">{`Use the OpenIAP plugin and continue in this app.

Wire receipt validation after a successful purchase:
- use IAPKit as the verification provider
- on iOS, validate the StoreKit JWS from the purchase
- on Android, validate the Google purchaseToken
- grant the entitlement and finishTransaction only after the validation result is valid
- keep the IAPKit project key out of committed source; use a backend endpoint or runtime secret

Then inspect IAPKit state from MCP:
- call iapkit_inspect_state to review project status, products, and webhook URLs
- call iapkit_check_status for the app's test user after a sandbox purchase
- use iapkit_troubleshoot if validation, webhooks, or entitlement state does not look right

Run typecheck and tests after editing, and summarize exactly what changed.`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="tools" level="h2">
          Tools exposed
        </AnchorLink>
        <p>
          Codex sees the tools with the <code>iapkit_</code> prefix. The MCP
          server currently exposes tools for setup snippets, status checks,
          troubleshooting, product catalog reads and writes, subscription lists,
          sandbox purchase guidance, synthetic webhook delivery, entitlement
          inspection, revenue analytics, and App Store / Google Play product
          sync jobs. Receipt validation still runs in your app or backend
          through the OpenIAP SDK and IAPKit API; MCP gives Codex the project
          context and tool results it needs to wire and verify that flow.
        </p>
        <p>
          For the lower-level backend architecture and stdio example, see{' '}
          <Link to="/docs/kit-backend#mcp">Kit backend → MCP server</Link>.
        </p>
      </section>

      <section>
        <AnchorLink id="safety" level="h2">
          Safety
        </AnchorLink>
        <p>
          Product management tools call live IAPKit endpoints. Store sync jobs
          can write to App Store Connect or Google Play when <code>dryRun</code>{' '}
          is false. Ask Codex to inspect first, run store sync as{' '}
          <code>dryRun: true</code>, and approve live writes only after
          reviewing the proposed product id, platform, type, price, and billing
          period.
        </p>
      </section>
    </div>
  );
}

export default MCPServer;
