import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { DocsPage } from "../components/DocsPage";

export default function AnalyticsPage() {
  return (
    <DocsPage
      slug="analytics"
      title="Analytics"
      description="Revenue, MRR, renewals, churn — rolled up daily from ingested webhook events."
    >
      <p>
        The <strong>Analytics</strong> tab visualizes revenue and subscription
        lifecycle metrics across iOS and Android: total revenue, active
        subscriptions, new subs, renewals, cancellations, refunds, and churn.
        Data is sliced by date range (7 / 30 / 90 days), aggregated by period
        (daily / weekly / monthly), and filterable by platform, product, and
        currency.
      </p>

      <Callout kind="warning" title="Analytics requires webhook integration">
        <p>
          The dashboard reads from a daily-rolled-up table populated from
          ingested <strong>Apple App Store Server Notifications v2</strong> and{" "}
          <strong>Google Play Real-time Developer Notifications (RTDN)</strong>.
          Without webhooks, the Analytics tab will stay empty regardless of how
          many <code>/v1/purchase/verify</code> calls you make — verification
          alone doesn't tell IAPKit when a renewal, cancel, or refund happens.
        </p>
        <p className="mt-2">
          Open the project's <strong>Webhooks</strong> tab to copy your
          IAPKit-hosted webhook URLs and register them with the App Store / Play
          Console. Once notifications start arriving, the next cron tick (within
          24h) will populate this view.
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
          setup pages (otherwise the webhook receivers can't decode signed
          payloads).
        </li>
        <li>
          Open the project's <strong>Webhooks</strong> tab in the dashboard.
          Copy the per-store URLs (one for Apple ASN v2, one for Google RTDN).
        </li>
        <li>
          <strong>Apple</strong>: in App Store Connect →{" "}
          <em>App Store Server Notifications</em>, paste the Apple webhook URL
          and select <code>Version 2</code> for both Production and Sandbox
          environments.
        </li>
        <li>
          <strong>Google</strong>: in Play Console → <em>Monetization setup</em>
          , point Real-time Developer Notifications to a Pub/Sub topic that fans
          out to the Google webhook URL (Pub/Sub push subscription with the
          IAPKit URL as endpoint).
        </li>
        <li>
          Trigger a test purchase or use the App Store Connect / Play Console
          "Send test notification" feature. Confirm an event row appears in the
          <strong> Webhooks</strong> tab's event log.
        </li>
        <li>
          Wait up to 24h for the next analytics rollup tick — or trigger it
          manually if you have access to the Convex dashboard (
          <code>recomputeRevenueMetricsForProject</code>).
        </li>
      </ol>

      <h2 className="mt-10 text-2xl font-semibold">How the rollup works</h2>
      <p>
        Analytics data lives in a separate <code>revenueMetricsDaily</code>{" "}
        table that the Analytics tab reads from directly — the dashboard never
        scans the raw webhook event log on render. A daily cron walks each
        project's recent <code>webhookEvents</code> and writes one row per{" "}
        <code>(day, productId, currency, platform)</code> bucket.
      </p>
      <p className="mt-3">Counters map from event types as follows:</p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <code>SubscriptionStarted</code> →{" "}
          <code>newSubs += 1, revenueMicros += price</code>
        </li>
        <li>
          <code>SubscriptionRenewed</code> →{" "}
          <code>renewals += 1, revenueMicros += price</code>
        </li>
        <li>
          <code>SubscriptionCanceled</code> → <code>cancellations += 1</code>{" "}
          (paired with <code>SubscriptionUncanceled</code> for net-zero
          handling)
        </li>
        <li>
          <code>PurchaseRefunded</code> + <code>SubscriptionRevoked</code> →{" "}
          <code>refunds += 1</code>
        </li>
        <li>
          <code>activeSubs</code> is an end-of-day snapshot computed from the
          current <code>subscriptions</code> table, not from the event log
        </li>
      </ul>

      <Callout kind="note" title="Trailing 3-day window">
        <p>
          Each cron tick recomputes the trailing <strong>3 days</strong> so a
          late-arriving Apple ASN v2 / Google RTDN notification (which can retry
          for up to 5 / 7 days respectively) still folds into its correct day's
          bucket. RevenueCat uses the same 3-day reprocess window for the same
          reason — real-world p99 webhook delivery is well under 48 hours.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Currency &amp; FX</h2>
      <p>
        Rollup rows are keyed by currency: the same SKU sold in USD and EUR on
        the same day produces two rows. The dashboard never sums revenue across
        currencies without FX conversion. Each project has a reporting currency
        setting used for the main MRR and revenue views; rows in other
        currencies stay visible as separate currency slices and are excluded
        from the reporting-currency total. Full FX conversion is intentionally
        separate work because analytics conversion needs a documented rate
        source, update cadence, effective date, and rounding policy.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Churn definition</h2>
      <p>
        Churn rate = <code>(cancellations + refunds) / activeSubs</code>,
        expressed as a percentage of the end-of-period active count. Same
        definition Stripe and RevenueCat surface in their headline dashboards.
        The chart recomputes per-period when you flip Daily / Weekly / Monthly.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Limitations</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>No country / region split.</strong> Apple ASN v2 and Google
          RTDN don't expose buyer country in the notification payload.
          Country-level breakdowns would require pulling App Store Connect /
          Play Console reporting APIs separately.
        </li>
        <li>
          <strong>Webhook retention is 30 days.</strong> The raw event log is
          pruned after 30 days, but the daily rollup rows are kept indefinitely
          — historical analytics survive the retention sweep.
        </li>
        <li>
          <strong>
            30-day retention applies to the trailing recompute window too.
          </strong>{" "}
          An event arriving more than 30 days late won't be visible to the
          rollup at all (it's already gone from the event log). In practice this
          never happens — Apple stops retrying after 5 days, Google after 7.
        </li>
      </ul>
    </DocsPage>
  );
}
