import type { ReactNode } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import {
  ADVISORY_USD,
  GRACE_PERIOD_MS,
  REQUEST_USD,
  SUGGESTED_RATE,
  suggestedSponsorshipUsd,
} from "../../convex/sponsorship/logic";
import Footer from "../components/Footer";
import GetStartedButton from "../components/GetStartedButton";

const INCLUDED = [
  "Purchase verification for all four stores",
  "Subscriptions, entitlements and store notifications",
  "Revenue analytics and purchase search",
  "Webhooks, product sync, CLI and MCP",
];

const usd = (amount: number) => `$${amount.toLocaleString("en-US")}`;
const GRACE_DAYS = GRACE_PERIOD_MS / 86_400_000;

// The staged sponsorship policy; the terms of service point here.
const STAGES: { revenue: string; outcome: ReactNode }[] = [
  {
    revenue: `Under ${usd(ADVISORY_USD)}`,
    outcome: "Nothing changes. Use IAPKit freely.",
  },
  {
    revenue: `${usd(ADVISORY_USD)} or more`,
    outcome: "We email you about sponsoring, with self-hosting options.",
  },
  {
    revenue: `${usd(REQUEST_USD)} or more`,
    outcome: (
      <>
        {`We ask you to sponsor and give you ${GRACE_DAYS} days to reply. We suggest `}
        <strong className="font-semibold text-foreground">
          {`${SUGGESTED_RATE * 100}% of monthly revenue`}
        </strong>
        {`, about ${usd(suggestedSponsorshipUsd(REQUEST_USD))} a month at ${usd(REQUEST_USD)}.`}
      </>
    ),
  },
  {
    revenue: `No reply after ${GRACE_DAYS} days`,
    outcome:
      "We may pause management features: the dashboard and analytics, product sync, MCP writes and new API keys.",
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-14">
      <div className="container max-w-4xl mx-auto grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <div className="text-muted-foreground [&_p+p]:mt-3">{children}</div>
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <>
      <section className="py-16 md:py-24">
        <div className="container max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            {"Free, sustained by sponsors"}
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-relaxed text-muted-foreground">
            {
              "IAPKit has no paid plans. Every developer shares one hosted service, and sponsors keep it running."
            }
          </p>

          <div className="mt-12 rounded-2xl border-2 border-primary bg-card p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {"Hosted IAPKit"}
                </p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">
                  {"$0"}
                  <span className="ml-2 text-base font-medium text-muted-foreground">
                    {"no credit card"}
                  </span>
                </p>
              </div>
              <GetStartedButton className="btn-gradient btn-lg" />
            </div>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-2 text-foreground">
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Section title="When we ask for sponsorship">
        <p>
          {
            "Sponsorship should be a choice to support open source, and for almost everyone it stays that way. IAPKit, though, is one hosted pool every project shares, so organizations at the levels below are asked, with apologies, to sponsor their share. Thank you for understanding."
          }
        </p>
        <p>
          {
            "Each month we add up your organization’s production subscription MRR in US dollars, plus the last 30 days of charges for subscriptions whose billing period IAPKit does not know yet. Sandbox and one-time purchases are not counted."
          }
        </p>
        <dl className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {STAGES.map((stage) => (
            <div
              key={stage.revenue}
              className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6"
            >
              <dt className="font-semibold text-foreground">{stage.revenue}</dt>
              <dd>{stage.outcome}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex gap-3 rounded-xl border border-success/30 bg-success/5 p-5">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-success"
            aria-hidden="true"
          />
          <p className="text-foreground">
            {
              "Purchase verification, store notifications and webhooks never stop at any stage, so your users always get what they paid for."
            }
          </p>
        </div>
      </Section>

      <Section title="Sponsor">
        <p>
          {
            "Sponsorship pays for servers, monitoring and security. It does not reserve capacity or add an SLA."
          }
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href="https://github.com/sponsors/hyodotdev"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gradient"
          >
            {"GitHub Sponsors"}
          </a>
          <a
            href="https://opencollective.com/openiap"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            {"OpenCollective"}
          </a>
        </div>
      </Section>

      <Section title="Shared capacity">
        <p>
          {
            "Every project shares one pool with fair-use rate limits. Heavy traffic from others can slow your requests or return 429. "
          }
          <Link to="/docs/operations" className="link">
            {"See the limits"}
          </Link>
          {"."}
        </p>
        <p>
          {"Planning a large launch? Email "}
          <a href="mailto:hyo@hyo.dev" className="link">
            {"hyo@hyo.dev"}
          </a>
          {" first."}
        </p>
      </Section>

      <Section title="Self-host">
        <p>
          {
            "The server is MIT-licensed. Run your own for dedicated capacity, with no rate limits or sponsorship requests. "
          }
          <a
            href="https://github.com/hyodotdev/openiap/tree/main/packages/kit#deployment-convex--flyio"
            target="_blank"
            rel="noopener noreferrer"
            className="link"
          >
            {"Deployment guide"}
          </a>
          {"."}
        </p>
      </Section>

      <Footer />
    </>
  );
}
