import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { DocsPage } from "../components/DocsPage";

const METRICS: Array<{ name: string; definition: string }> = [
  {
    name: "Revenue",
    definition:
      "Gross store list price of paid charges: direct paid starts, trial conversions, renewals, and billing recoveries. Free trial periods add 0. Before store fees and refunds.",
  },
  {
    name: "Refunded / net revenue",
    definition:
      "Refunded is the amount the store reports on refund notifications, less refund reversals. Net revenue is revenue minus refunded.",
  },
  {
    name: "New subscriptions",
    definition:
      "Subscription starts, free trials included. An Apple refund reversal restores access but is not a new subscription.",
  },
  {
    name: "Trials started",
    definition:
      "Starts whose store offer data says free trial: Apple's offerDiscountType, Google's purchased offer matched against the synced Play catalog.",
  },
  {
    name: "Trial conversions",
    definition:
      "A subscription's first paid charge after its free trial. It is not counted as a renewal.",
  },
  {
    name: "Direct paid starts",
    definition: "A first paid charge delivered as a start, with no trial.",
  },
  {
    name: "Renewals",
    definition:
      "Paid renewals and billing recoveries, except a trial's first charge.",
  },
  {
    name: "Auto-renew off",
    definition:
      "Auto-renew turned off, less turned back on. Access continues until the paid period ends, so this is not churn.",
  },
  {
    name: "Expirations / churn",
    definition:
      "Expirations count paid access that actually ended. Churn is expirations in the period divided by active subscriptions at the start of the period.",
  },
  {
    name: "Refunds",
    definition:
      "Refund notifications less refund reversals. Apple Family Sharing revocations are not refunds.",
  },
  {
    name: "Active subscriptions",
    definition:
      "End-of-day count of subscriptions with access, including free trials (shown separately). Billing retry has no access; grace period does.",
  },
];

export default function AnalyticsPage() {
  return (
    <DocsPage
      slug="analytics"
      title="Analytics"
      description="Subscription revenue, trials, retention, and churn from verified store notifications, rolled up into daily UTC buckets."
    >
      <p>
        The <strong>Analytics</strong> tab reports what your purchase
        infrastructure did: charges, trials, conversions, cancellations,
        expirations, refunds, and monthly cohorts across App Store and Google
        Play. Every number comes from verified Apple App Store Server
        Notifications v2 and Google Play Real-time Developer Notifications on
        the server. Filter by range, period, platform, product, currency, and
        environment.
      </p>

      <Callout kind="warning" title="Analytics requires store notifications">
        <p>
          <code>/v1/purchase/verify</code> alone doesn&apos;t tell IAPKit when a
          renewal, cancellation, or refund happens, and a restore never counts
          as a purchase. Follow the{" "}
          <Link to="/docs/webhooks" className="text-primary underline">
            Store webhooks guide
          </Link>{" "}
          to register the project&apos;s lifecycle URL with App Store Connect
          and Play Console. The next rollup, within about 10 minutes, fills the
          tab.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Setup checklist</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Configure store credentials per the{" "}
          <Link className="underline" to="/docs/verification/apple">
            Apple
          </Link>{" "}
          /{" "}
          <Link className="underline" to="/docs/verification/google">
            Google
          </Link>{" "}
          setup pages. For Google trial detection, also sync the Play catalog so
          IAPKit knows which offers start with a free trial.
        </li>
        <li>
          Open the project&apos;s <strong>Webhooks</strong> tab and copy the
          lifecycle webhook URL. It accepts Apple ASN v2 and Google RTDN.
        </li>
        <li>
          <strong>Apple</strong>: in App Store Connect →{" "}
          <em>App Store Server Notifications</em>, paste the URL and select{" "}
          <code>Version 2</code> for Production and Sandbox.
        </li>
        <li>
          <strong>Google</strong>: in Play Console → <em>Monetization setup</em>
          , point Real-time Developer Notifications to a Pub/Sub topic with a
          push subscription to the URL.
        </li>
        <li>
          Send a test notification from each store console, then complete a
          sandbox purchase and switch the tab to <strong>Sandbox</strong> to see
          it.
        </li>
      </ol>

      <h2 className="mt-10 text-2xl font-semibold">Metric definitions</h2>
      <p>
        Days and months are UTC. Revenue is the store&apos;s list price in the
        charge&apos;s currency, before store fees, taxes, and payouts, which
        IAPKit never sees. Use your store financial reports for settlement.
      </p>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[36rem] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Metric</th>
              <th className="px-3 py-2 text-left font-medium">Definition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {METRICS.map((metric) => (
              <tr key={metric.name}>
                <td className="px-3 py-2 align-top font-medium">
                  {metric.name}
                </td>
                <td className="px-3 py-2">{metric.definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>Sandbox.</strong> Production is the default everywhere,
          including MRR and live counts. Sandbox and Xcode purchases appear only
          when you switch the tab, or pass <code>environment=sandbox</code>.
        </li>
        <li>
          <strong>Google intro prices.</strong> Play reports a base plan&apos;s
          recurring price, so a discounted introductory phase is booked at that
          list price. Free trials are booked at 0.
        </li>
        <li>
          <strong>Unknown trial status.</strong> A Google offer missing from the
          synced catalog is treated as paid.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Cohorts and realized LTV</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>Cohort</strong>: the UTC month of a subscription&apos;s first
          paid charge, as a direct paid start or a trial conversion. A
          subscription whose first observed charge is a renewal started before
          IAPKit saw it and is left out.
        </li>
        <li>
          <strong>Retention M+k</strong>: the share of the cohort with paid
          access at the end of month k. A canceled subscription stays retained
          until its paid period ends; a refund ends it at the refund.
        </li>
        <li>
          <strong>Realized LTV</strong>: gross revenue observed from the cohort
          through the observation date, divided by its members, in one currency.
          It is never projected.
        </li>
        <li>
          <strong>Trial-to-paid rate</strong>: conversions divided by the trials
          of that month that have ended. Trials still running are left out of
          the denominator.
        </li>
      </ul>
      <p>
        Cohorts cover the last 24 months, rebuild once a day, and start from the
        release that added them: earlier charges are not retained, so they are
        not backfilled.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Freshness and data state</h2>
      <p>
        A 10-minute rollup recomputes the trailing 3 UTC days, so a notification
        up to about 2 days late lands on its own day. A later one is reported as
        pending and triggers a catch-up recompute from its day, at most every 6
        hours. A notification that arrives more than 30 days after it happened,
        past event retention, is not counted.
      </p>
      <p className="mt-3">Each response says which state a window is in:</p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <code>not_collected</code>: no store notification has reached the
          project.
        </li>
        <li>
          <code>processing</code>: notifications arrived but the window is not
          rolled up yet.
        </li>
        <li>
          <code>zero</code>: the window was rolled up and nothing happened.
          These zeros are real.
        </li>
        <li>
          <code>ready</code>: the window has data. <code>lastRunAt</code> says
          when it was computed.
        </li>
      </ul>
      <p>
        Rows before <code>definitionsFromDay</code> were computed under earlier
        definitions: they include sandbox purchases and have no trial split.
        Trial starts and conversions are classified for notifications received
        from this release on; the retained 30 days are rebuilt once with the
        other fixes, but earlier notifications keep their old trial treatment.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">API and MCP</h2>
      <p>
        <code>GET /v1/subscriptions/revenue?fromDay=&amp;toDay=</code> with a
        secret key returns the daily rows. Optional{" "}
        <code>environment=sandbox</code> and <code>cohorts=true</code> add the
        sandbox series and the cohort rows. The MCP{" "}
        <code>iapkit_revenue_analytics</code> tool takes the same options and
        returns the definitions with its totals.
      </p>

      <Callout kind="note" title="Analytics never gate access">
        <p>
          Verification, restore, and entitlement reads never read analytics. If
          an analytics write fails, the subscription update still commits.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Currency &amp; FX</h2>
      <p>
        Rows are keyed by currency and never summed across currencies. The
        project&apos;s reporting currency drives the headline totals; other
        currencies stay visible as separate slices. IAPKit does not convert
        currencies or reconcile payouts.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Limitations</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>No country split.</strong> Store notifications don&apos;t
          carry the buyer&apos;s country.
        </li>
        <li>
          <strong>Amazon and Meta Horizon</strong> are not in these series: they
          report no authoritative price.
        </li>
        <li>
          <strong>Google voided purchases</strong> carry no amount, so their
          refunds count without reducing net revenue.
        </li>
        <li>
          <strong>Raw events are kept 30 days.</strong> Daily rows and cohorts
          are kept, so history survives the sweep.
        </li>
      </ul>
    </DocsPage>
  );
}
