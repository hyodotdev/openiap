import type { ReactNode } from "react";
import {
  ArrowDown,
  BarChart3,
  Boxes,
  ExternalLink,
  KeyRound,
  Repeat,
  ShieldCheck,
  Terminal,
  Webhook,
} from "lucide-react";
import { Link } from "react-router-dom";

import Footer from "../components/Footer";
import GetStartedButton from "../components/GetStartedButton";
import { ProductPreview } from "../components/ProductPreview";

const COMMERCE_PROTOCOL_URL = "https://openiap.dev/commerce-protocol";

const STORES = ["App Store", "Google Play", "Amazon Appstore", "Meta Horizon"];

// Logos copied from openiap.dev (packages/docs/public); Expo's is black.
const SDKS: { name: string; logo: string; invertInDark?: boolean }[] = [
  { name: "React Native", logo: "/logos/react.webp" },
  { name: "Expo", logo: "/logos/expo.webp", invertInDark: true },
  { name: "Flutter", logo: "/logos/flutter.webp" },
  { name: "Kotlin Multiplatform", logo: "/logos/kotlin.webp" },
  { name: ".NET MAUI", logo: "/logos/dotnet.webp" },
  { name: "Godot", logo: "/logos/godot.webp" },
];

const ROLES: { name: string; icon: ReactNode }[] = [
  { name: "Verification", icon: <ShieldCheck className="h-4 w-4" /> },
  { name: "Subscriptions", icon: <Repeat className="h-4 w-4" /> },
  { name: "Entitlements", icon: <KeyRound className="h-4 w-4" /> },
  { name: "Revenue", icon: <BarChart3 className="h-4 w-4" /> },
];

const CAPABILITIES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Purchase verification",
    body: "Each purchase is checked with the store that sold it.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: "Subscriptions and access",
    body: "Store notifications keep renewals, refunds and expiry current.",
    icon: <Repeat className="h-5 w-5" />,
  },
  {
    title: "Revenue analytics",
    body: "Revenue, refunds, trials and cohorts in your reporting currency.",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: "Events to your backend",
    body: "Signed webhooks whenever a subscription or access changes.",
    icon: <Webhook className="h-5 w-5" />,
  },
  {
    title: "Product catalog",
    body: "Sync products and prices with App Store Connect and Google Play.",
    icon: <Boxes className="h-5 w-5" />,
  },
  {
    title: "Dashboard, CLI and MCP",
    body: "Search purchases, look up orders, and manage it all from AI tools.",
    icon: <Terminal className="h-5 w-5" />,
  },
];

const PROTOCOL_ROLES: { who: string; what: string }[] = [
  { who: "From your app", what: "Verify a purchase with a publishable key." },
  {
    who: "From your backend",
    what: "Read entitlements and subscription status, and bind purchases to your users.",
  },
  {
    who: "To your backend",
    what: "Signed lifecycle events, retried with backoff.",
  },
];

function Connector({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 py-2.5 pl-5 text-xs font-medium text-muted-foreground"
      aria-hidden="true"
    >
      <ArrowDown className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

/** Where IAPKit sits between the app and the stores, as a protocol provider. */
function RoleDiagram() {
  return (
    <figure
      aria-label="Your app runs the purchase with an OpenIAP SDK. IAPKit, a Commerce Protocol provider, checks it with the store and sends events to your backend."
      className="w-full max-w-md"
    >
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="font-semibold text-foreground">{"Your app"}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {"An OpenIAP SDK runs the purchase."}
        </p>
      </div>
      <Connector label="sends the purchase" />
      <div className="rounded-xl border-2 border-[var(--primary-600)] bg-card shadow-[0_24px_60px_-28px_rgba(58,37,31,0.55)]">
        <div className="px-5 pt-5">
          <p className="text-xl font-bold tracking-tight text-foreground">
            {"IAPKit"}
          </p>
          <a
            href={COMMERCE_PROTOCOL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary-700)] underline-offset-4 hover:underline dark:text-[var(--primary-300)]"
          >
            {"Implements the OpenIAP Commerce Protocol"}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-px border-y border-border bg-border">
          {ROLES.map((role) => (
            <li
              key={role.name}
              className="flex items-center gap-2 bg-card px-5 py-3 text-sm font-medium text-foreground"
            >
              <span className="text-[var(--primary-600)]" aria-hidden="true">
                {role.icon}
              </span>
              {role.name}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 px-5 py-3.5 text-sm text-muted-foreground">
          <Webhook className="h-4 w-4 shrink-0" aria-hidden="true" />
          {"Sends events and entitlements to your backend."}
        </p>
      </div>
      <Connector label="checks with the store" />
      <ul className="grid grid-cols-2 gap-2">
        {STORES.map((store) => (
          <li
            key={store}
            className="rounded-lg bg-secondary px-3 py-2 text-center text-sm font-medium text-foreground"
          >
            {store}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <>
      <section>
        <div className="container max-w-7xl mx-auto pt-16 md:pt-24">
          <div>
            <h1 className="max-w-3xl text-[2.75rem] font-bold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-6xl">
              {"The open backend for in\u2011app purchases."}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {
                "IAPKit verifies purchases, keeps subscriptions and access current, reports revenue, and tells your backend when anything changes."
              }
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <GetStartedButton className="btn-gradient btn-lg" />
              <Link to="/docs" className="btn-secondary btn-lg">
                {"Read the docs"}
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {"Open source and free. "}
              <Link to="/pricing" className="link">
                {"Sustained by sponsors"}
              </Link>
              {"."}
            </p>
          </div>
          <div className="mt-14 md:mt-16">
            <ProductPreview />
          </div>
        </div>
      </section>

      <section className="mt-16 border-y border-border bg-muted/50 md:mt-20">
        <div className="container max-w-7xl mx-auto py-10">
          <p className="text-sm font-medium text-muted-foreground">
            {"Built into the OpenIAP SDKs"}
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
            {SDKS.map((sdk) => (
              <li key={sdk.name} className="flex items-center gap-3">
                <img
                  src={sdk.logo}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  className={`h-7 w-7 object-contain ${
                    sdk.invertInDark ? "dark:invert" : ""
                  }`}
                />
                <span className="text-[15px] font-medium text-foreground">
                  {sdk.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="py-20 md:py-24">
        <div className="container max-w-7xl mx-auto">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {"Everything after the purchase"}
          </h2>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            {"One service from the first verification to the monthly report."}
          </p>
          <ul className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-[var(--primary-700)] dark:text-[var(--primary-300)]"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border py-20 md:py-24">
        <div className="container max-w-7xl mx-auto grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-24">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {"Built on an open standard"}
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {"IAPKit implements the "}
              <a
                href={COMMERCE_PROTOCOL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                {"OpenIAP Commerce Protocol"}
              </a>
              {
                ", an open server API shared by verification providers, paywall and data services, and your own backend. Code written against it works with any provider that supports the same stores."
              }
            </p>
            <dl className="mt-8 max-w-xl divide-y divide-border border-y border-border">
              {PROTOCOL_ROLES.map((role) => (
                <div
                  key={role.who}
                  className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"
                >
                  <dt className="font-semibold text-foreground">{role.who}</dt>
                  <dd className="text-muted-foreground">{role.what}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6">
              <Link to="/docs/commerce-protocol" className="link font-medium">
                {"IAPKit's protocol endpoint"}
              </Link>
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <RoleDiagram />
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-24">
        <div className="container max-w-7xl mx-auto">
          <div className="flex flex-col gap-8 rounded-2xl bg-secondary px-8 py-10 md:flex-row md:items-center md:justify-between md:px-12">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {"Free, sustained by sponsors"}
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                {
                  "No paid plans. Organizations with larger revenue are asked to sponsor the shared service."
                }
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <GetStartedButton className="btn-gradient btn-lg" />
              <Link to="/pricing" className="btn-secondary btn-lg">
                {"See pricing"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
