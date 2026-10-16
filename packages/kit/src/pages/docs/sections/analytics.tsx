import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { DocsPage } from "../components/DocsPage";

const METRICS: Array<{ name: string; definition: string }> = [
  {
    name: "Revenue",
    definition:
      "Gross store list price of paid charges: paid starts, trial conversions, renewals, and billing recoveries. Free trials, free offer periods, and refund reversals add 0. Before store fees and refunds.",
  },
  {
    name: "Refunded / net revenue",
    definition:
      "Refunded is the amount the store reports on refund notifications, less refund reversals. Net revenue is revenue minus refunded.",
  },
  {
    name: "New subscriptions",
    definition:
      "Paid and free-trial subscription starts. An Apple resubscribe is a reactivation, counted as a renewal, unless it is the first charge after a lapsed trial. An Apple refund reversal restores access but is not a new subscription, and neither is a Google plan change or a free offer period.",
  },
  {
    name: "Trials started",
    definition:
      "Starts whose store offer data says free trial: an Apple introductory offer with offerDiscountType FREE_TRIAL, or Google's purchased offer matched against the synced Play catalog.",
  },
  {
    name: "Trial conversions",
    definition:
      "The paid charge that ends a subscription's free trial. It is not counted as a renewal; a purchase after a lapsed trial is a direct paid start.",
  },
  {
    name: "Direct paid starts",
    definition: "A first paid charge delivered as a start, with no trial.",
  },
  {
    name: "Renewals",
    definition:
      "Paid renewals, billing recoveries, Apple resubscribes, and Google plan changes Play charged at once. A trial's first charge is a trial conversion instead.",
  },
  {
    name: "Auto-renew off",
    definition:
      "Auto-renew turned off, less turned back on. Access continues until the paid period ends, so this is not churn.",
  },
  {
    name: "Expirations / churn",
    definition:
      "Expirations count paid access that actually ended; a free trial or free offer period that ended unpaid is not churn. Churn is expirations in the period divided by paid subscriptions active at its start; it shows — when the starting count or historical access evidence is incomplete.",
  },
  {
    name: "Refunds",
    definition:
      "Apple refunds and Google Play voided purchases, less refund reversals: one per refund. Revocations are not refunds: Apple's are Family Sharing removals, and Play's arrive with the voided purchase.",
  },
  {
    name: "Active subscriptions",
    definition:
      "End-of-day count of subscriptions with access (today: as of the latest run), including free trials (shown separately). Billing retry has no access; grace period does. Missing historical access is shown as —, not zero.",
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
          <strong>Sandbox.</strong> The daily series and cohorts are production
          by default; Sandbox and Xcode purchases appear when you switch the tab
          or pass <code>environment=sandbox</code>. Live counts and MRR are
          production only, with no sandbox view. A Google notification Play
          sends without an environment, such as a voided purchase, keeps its
          subscription&apos;s.
        </li>
        <li>
          <strong>Google plan changes.</strong> An upgrade, downgrade,
          re-signup, or prepaid top-up continues the subscription: it is not a
          new subscription, and the replaced purchase expiring is not churn. A
          prepaid top-up, or a change in the <code>CHARGE_FULL_PRICE</code> or{" "}
          <code>CHARGE_PRORATED_PRICE</code> mode, is a renewal at the new
          plan&apos;s list price, so a prorated charge is overstated. Other
          modes book nothing until the new plan renews.
        </li>
        <li>
          <strong>Apple upgrades and offers.</strong> An immediate upgrade adds
          no revenue until the next charge. Promotional, offer-code, and
          win-back offers are not trials: a free period from one books nothing,
          is not churn when it ends, and the charge after it is a renewal.
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

      <p>
        Historical access uses observed store boundaries at the last 24 UTC
        month ends and 30 day ends. It does not reconstruct missing periods from
        today's expiry. Apple charge and revocation dates locate their access
        changes; a current Play status fetch proves access only from its
        observation time. Existing rows and missing store dates can leave
        history unverified. Active totals and churn show — when their access
        evidence is incomplete.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Cohorts and realized LTV</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>Cohort</strong>: the UTC month of a subscription&apos;s first
          paid charge, as a direct paid start or a trial conversion. A
          subscription whose first observed charge is a renewal, or an Apple
          resubscribe with no trial before it, started before IAPKit saw it and
          is left out. A missing trusted start date also leaves it out.
        </li>
        <li>
          <strong>Retention M+k</strong>: the share of the cohort with paid
          access at the end of month k (current month: as of the latest
          rebuild). A canceled subscription stays retained until its paid period
          ends; a refund ends it at the refund. A later renewal or refund
          reversal does not fill an earlier lapse.
        </li>
        <li>
          <strong>Realized LTV</strong>: gross revenue observed from the cohort
          through the observation date, divided by its members, in one currency.
          It is never projected.
        </li>
        <li>
          <strong>Trial-to-paid rate</strong>: conversions divided by the trials
          of that month that have ended. Trials still running are left out of
          the denominator. The rate is unavailable when any trial lacks the
          evidence needed to decide its outcome.
        </li>
      </ul>
      <p>
        Cohorts include all products and platforms in the selected environment
        and currency. Date, product and platform filters apply only to daily
        metrics. Cohorts cover the last 24 months, rebuild once a day, and start
        from the release that added them: earlier charges are not retained, so
        they are not backfilled.
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
          <code>not_collected</code>: no Apple or Google notification for the
          selected environment has reached the project. Test notifications and
          re-syncs don&apos;t count, so a project that only verifies purchases
          stays here even though its active subscriptions have rows.
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
        Rows from <code>definitionsFromDay</code> on follow the definitions
        above. Earlier rows were computed under earlier definitions: they
        include sandbox purchases and have no trial split.
      </p>
      <p className="mt-3">
        Notifications stored before <code>trialSplitFromDay</code> lack the
        free-trial, refund-reversal, and resubscribe flags. Those days omit
        trial starts, conversions, direct paid starts, active trials, and
        expirations; on them, Google free trials count as paid starts, and Apple
        free trials, free offers, refund reversals, and resubscribes as new
        subscriptions. A trial that started earlier counts as paid until it
        ends. Churn starts the day after <code>trialSplitFromDay</code>, the
        first whose starting paid count excludes trials. It is unset when every
        day has the flags.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">API and MCP</h2>
      <p>
        <code>GET /v1/subscriptions/revenue?fromDay=&amp;toDay=</code> with a
        secret key returns the daily rows. Optional{" "}
        <code>environment=sandbox</code> and <code>cohorts=true</code> add the
        sandbox series and the cohort rows. Each response echoes its{" "}
        <code>environment</code>, <code>definitionsFromDay</code>, and{" "}
        <code>trialSplitFromDay</code>.{" "}
        <code>GET /v1/subscriptions/metrics</code> returns live counts and MRR
        with <code>environment: &quot;Production&quot;</code>. The MCP{" "}
        <code>iapkit_revenue_analytics</code> tool takes the revenue options and
        returns the definitions with its totals. Daily rows expose{" "}
        <code>activeHistoryComplete</code>; an absent or false flag means the
        numeric active count is incomplete. Cohort{" "}
        <code>retentionObserved[k]</code> must equal <code>members</code> before
        interpreting <code>retained[k]</code> as a rate. The MCP returns null
        for incomplete retention and trial outcomes. When cohorts are requested,{" "}
        <code>cohortScope: "project"</code> distinguishes them from filtered
        daily totals.
      </p>
      <p className="mt-3">
        MCP trial counters, expirations, and <code>purchaseEvents</code> sum
        only rows with recorded trial splits. Each currency, product, and
        platform group includes <code>trialSplitCoverage</code>: included and
        excluded row counts, and the first and last included dates. No included
        rows means null; excluded rows mean a subtotal, not the whole requested
        window. Refunded and net amounts are null when any matching row lacks a
        refund amount. Gross revenue still covers all matching rows.
      </p>

      <Callout kind="warning" title="Changed in this release">
        <p>
          These <code>/v1/subscriptions/revenue</code> fields changed meaning;
          compare earlier exports with care:
        </p>
        <ul className="my-2 list-disc space-y-1 pl-6">
          <li>
            Rows are production by default; rows from before{" "}
            <code>definitionsFromDay</code> still include sandbox. Pass{" "}
            <code>environment=sandbox</code> for Sandbox and Xcode purchases.{" "}
            <code>/v1/subscriptions/metrics</code> is production only.
          </li>
          <li>
            <code>revenueMicros</code> excludes free trials, free offer periods,
            refund reversals, and Google plan changes Play did not charge at
            once, and counts billing recoveries.
          </li>
          <li>
            <code>newSubs</code> excludes Apple refund reversals, Apple
            resubscribes other than the first charge after a lapsed trial,
            Google plan changes, and free offer periods.
          </li>
          <li>
            <code>renewals</code> excludes trial conversions, now in{" "}
            <code>trialConversions</code>, and counts billing recoveries, Apple
            resubscribes, and Google plan changes Play charged at once.
          </li>
          <li>
            <code>refunds</code> counts each refund once, less refund reversals,
            and no longer counts a revocation without a refund.
          </li>
          <li>
            <code>activeSubs</code> no longer counts billing retry without an
            expiry.
          </li>
        </ul>
        <p>
          New: <code>expirations</code> counts only paid access that ended, the
          churn numerator; <code>definitionsFromDay</code> and{" "}
          <code>trialSplitFromDay</code> mark the days each change covers.
        </p>
      </Callout>

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
