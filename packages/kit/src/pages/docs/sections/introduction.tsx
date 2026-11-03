import { Link } from "react-router-dom";
import { Apple, Smartphone, Headset, ShoppingBag } from "lucide-react";

import { Callout } from "../components/Callout";
import { DocsPage } from "../components/DocsPage";

interface DocsPath {
  title: string;
  body: string;
  slug: string;
}

const PATHS: DocsPath[] = [
  {
    title: "App only",
    body: "Verify purchases from the app with a publishable key; no backend needed.",
    slug: "quickstart",
  },
  {
    title: "App and your backend",
    body: "Your backend confirms each purchase, links it to the signed-in user, and grants access.",
    slug: "purchase-flow",
  },
  {
    title: "Events to your backend",
    body: "Receive signed renewal, refund, and expiry events at an HTTPS endpoint you register.",
    slug: "webhooks",
  },
  {
    title: "AI tools",
    body: "Let Claude Code, Codex, or another MCP client manage products and inspect purchases.",
    slug: "ai-assistants",
  },
];

export default function IntroductionPage() {
  return (
    <DocsPage
      slug=""
      title="Introduction"
      description="IAPKit checks your app's purchases with the store and tells your app or backend whether to grant access."
    >
      <p>
        <strong>IAPKit</strong> works with the App Store, Google Play, Amazon
        Appstore, and Meta Horizon. It is open source (MIT) and managed by
        OpenIAP.
      </p>
      <p>
        The OpenIAP client libraries run the purchase in your app. The{" "}
        <a
          href="https://openiap.dev/commerce-protocol"
          className="text-primary underline"
        >
          Commerce Protocol
        </a>{" "}
        is the open server API a backend uses to verify that purchase, read
        access, and receive lifecycle events. IAPKit is one service that
        implements it; other providers and your own backend implement the same
        operations, so compare capability descriptors for the stores and
        profiles you need.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Choose your path</h2>
      <div className="my-6 grid gap-4 sm:grid-cols-2">
        {PATHS.map((path) => (
          <Link
            key={path.slug}
            to={`/docs/${path.slug}`}
            className="block rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50"
          >
            <p className="font-medium">{path.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{path.body}</p>
          </Link>
        ))}
      </div>

      <Callout
        kind="note"
        title="No receipt server does not mean a secret in the app"
      >
        <p>
          Your app can call IAPKit directly with an <code>openiap-kit_pk_</code>{" "}
          publishable key, so you do not need a proxy just to verify a purchase;
          secret <code>openiap-kit_sk_</code> keys stay on your servers. You
          still need your own authenticated backend when resources on that
          backend are protected or when rules must remain private.{" "}
          <Link to="/docs/projects" className="text-primary underline">
            Projects & API keys
          </Link>{" "}
          lists what each key may do.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Cost and limits</h2>
      <p>
        The hosted service is free under fair-use limits, with no SLA. Capacity
        is shared, so heavy traffic from other projects can slow your requests
        or return <code>429</code>. Contact the maintainers before a launch that
        will use a large share, or self-host the MIT-licensed server. See{" "}
        <Link to="/docs/operations" className="text-primary underline">
          Operations
        </Link>{" "}
        for the limits and capacity planning.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">What IAPKit does not do</h2>
      <p>
        IAPKit verifies purchases, keeps subscription and entitlement state,
        syncs your store catalog, and reports purchase analytics. It does not
        build paywalls, run experiments, target audiences, or send marketing
        campaigns; products built for those can run on top of it.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Supported stores</h2>
      <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <StoreCard
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Amazon Appstore"
          detail="Fire OS and Vega OS receipts verified and periodically refreshed through Amazon RVS. Cloud Sandbox is disabled by default and requires an explicit project opt-in."
          slug="verification/amazon"
        />
      </div>
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
      className="block rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50"
    >
      <div className="mb-2 flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </Link>
  );
}
