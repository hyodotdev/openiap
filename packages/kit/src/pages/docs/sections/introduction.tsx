import { Link } from "react-router-dom";
import { Apple, Smartphone, Headset } from "lucide-react";

import { Callout } from "../components/Callout";
import { DocsPage } from "../components/DocsPage";

export default function IntroductionPage() {
  return (
    <DocsPage
      slug=""
      title="Introduction"
      description="IAPKit is a hosted receipt-validation API for Apple, Google, and Meta Horizon purchases. Managed by OpenIAP."
    >
      <p>
        <strong>IAPKit</strong>, managed by OpenIAP, is a receipt-validation
        backend that turns a mobile or VR in-app purchase into a signed,
        server-verified "did this user actually pay" answer. You send a
        store-specific receipt to <code>/v1/purchase/verify</code>, IAPKit calls
        the upstream store with credentials it already holds for your project,
        and returns a normalized <code>{`{ isValid, state }`}</code>
        result your backend can trust.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">When to reach for IAPKit</h2>
      <p>
        The client-side purchase APIs (StoreKit, Play Billing, Meta Horizon
        Billing) tell you a purchase <em>happened</em>. They do not tell you the
        user <em>still has an entitlement</em> — a refund, a chargeback, a
        revoked subscription, or a replayed receipt on a jailbroken device all
        look identical to a fresh purchase from the client's perspective.
        Validating server-to-server against Apple / Google / Meta is the only
        way to be certain, and that validation needs per-app credentials that
        have no business living on a customer device.
      </p>
      <p>
        IAPKit centralizes those credentials in one place, exposes one API your
        server calls with just an API key, and harmonizes the three stores' very
        different response shapes into a single lifecycle: <code>ENTITLED</code>
        , <code>PENDING_ACKNOWLEDGMENT</code>, <code>CANCELED</code>, and
        friends.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Supported stores</h2>
      <div className="my-6 grid gap-4 sm:grid-cols-3">
        <StoreCard
          icon={<Apple className="h-5 w-5" />}
          title="Apple App Store"
          detail="StoreKit 2 JWS receipts — signature verified against Apple root CA, live status checked via App Store Server API."
          slug="verification/apple"
        />
        <StoreCard
          icon={<Smartphone className="h-5 w-5" />}
          title="Google Play"
          detail="Purchase tokens resolved via Android Publisher v3 (products + subscriptions v2). Transient 5xx auto-retried."
          slug="verification/google"
        />
        <StoreCard
          icon={<Headset className="h-5 w-5" />}
          title="Meta Horizon"
          detail="Quest entitlements verified via Meta Graph API. App Secret stays server-side; clients send only (userId, sku)."
          slug="verification/horizon"
        />
      </div>

      <h2 className="mt-10 text-2xl font-semibold">Architecture</h2>
      <p>
        One Fly.io machine serves the dashboard, REST API, and the SPA under the
        same origin. Convex holds organizations, projects, API keys, store
        credentials, and persisted purchase rows; the Bun server front-ends{" "}
        <code>/api/v1/*</code> and the static dashboard build.
      </p>
      <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed">
        <code>{`  your backend / device          IAPKit                         upstream store
  ─────────────────────         ──────────────────            ─────────────────
     POST /v1/purchase/verify     apiKey → project
      Bearer <apiKey>    ───►     verify action      ───►     App Store / Play /
      { store, ... }                                           Meta Graph API
                                                          ◄── verified receipt
      { isValid, state } ◄───     harmonized state
`}</code>
      </pre>

      <Callout kind="tip" title="You're probably reading this in Dashboard">
        <p>
          These docs ship with IAPKit itself — every upgrade of the backend also
          upgrades the docs you're reading. The{" "}
          <Link to="/docs/release-notes" className="text-primary underline">
            release notes
          </Link>{" "}
          page records which changes landed in which deploy.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Next steps</h2>
      <ul className="my-4 list-disc space-y-1 pl-6">
        <li>
          <Link to="/docs/quickstart" className="text-primary underline">
            Quickstart
          </Link>{" "}
          — a five-minute path from signup to a green verify call.
        </li>
        <li>
          <Link to="/docs/api" className="text-primary underline">
            API reference
          </Link>{" "}
          — the one endpoint you call from your server, with every request shape
          and error code.
        </li>
        <li>
          <Link to="/docs/operations" className="text-primary underline">
            Operations
          </Link>{" "}
          — rate limits, correlation IDs, structured logs, graceful shutdown.
        </li>
      </ul>
    </DocsPage>
  );
}

function StoreCard({
  icon,
  title,
  detail,
  slug,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  slug: string;
}) {
  return (
    <Link
      to={`/docs/${slug}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
    >
      <div className="mb-2 flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </Link>
  );
}
