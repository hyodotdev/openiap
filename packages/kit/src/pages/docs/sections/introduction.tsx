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
    body: "Verify from the app with a publishable key.",
    slug: "quickstart",
  },
  {
    title: "App and your backend",
    body: "Your server confirms each purchase and grants access.",
    slug: "purchase-flow",
  },
  {
    title: "Events to your backend",
    body: "Receive signed renewal, refund and expiry events.",
    slug: "webhooks",
  },
  {
    title: "AI tools",
    body: "Manage products from Claude Code, Codex or any MCP client.",
    slug: "ai-assistants",
  },
];

export default function IntroductionPage() {
  return (
    <DocsPage
      slug=""
      title="Introduction"
      description="IAPKit checks each purchase with the store and tells your app or backend whether to grant access."
    >
      <p>
        It works with the App Store, Google Play, Amazon Appstore and Meta
        Horizon. IAPKit is open source (MIT), managed by OpenIAP, and one
        provider of the open{" "}
        <a
          href="https://openiap.dev/commerce-protocol"
          className="text-primary underline"
        >
          Commerce Protocol
        </a>
        ; other providers and your own backend implement the same operations.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Choose your path</h2>
      <div className="my-6 grid gap-3 sm:grid-cols-2">
        {PATHS.map((path) => (
          <Link
            key={path.slug}
            to={`/docs/${path.slug}`}
            className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <p className="font-semibold text-foreground">{path.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{path.body}</p>
          </Link>
        ))}
      </div>

      <Callout kind="note" title="Which key goes where">
        <p>
          Publishable <code>openiap-kit_pk_</code> keys can ship in your app.
          Secret <code>openiap-kit_sk_</code> keys stay on your servers. See{" "}
          <Link to="/docs/projects" className="text-primary underline">
            Projects & API keys
          </Link>
          .
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Cost and limits</h2>
      <p>
        Free on shared capacity, with fair-use limits and no SLA. Expecting
        heavy traffic? Contact the maintainers or self-host. See{" "}
        <Link to="/docs/operations" className="text-primary underline">
          Operations
        </Link>
        . Organizations with larger revenue are asked to sponsor; see{" "}
        <Link to="/pricing" className="text-primary underline">
          Pricing
        </Link>
        .
      </p>
      <p>
        IAPKit verifies purchases and keeps entitlement state. It does not build
        paywalls, run experiments or send campaigns.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Supported stores</h2>
      <div className="my-6 grid gap-3 sm:grid-cols-2">
        <StoreCard
          icon={<Apple className="h-5 w-5" />}
          title="Apple App Store"
          detail="StoreKit 2 JWS, checked with Apple."
          slug="verification/apple"
        />
        <StoreCard
          icon={<Smartphone className="h-5 w-5" />}
          title="Google Play"
          detail="Purchase tokens, checked with Google Play."
          slug="verification/google"
        />
        <StoreCard
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Amazon Appstore"
          detail="Fire OS and Vega OS receipts through Amazon RVS."
          slug="verification/amazon"
        />
        <StoreCard
          icon={<Headset className="h-5 w-5" />}
          title="Meta Horizon"
          detail="Quest entitlements; the App Secret stays server-side."
          slug="verification/horizon"
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
      className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {detail}
        </span>
      </span>
    </Link>
  );
}
