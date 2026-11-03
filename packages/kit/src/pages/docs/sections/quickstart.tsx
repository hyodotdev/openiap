import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";
import { IAPKIT_FLOW_SAMPLE } from "./purchase-flow/iapkit-flow-sample";

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 flex gap-4">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-sm font-bold text-primary"
        aria-hidden="true"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold text-foreground">
          <span className="sr-only">{`${number}. `}</span>
          {title}
        </h2>
        <div className="mt-2">{children}</div>
      </div>
    </section>
  );
}

const STORE_SETUP = [
  {
    slug: "verification/apple",
    name: "Apple",
    needs: "bundle id, App Apple ID, Issuer ID, Key ID and the .p8 key",
  },
  {
    slug: "verification/google",
    name: "Google",
    needs: "package name and a service account JSON",
  },
  {
    slug: "verification/amazon",
    name: "Amazon Appstore",
    needs: "the RVS shared secret",
  },
  {
    slug: "verification/horizon",
    name: "Meta Horizon",
    needs: "App ID and App Secret",
  },
];

export default function QuickstartPage() {
  return (
    <DocsPage
      slug="quickstart"
      title="Quickstart"
      description="From sign-up to your first purchase verified in your app."
    >
      <Step number={1} title="Sign in">
        <p>
          Sign in with GitHub at{" "}
          <a
            href="https://kit.openiap.dev"
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            kit.openiap.dev
          </a>{" "}
          and name your first organization. It is free; no credit card. Email
          sign-in closed on 2026-09-30 (UTC); an email account carries over when
          you sign in with GitHub using the same address.
        </p>
      </Step>

      <Step number={2} title="Create a project and copy its key">
        <p>
          One project per app. Creating it shows the publishable{" "}
          <code>openiap-kit_pk_</code> key once, so copy it now; if you missed
          it, regenerate it on the <strong>API Keys</strong> tab.
        </p>
        <DocsScreenshot
          src="/docs/screenshots/project-new.webp"
          alt="Create project dialog"
          caption="Each project has its own keys, store credentials and purchase log."
        />
        <Callout kind="warning" title="Publishable does not mean private">
          <p>
            The key can be extracted from your app. Don&apos;t log it, use one
            per build or environment, and rotate it if it is abused. Secret{" "}
            <code>openiap-kit_sk_</code> keys stay on your servers.
          </p>
        </Callout>
      </Step>

      <Step number={3} title="Add your store credentials">
        <p>
          In the project&apos;s <strong>Settings</strong>, add what each store
          needs:
        </p>
        <ul className="my-3 list-disc space-y-1 pl-6">
          {STORE_SETUP.map((store) => (
            <li key={store.slug}>
              <Link
                to={`/docs/${store.slug}`}
                className="text-primary underline"
              >
                {store.name}
              </Link>
              {`: ${store.needs}`}
            </li>
          ))}
        </ul>
      </Step>

      <Step number={4} title="Verify purchases in your app">
        <p>
          Give the purchase flow <code>confirmWithIapkit</code>. It checks each
          purchase with the store, runs your <code>grant</code>, then finishes
          the purchase.
        </p>
        <CodeBlock
          title="Expo IAP (React Native IAP is identical)"
          language="ts"
        >
          {`import {confirmWithIapkit, createPurchaseFlow, useIAP} from 'expo-iap';

// Once, outside any screen.
${IAPKIT_FLOW_SAMPLE}

// In a screen: purchases you request are confirmed through the flow.
useIAP({purchaseFlow: flow});`}
        </CodeBlock>
        <p>
          Other SDKs:{" "}
          <code>FlutterInappPurchase.instance.confirmWithIapkit</code>,{" "}
          <code>kmpIapInstance.confirmWithIapkit</code>,{" "}
          <code>OpenIapClient.ConfirmWithIapkit</code> (OpenIap.Maui) and{" "}
          <code>confirm_with_iapkit</code> (godot-iap). Confirming through your
          own backend is in{" "}
          <Link to="/docs/purchase-flow" className="text-primary underline">
            Purchase flow
          </Link>
          ; the REST request is in the{" "}
          <Link to="/docs/api" className="text-primary underline">
            API reference
          </Link>
          .
        </p>
        <Callout kind="tip" title="Check it worked">
          <p>
            Your test purchase appears on the project&apos;s{" "}
            <strong>Purchases</strong> tab.
          </p>
        </Callout>
      </Step>

      <Step number={5} title="Turn on store notifications">
        <p>
          Renewals and refunds reach IAPKit from the stores, not from your app.
          Point each store&apos;s server notifications at your project&apos;s
          lifecycle URL; the steps are in{" "}
          <Link to="/docs/webhooks" className="text-primary underline">
            Webhooks
          </Link>
          .
        </p>
      </Step>

      <h2 className="mt-12 text-xl font-semibold">
        Optional: app-readable product rules
      </h2>
      <p className="mt-2">
        Attach a public TOML, JSON or text payload to a synced Apple or Google
        product, then pass <code>includeClientPayload: true</code> to{" "}
        <code>verifyPurchaseWithProvider</code>. Never put secrets in it. See{" "}
        <Link to="/docs/products" className="text-primary underline">
          Products & client payloads
        </Link>
        .
      </p>
    </DocsPage>
  );
}
