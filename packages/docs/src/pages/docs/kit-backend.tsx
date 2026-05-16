import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function KitBackend() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="kit backend"
        description="OpenIAP kit is the hosted backend that handles Apple StoreKit 2 and Google Play receipt validation, lifecycle webhooks, subscription state, revenue metrics, and App Store Connect / Play Console product sync — without the host app needing to operate its own server."
        path="/docs/kit-backend"
        keywords="OpenIAP kit, hosted backend, receipt validation, subscription state, App Store Connect, Play Console, MCP server"
      />
      <h1>kit backend</h1>
      <p>
        kit (<code>kit.openiap.dev</code>) is the hosted backend you can drop in
        instead of running your own server. It handles every step that comes
        after a user taps "buy" — receipt validation, lifecycle webhooks,
        subscription state, revenue metrics, and App Store Connect / Play
        Console product sync — and exposes everything through one URL surface
        that the framework SDKs and MCP server speak.
      </p>

      <section>
        <AnchorLink id="surface" level="h2">
          Surface map
        </AnchorLink>
        <p>
          Receipt verification uses an <code>Authorization: Bearer</code> API
          key header. Webhook, subscription, product, and MCP-friendly endpoints
          carry the project API key as a path segment so store consoles, mobile
          WebViews, and stdio MCP tools can call them without custom bearer
          header plumbing.
        </p>
        <ul>
          <li>
            <code>POST /v1/purchase/verify</code> — receipt validation (Apple
            JWS, Google purchaseToken, Meta Horizon) with a Bearer API key.
          </li>
          <li>
            <code>POST /v1/webhooks/&#123;apiKey&#125;</code> — unified App
            Store Server Notifications v2 / Google Pub/Sub RTDN receiver (Google
            OIDC verified). Platform-specific <code>/apple</code> /{' '}
            <code>/google</code> aliases remain supported for existing setups.
          </li>
          <li>
            <code>GET /v1/webhooks/stream/&#123;apiKey&#125;</code> — SSE stream
            of normalized <code>WebhookEvent</code>s, driven by Convex's
            reactive subscribe.
          </li>
          <li>
            <code>GET /v1/subscriptions/status/&#123;apiKey&#125;?userId=</code>{' '}
            — fast entitlement gate.
          </li>
          <li>
            <code>
              GET /v1/subscriptions/entitlements/&#123;apiKey&#125;?userId=
            </code>{' '}
            — every active productId for a user.
          </li>
          <li>
            <code>GET /v1/subscriptions/list/&#123;apiKey&#125;</code> —
            filtered subscription list (for the dashboard).
          </li>
          <li>
            <code>GET /v1/subscriptions/metrics/&#123;apiKey&#125;</code> — MRR,
            churn, refund counts.
          </li>
          <li>
            <code>POST /v1/subscriptions/bind-user/&#123;apiKey&#125;</code> —
            attach a userId to a verified purchase.
          </li>
          <li>
            <code>GET/POST/DELETE /v1/products/&#123;apiKey&#125;</code> —
            kit-side product catalog.
          </li>
          <li>
            <code>
              POST /v1/products/&#123;apiKey&#125;/sync/&#123;ios|android&#125;
            </code>{' '}
            — push-sync with App Store Connect / Play Console.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="dashboard" level="h2">
          Dashboard UX
        </AnchorLink>
        <p>
          The hosted dashboard at <code>kit.openiap.dev</code> wires every
          project-scoped endpoint into a UI:
        </p>
        <ul>
          <li>
            <strong>Subscriptions</strong> — live state filtered by{' '}
            <code>Active</code> / <code>InGracePeriod</code> /{' '}
            <code>InBillingRetry</code> / <code>Expired</code> / etc., with the
            metrics summary at the top.
          </li>
          <li>
            <strong>Products</strong> — kit-side catalog with one-click sync to
            App Store Connect (via the project's uploaded <code>.p8</code> key)
            or Play Console (via the service-account JSON).
          </li>
          <li>
            <strong>Webhooks</strong> — copyable lifecycle webhook URL, the SSE
            stream URL, and a curl recipe for emitting a synthetic test
            notification without going through the App Store / Play Console.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="entitlements" level="h2">
          Entitlement check from a client
        </AnchorLink>
        <p>
          The fastest gate ("is this user paying?") is one HTTP request. Each
          SDK ships a typed wrapper so you don't construct URLs by hand:
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { kitApi } from 'react-native-iap';

const api = kitApi({ apiKey: process.env.OPENIAP_API_KEY! });
const { active, subscription } = await api.status('user-1');
if (active) {
  unlockPremium(subscription?.productId);
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final api = KitApi(apiKey: const String.fromEnvironment('OPENIAP_API_KEY'));
final status = await api.status('user-1');
if (status.active) {
  unlockPremium(status.subscription?.productId);
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System;

var apiKey = Environment.GetEnvironmentVariable("OPENIAP_API_KEY")
    ?? throw new InvalidOperationException("OPENIAP_API_KEY is required");
var api = Iap.KitApi(new KitApiOptions { ApiKey = apiKey });
var status = await api.StatusAsync("user-1");
if (status.Active)
{
    UnlockPremium(status.Subscription?.ProductId);
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val api = KitApi(apiKey = System.getenv("OPENIAP_API_KEY")!!)
val status = api.status("user-1")
if (status.active) unlockPremium(status.subscription?.productId)`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var api := KitApi.new(api_key)
var status := await api.status("user-1")
if status.active:
    unlock_premium(status.subscription.product_id)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="product-sync" level="h2">
          Product sync
        </AnchorLink>
        <p>
          kit's <code>products</code> table is a cache of every productId your
          app uses. The sync action runs against App Store Connect (using a
          freshly-minted ES256 JWT signed with the project's <code>.p8</code>)
          and Play Developer API (using the project's service account JSON) and
          supports three directions:
        </p>
        <ul>
          <li>
            <strong>pull</strong> — pull every IAP / subscription from the
            upstream store into kit.
          </li>
          <li>
            <strong>push</strong> — push every <code>state: "Draft"</code> kit
            row to the upstream store.
          </li>
          <li>
            <strong>both</strong> — default; pull then push so the catalog
            converges.
          </li>
        </ul>
        <p>
          Sync is asynchronous —{' '}
          <code>
            POST /v1/products/&#123;apiKey&#125;/sync/&#123;ios|android&#125;
          </code>{' '}
          enqueues a job and returns <code>&#123; jobId, deduped &#125;</code>{' '}
          with HTTP 202 immediately. The actual catalog walk (App Store Connect
          REST or Play Developer API) runs in the background as a Convex
          internalAction, writing progress and the final result back to a{' '}
          <code>productSyncJobs</code> row. Earlier kit versions held the HTTP
          connection open for the entire sync, which iOS Safari aborted on
          cellular / backgrounded tabs as <code>TypeError: Load failed</code>.
        </p>
        <p>Clients poll the job state:</p>
        <ul>
          <li>
            <code>
              GET /v1/products/&#123;apiKey&#125;/sync/jobs/&#123;jobId&#125;
            </code>{' '}
            — current status (<code>queued</code> / <code>running</code> /{' '}
            <code>succeeded</code> / <code>failed</code>),{' '}
            <code>progress.phase</code>, and on terminal status the{' '}
            <code>result</code> object with <code>pulled</code> /{' '}
            <code>pushed</code> counts and per-product <code>failures</code>{' '}
            (price-tier conflicts, locale issues, missing review notes). When
            more than 200 products fail, <code>failuresTruncated: true</code> is
            set and the array is capped.
          </li>
          <li>
            <code>
              POST
              /v1/products/&#123;apiKey&#125;/sync/jobs/&#123;jobId&#125;/cancel
            </code>{' '}
            — request a cancel; the worker checks at phase boundaries (PULL.iaps
            → PULL.subscriptions → PUSH.drafts) and stops within seconds.
          </li>
        </ul>
        <p>
          Backoff polls at ~3s intervals until <code>status</code> is{' '}
          <code>succeeded</code> or <code>failed</code>. Most catalogs finish in
          tens of seconds; large ones in 1–2 minutes. A{' '}
          <code>reapStaleProductSyncJobs</code> cron flips workers stuck past
          the 9-minute deadline to <code>failed</code> so a crashed action can't
          pin the project's "active job" slot.
        </p>
      </section>

      <section>
        <AnchorLink id="mcp" level="h2">
          MCP server
        </AnchorLink>
        <p>
          <code>@hyodotdev/openiap-mcp-server</code> is a stdio Model Context
          Protocol server with 10 tools covering setup, status checks,
          troubleshooting, product CRUD, subscription listing, sandbox
          simulation, and full-state inspection. Plug it into Claude Desktop /
          Cursor / Codex via:
        </p>
        <CodeBlock language="json">{`{
  "mcpServers": {
    "openiap": {
      "command": "bunx",
      "args": ["@hyodotdev/openiap-mcp-server"],
      "env": {
        "OPENIAP_API_KEY": "openiap-kit_<your-key>",
        "OPENIAP_BASE_URL": "https://kit.openiap.dev"
      }
    }
  }
}`}</CodeBlock>
        <p>
          Every tool funnels through the same kit HTTP surface as the dashboard
          and the SDKs, so an LLM action ("disable this product on Android") and
          a manual edit produce identical state changes.
        </p>
      </section>
    </div>
  );
}

export default KitBackend;
