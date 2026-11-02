import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function QuickstartPage() {
  return (
    <DocsPage
      slug="quickstart"
      title="Quickstart"
      description="From signup to your first purchase verified in your app."
    >
      <h2 className="mt-8 text-2xl font-semibold">1. Create your account</h2>
      <p>
        Sign in with GitHub on{" "}
        <a
          href="https://kit.openiap.dev"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          kit.openiap.dev
        </a>
        . Email sign-in closed on 2026-09-30 (UTC); an account created with
        email carries over when you sign in with GitHub using the same email
        address. The onboarding flow asks you to name your first organization
        before opening its dashboard. The hosted service is free under fair-use
        safeguards on shared community infrastructure; no plan or credit card is
        required.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">2. Create a project</h2>
      <p>
        Projects group a single mobile app's configuration: its iOS bundle id,
        Android package name, the store credentials, and the API keys your app
        will authenticate with.
      </p>
      <DocsScreenshot
        src="/docs/screenshots/project-new.webp"
        alt="Create project dialog"
        caption="The Projects tab in each organization holds one row per app. Each row has its own API keys, store credentials, and purchase log."
      />

      <h2 className="mt-10 text-2xl font-semibold">3. Configure your stores</h2>
      <p>
        Open <strong>Settings</strong> on your new project:
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <Link
            to="/docs/verification/apple"
            className="text-primary underline"
          >
            Apple
          </Link>{" "}
          — bundle id, App Apple ID, App Store Connect Issuer ID + Key ID, .p8
          upload.
        </li>
        <li>
          <Link
            to="/docs/verification/google"
            className="text-primary underline"
          >
            Google
          </Link>{" "}
          — Android package name + Google service account JSON.
        </li>
        <li>
          <Link
            to="/docs/verification/horizon"
            className="text-primary underline"
          >
            Meta Horizon
          </Link>{" "}
          — App ID + App Secret (inside the Android card).
        </li>
        <li>
          <Link
            to="/docs/verification/amazon"
            className="text-primary underline"
          >
            Amazon Appstore
          </Link>{" "}
          — RVS shared secret for production, or explicit App Tester / Cloud
          Sandbox opt-in (inside the Android card).
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">
        4. Copy your publishable key
      </h2>
      <p>
        The <strong>API Keys</strong> tab lists the project&apos;s keys. A
        publishable <code>openiap-kit_pk_</code> key is created with the project
        and shown once; your app uses it to verify purchases. Secret{" "}
        <code>openiap-kit_sk_</code> keys are for your backend, MCP, and CI
        only. See{" "}
        <Link to="/docs/projects" className="text-primary underline">
          Projects & API keys
        </Link>
        .
      </p>
      <Callout kind="warning" title="Publishable does not mean private">
        <p>
          A publishable key lets your app call IAPKit&apos;s restricted managed
          validation surface directly, but it can still be extracted and used
          against shared rate and capacity limits. Avoid logging it, use
          separate keys for independent builds or environments, and rotate an
          abused key. Secret keys provide administrative access and must remain
          server-side.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        5. Verify purchases in your app
      </h2>
      <p>
        Create the app&apos;s purchase flow with <code>confirmWithIapkit</code>.
        The flow listens for purchases, has IAPKit check each one with the
        store, runs your <code>grant</code> (credit consumables there), and
        finishes the purchase once access is granted.
      </p>
      <CodeBlock title="Expo IAP (React Native IAP is identical)" language="ts">
        {`import {confirmWithIapkit, createPurchaseFlow, useIAP} from 'expo-iap';

// Once, outside any screen.
const flow = createPurchaseFlow({
  confirmWithBackend: confirmWithIapkit({
    apiKey: 'openiap-kit_pk_<your-publishable-key>',
    grant: async (purchase, {isConsumable}) => {
      if (isConsumable) await wallet.creditOnce(purchase.id, purchase.productId);
    },
  }),
  isConsumable: (productId) => CONSUMABLE_IDS.includes(productId),
});

// In a screen: purchases you request are confirmed through the flow.
useIAP({purchaseFlow: flow});`}
      </CodeBlock>
      <p>
        flutter_inapp_purchase, kmp-iap, OpenIap.Maui, and godot-iap offer the
        same confirmer in their own idiom; see{" "}
        <Link to="/docs/purchase-flow" className="text-primary underline">
          Purchase flow
        </Link>{" "}
        for each SDK, for apps that confirm through their own backend, and for
        how to handle each outcome. To call the REST API without an SDK, each
        store page shows its request:{" "}
        <Link to="/docs/verification/apple" className="text-primary underline">
          Apple
        </Link>
        ,{" "}
        <Link to="/docs/verification/google" className="text-primary underline">
          Google
        </Link>
        ,{" "}
        <Link
          to="/docs/verification/horizon"
          className="text-primary underline"
        >
          Meta Horizon
        </Link>
        ,{" "}
        <Link to="/docs/verification/amazon" className="text-primary underline">
          Amazon
        </Link>
        .
      </p>

      <Callout kind="tip" title="Seeing the call in the dashboard">
        <p>
          Head back to your project's <strong>Purchases</strong> tab. Your test
          verification shows up with the store, state, and verification latency.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        6. Turn on store notifications
      </h2>
      <p>
        Renewals, refunds, and expirations reach IAPKit through each
        store&apos;s server notifications, not through the app; for Apple and
        Google they are the only source, and Amazon receipts are also re-checked
        on a schedule. Point App Store Server Notifications V2, Google Play
        real-time developer notifications, and Amazon RTN at your project&apos;s
        lifecycle URL; subscription status, analytics, and webhooks to your
        backend depend on it. See{" "}
        <Link to="/docs/webhooks" className="text-primary underline">
          Webhooks
        </Link>{" "}
        for each store&apos;s steps.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">
        Optional: return app-readable product rules
      </h2>
      <p>
        In the project&apos;s <strong>Products</strong> tab, attach a public
        TOML, JSON, or text <code>clientPayload</code> to a synced Apple or
        Google product. Then add <code>includeClientPayload: true</code> to that
        store&apos;s verification request. A valid response may include the
        payload as a top-level sibling of <code>productId</code> when the
        matching visible product has one. Payload omission does not invalidate
        verification, and existing requests stay unchanged.
      </p>
      <p>
        Payloads are retrieved when your app calls IAPKit—they are not APNs or
        FCM notifications—and must never contain secrets. See{" "}
        <Link to="/docs/products" className="text-primary underline">
          Products & client payloads
        </Link>{" "}
        for editor, catalog-fetch, caching, and validation details.
      </p>
    </DocsPage>
  );
}
