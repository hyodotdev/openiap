import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { DocsPage } from "../components/DocsPage";

export default function OrdersPage() {
  return (
    <DocsPage
      slug="orders"
      title="Order lookup"
      description="Look up a customer’s Apple or Google order without storing the query or result."
    >
      <p>
        Use the project dashboard&apos;s <strong>Orders</strong> tab when a
        customer sends an order ID from a receipt. IAPKit returns the live store
        order and, when available, its current subscription status. This is
        read-only customer-support tooling, not a public <code>/v1</code> API.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Look up an order</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>Open the project that owns the app.</li>
        <li>
          Select <strong>Orders</strong>, then choose App Store or Google Play.
        </li>
        <li>Paste the order ID from the customer&apos;s store receipt.</li>
        <li>
          Review the normalized summary and expand the raw store response when
          you need the complete record.
        </li>
      </ol>
      <p>
        A subscription-status fetch is best-effort. If that secondary request
        fails, the confirmed order still appears with the status error beside
        it.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Store requirements</h2>
      <Callout kind="note" title="Apple orders are production-only">
        <p>
          Apple&apos;s order lookup has no sandbox counterpart. The project
          needs its bundle ID, App Apple ID, Issuer ID, Key ID, and App Store
          Connect <code>.p8</code> key under Settings → iOS. Sandbox order
          numbers cannot be found.
        </p>
      </Callout>
      <Callout kind="note" title="Google needs financial-data access">
        <p>
          The project needs its exact Android package name and Play service
          account JSON. Grant that account{" "}
          <em>
            View financial data, orders, and cancellation survey responses
          </em>{" "}
          in Play Console or the Orders API returns 403. Follow the{" "}
          <Link
            to="/docs/verification/google"
            className="text-primary underline"
          >
            Google Play setup guide
          </Link>
          .
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Privacy and access</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          The lookup uses the store credentials already configured on the
          project.
        </li>
        <li>
          It requires an authenticated dashboard session and organization
          membership; API keys cannot call it.
        </li>
        <li>
          Order IDs, search results, and raw responses are proxied live and are
          not written to IAPKit&apos;s database or request logs.
        </li>
      </ul>
    </DocsPage>
  );
}
