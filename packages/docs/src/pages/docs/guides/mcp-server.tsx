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
        description="Connect Codex, Claude Code, and other MCP clients to IAPKit through the OpenIAP MCP server."
        path="/docs/guides/mcp-server"
        keywords="OpenIAP MCP, IAPKit MCP, Codex plugin, Claude Code plugin, Model Context Protocol, AI assistants"
      />
      <h1>MCP Server</h1>
      <p>
        OpenIAP ships an IAPKit-backed MCP server so Codex, Claude Code, and
        other MCP clients can inspect in-app purchase configuration, generate
        setup snippets, manage IAPKit catalog rows, run safe store sync
        previews, and review app purchase code from the same thread.
      </p>
      <p>
        If you only use the OpenIAP SDKs directly in your app, you do not need
        IAPKit or this MCP server. IAPKit is the optional managed
        receipt-validation backend for OpenIAP projects: it stores your product
        catalog, validates App Store / Google Play purchases, tracks
        subscriptions, and exposes project tools that AI coding agents can call
        through MCP. Create or open an IAPKit project at{' '}
        <a
          href="https://kit.openiap.dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          kit.openiap.dev
        </a>{' '}
        before using the hosted MCP endpoint.
      </p>
      <p>
        MCP can perform administrative writes, so it requires an{' '}
        <code>openiap-kit_sk_</code> secret admin key. Store it only in the
        agent&apos;s environment or secret manager. Generated mobile snippets
        use a separate <code>openiap-kit_pk_</code> publishable key placeholder
        and never embed the MCP credential. MCP forwards the secret to
        IAPKit&apos;s administrative REST endpoints in the Authorization header,
        never in a URL path or query string.
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
            <code>Authorization: Bearer &lt;IAPKit secret admin key&gt;</code>
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
          The IAPKit dashboard keeps shorter plugin pages at{' '}
          <code>/docs/ai-assistants/codex-plugin</code> and{' '}
          <code>/docs/ai-assistants/claude-plugin</code> for Kit-local endpoint
          and API-key details. Those pages link back here instead of duplicating
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
          the OpenIAP marketplace, create an <code>openiap-kit_sk_</code> secret
          admin key in the IAPKit dashboard, set it as{' '}
          <code>IAPKIT_API_KEY</code> in the environment that launches Codex,
          then open a new thread.
        </p>
        <CodeBlock language="bash">{`codex plugin marketplace add hyodotdev/openiap --ref main
export IAPKIT_API_KEY="openiap-kit_sk_<your-secret-key>"`}</CodeBlock>
        <CodeBlock language="text">{`Use the OpenIAP plugin.

Review my app's in-app purchase flow and list the OpenIAP/IAPKit tools available.
Do not create products, start sync jobs, or modify files until I confirm.`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="claude-code-plugin" level="h2">
          Claude Code plugin
        </AnchorLink>
        <p>
          The same plugin works in Claude Code. Add the OpenIAP marketplace,
          install the plugin, set an IAPKit secret admin key as{' '}
          <code>IAPKIT_API_KEY</code> in the environment that launches Claude
          Code, then start a new session.
        </p>
        <CodeBlock language="bash">{`claude plugin marketplace add hyodotdev/openiap
claude plugin install openiap@openiap
export IAPKIT_API_KEY="openiap-kit_sk_<your-secret-key>"`}</CodeBlock>
        <p>
          Inside an interactive session you can use{' '}
          <code>/plugin marketplace add hyodotdev/openiap</code> and{' '}
          <code>/plugin install openiap@openiap</code> instead. If you do not
          want the plugin bundle, register the hosted MCP server directly:
        </p>
        <CodeBlock language="bash">{`claude mcp add --transport http openiap https://kit.openiap.dev/mcp \\
  --header "Authorization: Bearer \${IAPKIT_API_KEY}"`}</CodeBlock>
        <p>
          Contributors working inside the OpenIAP monorepo get the same server
          from the repo's project-scoped <code>.mcp.json</code> automatically —
          approve it once and export <code>IAPKIT_API_KEY</code> before
          launching Claude Code.
        </p>
      </section>

      <section>
        <AnchorLink id="manual-config" level="h2">
          Manual MCP config (Codex)
        </AnchorLink>
        <p>
          If you do not install the plugin bundle, configure the hosted MCP
          server directly in Codex. Keep the secret admin key in an environment
          variable instead of hardcoding it into config files or mobile code.
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
IAPKIT_API_KEY="openiap-kit_sk_<your-secret-key>" \\
  bun run --filter @hyodotdev/openiap-mcp-server start:http

# Local MCP URL:
# http://127.0.0.1:3939/mcp`}</CodeBlock>
        <CodeBlock language="toml">{`[mcp_servers.openiap-local]
url = "http://127.0.0.1:3939/mcp"
default_tools_approval_mode = "prompt"`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="expo-smoke-test" level="h2">
          Expo smoke-test checklist
        </AnchorLink>
        <p>
          When testing generated mobile setup code, verify the credential
          boundary as well as the purchase flow:
        </p>
        <ul>
          <li>
            Start MCP with an <code>openiap-kit_sk_</code> secret admin key,
            call <code>initialize</code>, confirm the <code>iapkit_*</code> tool
            list, and request the Expo snippet with <code>iapkit_setup</code>.
          </li>
          <li>
            Confirm the generated code contains only an{' '}
            <code>IAPKIT_PUBLISHABLE_KEY</code> placeholder and does not contain
            the MCP secret or any project-wide lifecycle event consumer.
          </li>
          <li>
            Configure an <code>openiap-kit_pk_</code> publishable key in Expo
            public configuration, then fetch products and open the native
            sandbox purchase sheet.
          </li>
          <li>
            Confirm verification checks <code>isValid</code>, an allowed state,
            and an exact store-verified product-ID match before granting or
            finishing.
          </li>
          <li>
            If <code>includeClientPayload</code> is enabled, confirm the app
            treats the payload as public configuration and never as entitlement
            authority.
          </li>
          <li>
            Run the app&apos;s typecheck and tests, then complete one
            real-device sandbox purchase against the matching IAPKit project.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="example-app" level="h2">
          Example App setup
        </AnchorLink>
        <p>
          For a concrete walkthrough, use Example App with{' '}
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
Use a separate IAPKIT_PUBLISHABLE_KEY in the app. Never copy the MCP
IAPKIT_API_KEY secret into source code or runtime configuration shipped to users.
Run the app's typecheck and tests after editing.`}</CodeBlock>

        <h4>5. Add receipt validation</h4>
        <CodeBlock language="text">{`Use the OpenIAP plugin and continue in this app.

Wire receipt validation after a successful purchase:
- use IAPKit as the verification provider
- on iOS, validate the StoreKit JWS from the purchase
- on Android, validate the Google purchaseToken
- grant the entitlement and finishTransaction only after the validation result is valid
- use an openiap-kit_pk_ publishable key in the app
- keep the openiap-kit_sk_ MCP secret out of every app build

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
          Your agent sees the tools with the <code>iapkit_</code> prefix. The
          MCP server currently exposes tools for setup snippets, status checks,
          troubleshooting, product catalog and client-payload reads and writes,
          subscription lists, sandbox purchase guidance, synthetic webhook
          delivery, entitlement inspection, revenue analytics, and App Store /
          Google Play product sync jobs. MCP authenticates with a secret admin
          key. Receipt validation still runs in your app or backend through the
          OpenIAP SDK and IAPKit API using a restricted publishable key.
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
          is false. Ask your agent to inspect first, run store sync as{' '}
          <code>dryRun: true</code>, and approve live writes only after
          reviewing the proposed product id, platform, type, price, and billing
          period.
        </p>
      </section>
    </div>
  );
}

export default MCPServer;
