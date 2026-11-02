import { openAuthModal } from "../lib/signals";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

interface ReceiptLine {
  field: string;
  value: string;
}

// A real /v1/purchase/verify response shape (route-response-schemas.ts).
const RECEIPT_LINES: ReceiptLine[] = [
  { field: "store", value: "apple" },
  { field: "environment", value: "Production" },
  { field: "productId", value: "premium_monthly" },
  { field: "transactionId", value: "2000000812345678" },
  { field: "state", value: "ENTITLED" },
];

interface LandingRow {
  title: string;
  body: string;
}

const FEATURES: LandingRow[] = [
  {
    title: "Verified with the store",
    body: "IAPKit asks the App Store, Google Play, Amazon Appstore or Meta Horizon about each purchase and returns isValid, state and the store-verified productId before you deliver anything.",
  },
  {
    title: "One request for every store",
    body: "Send each store's purchase evidence to one endpoint and read one result shape back. The OpenIAP framework SDKs make the call for you in their purchase flow.",
  },
  {
    title: "Receipts you can inspect",
    body: "Search receipts, inspect payloads, review analytics and re-run a verification from the dashboard instead of digging through logs.",
  },
];

const STEPS: LandingRow[] = [
  {
    title: "Buy with your billing library",
    body: "Collect the purchase evidence the App Store, Google Play, Horizon or Amazon library already returns.",
  },
  {
    title: "Send the evidence to IAPKit",
    body: "Call /v1/purchase/verify from your app with a publishable key, or from your own backend.",
  },
  {
    title: "Unlock on a valid verdict",
    body: "Deliver the item only when isValid is true, then finish the transaction.",
  },
];

const CAPACITY_NOTES: LandingRow[] = [
  {
    title: "Everyday use",
    body: "No billing meter. Capacity is shared, so heavy traffic from other projects can slow your requests or return 429. Cache stable reads and honor the Retry-After header on 429 and 503.",
  },
  {
    title: "Heavy traffic",
    body: "Contact us before launch. An organization that uses a large share of the shared capacity is asked to help fund servers, monitoring and security.",
  },
  {
    title: "Dedicated capacity",
    body: "Self-host the MIT-licensed server. Sponsorship supports the shared service; it does not reserve resources or add an SLA.",
  },
];

/** A landing section: heading column on the left, ruled content on the right. */
function LedgerSection({
  id,
  title,
  lead,
  children,
}: {
  id?: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-b border-border py-16 lg:py-24">
      <div className="container max-w-7xl mx-auto grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-muted-foreground">{lead}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function VerificationReceipt() {
  return (
    <figure className="w-full max-w-md rounded-md border border-border bg-card shadow-sm">
      <figcaption className="flex flex-col gap-0.5 border-b border-border px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="font-medium text-foreground">
          {"Verification result"}
        </span>
        <code className="font-mono text-xs text-muted-foreground">
          {"POST /v1/purchase/verify"}
        </code>
      </figcaption>
      <dl className="divide-y divide-border px-5">
        {RECEIPT_LINES.map((line, index) => (
          <div
            key={line.field}
            className="receipt-line flex items-baseline justify-between gap-4 py-2.5"
            style={{ animationDelay: `${200 + index * 140}ms` }}
          >
            <dt className="text-sm text-muted-foreground">{line.field}</dt>
            <dd className="truncate font-mono text-sm text-foreground">
              {line.value}
            </dd>
          </div>
        ))}
      </dl>
      <div
        className="receipt-line flex items-center justify-between gap-4 rounded-b-md border-t border-border bg-success/10 px-5 py-3"
        style={{ animationDelay: `${200 + RECEIPT_LINES.length * 140}ms` }}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {"Confirmed by the App Store"}
        </span>
        <code className="font-mono text-sm font-medium text-success">
          {"isValid: true"}
        </code>
      </div>
    </figure>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <>
      <section className="hero-background border-b border-border py-16 lg:py-24">
        <div className="container max-w-7xl mx-auto">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-foreground md:text-5xl lg:text-6xl">
                {"Check every purchase with the store before you unlock it."}
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
                {"IAPKit, managed by "}
                <a
                  href="https://openiap.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                >
                  {"OpenIAP"}
                </a>
                {
                  ", sends your app's purchase evidence to the App Store, Google Play, Amazon Appstore or Meta Horizon and returns one verdict your app or backend can act on."
                }
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    openAuthModal();
                  }}
                  className="btn-gradient px-6 py-3 text-base"
                >
                  {"Get started"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigate("/docs");
                  }}
                  className="btn-secondary px-6 py-3 text-base"
                >
                  {"Read the docs"}
                </button>
              </div>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {
                  "Hosted IAPKit is free under fair-use limits on shared capacity. The server is MIT-licensed, so you can run your own."
                }
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <VerificationReceipt />
            </div>
          </div>
        </div>
      </section>

      <LedgerSection
        id="features"
        title="One verdict for four stores"
        lead="IAPKit holds your store credentials, asks the store about each purchase, and normalizes the answer."
      >
        <dl className="divide-y divide-border border-y border-border">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="grid gap-1 py-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6"
            >
              <dt className="font-medium text-foreground">{feature.title}</dt>
              <dd className="text-muted-foreground">{feature.body}</dd>
            </div>
          ))}
        </dl>
      </LedgerSection>

      <LedgerSection
        title="How it fits in your app"
        lead="Your billing library still runs the purchase. IAPKit answers whether the store agrees."
      >
        <div className="space-y-8">
          <ol className="divide-y divide-border border-y border-border">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 py-5">
                <span className="font-mono text-sm text-muted-foreground">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <figure className="min-w-0 rounded-md border border-border bg-card text-sm">
            <figcaption className="border-b border-border px-5 py-3 font-medium text-foreground">
              {"Request and response"}
            </figcaption>
            <pre className="overflow-x-auto px-5 py-4 font-mono text-foreground">
              <code>{`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_pk_<your-publishable-key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "store": "google", "purchaseToken": "<purchaseToken>" }'`}</code>
            </pre>
            <pre className="overflow-x-auto border-t border-border px-5 py-4 font-mono text-foreground">
              <code>{`{
  "store": "google",
  "isValid": true,
  "state": "ENTITLED",
  "productId": "premium_monthly"
}`}</code>
            </pre>
          </figure>
        </div>
      </LedgerSection>

      <LedgerSection
        id="pricing"
        title="Free on shared capacity"
        lead="Hosted IAPKit is an open-source service that every developer shares. It has fair-use rate limits and no SLA."
      >
        <dl className="divide-y divide-border border-y border-border">
          {CAPACITY_NOTES.map((note) => (
            <div
              key={note.title}
              className="grid gap-1 py-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6"
            >
              <dt className="font-medium text-foreground">{note.title}</dt>
              <dd className="text-muted-foreground">{note.body}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <a
            href="https://github.com/sponsors/hyodotdev"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gradient px-6 py-3"
          >
            {"Sponsor on GitHub"}
          </a>
          <a
            href="https://opencollective.com/openiap"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary px-6 py-3"
          >
            {"Support on OpenCollective"}
          </a>
          <a
            href="https://github.com/hyodotdev/openiap/tree/main/packages/kit#deployment-convex--flyio"
            target="_blank"
            rel="noopener noreferrer"
            className="link px-1 py-2 text-sm"
          >
            {"Self-host IAPKit"}
          </a>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          {"For capacity planning or a written service agreement, email "}
          <a href="mailto:hyo@hyo.dev" className="link">
            {"hyo@hyo.dev"}
          </a>
          {" before your production launch."}
        </p>
      </LedgerSection>

      <section className="hero-background py-16 lg:py-24">
        <div className="container max-w-7xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {"Start verifying purchases"}
          </h2>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            {
              "Create a project, add your store credentials, and send your first verification."
            }
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                openAuthModal();
              }}
              className="btn-gradient px-6 py-3 text-base"
            >
              {"Get started"}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigate("/docs");
              }}
              className="btn-secondary px-6 py-3 text-base"
            >
              {"Read the docs"}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </>
  );
}
