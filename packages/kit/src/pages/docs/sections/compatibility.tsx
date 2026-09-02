import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function CompatibilityPage() {
  return (
    <DocsPage
      slug="compatibility"
      title="Version compatibility"
      description="How hosted IAPKit keeps /v1 verification safe for app builds compiled against older OpenIAP SDKs."
    >
      <p>
        IAPKit, SDK releases, and installed app builds move on different
        schedules. Hosted <code>/v1</code> therefore cannot assume that every
        caller upgraded when the service deployed.
      </p>

      <h2 id="three-clocks" className="mt-10 text-2xl font-semibold">
        Three separate clocks
      </h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>IAPKit deployment</strong> changes what every caller reaches
          at once.
        </li>
        <li>
          <strong>Compiled SDK version</strong> changes only when a team
          upgrades and ships.
        </li>
        <li>
          <strong>Installed app build</strong> changes only when a user updates,
          and some builds remain active indefinitely.
        </li>
      </ul>

      <h2 id="guarantees" className="mt-10 text-2xl font-semibold">
        IAPKit guarantees
      </h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Response changes on <code>/v1</code> are additive. Existing fields are
          not removed, renamed, or assigned a different meaning.
        </li>
        <li>
          New response objects are optional or gated by an explicit request
          flag. A truly breaking contract would ship on <code>/v2</code> while{" "}
          <code>/v1</code> keeps serving.
        </li>
        <li>
          Required verdict fields stay strict. <code>isValid</code> and the
          echoed <code>store</code> remain the security boundary, and every
          verification response is checked against the published schema before
          it leaves IAPKit.
        </li>
      </ul>

      <h2 id="degrade" className="mt-10 text-2xl font-semibold">
        Unknown optional values degrade safely
      </h2>
      <p>
        Optional metadata must not invalidate a purchase that the store already
        confirmed:
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          An unrecognized <code>state</code> becomes <code>unknown</code> while{" "}
          <code>isValid</code> remains authoritative.
        </li>
        <li>
          An unreadable <code>clientPayload</code> is omitted by strongly typed
          SDKs; JavaScript Kit clients can preserve its format and body as
          opaque data.
        </li>
        <li>
          <code>environment</code> remains an opaque string. A new store
          environment must not fail an otherwise valid verification.
        </li>
      </ul>

      <Callout kind="warning" title="Gate access on the verdict">
        <p>
          Use <code>isValid</code>, then require an exact store-verified{" "}
          <code>productId</code> match. Treat <code>state</code> as a
          descriptive label, allow optional metadata to be absent, and do not
          reject a verified purchase only because an older SDK does not
          recognize new optional metadata.
        </p>
      </Callout>

      <h2 id="spec-header" className="mt-10 text-2xl font-semibold">
        Reported SDK version
      </h2>
      <p>
        SDK builds that support it send the OpenIAP spec version they were
        compiled against:
      </p>
      <CodeBlock language="http">
        {`POST /v1/purchase/verify
Authorization: Bearer openiap-kit_pk_<publishable-key>
X-OpenIAP-Spec: 3.2.0`}
      </CodeBlock>
      <p>
        IAPKit records this header for rollout measurement. It never negotiates
        behavior or changes how the receipt is verified, and malformed values
        are ignored.
      </p>

      <h2 id="enforcement" className="mt-10 text-2xl font-semibold">
        Contract enforcement
      </h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          CI compares IAPKit response enums with the OpenIAP schema used to
          generate every SDK.
        </li>
        <li>
          Runtime validation rejects a response that cannot satisfy the
          published <code>/v1</code> schema.
        </li>
        <li>
          SDK parser tests exercise future unknown state, payload format, and
          environment values without weakening required fields.
        </li>
        <li>
          The entitlement table forces every newly introduced purchase state to
          receive an explicit access decision.
        </li>
      </ul>

      <h2 id="your-side" className="mt-10 text-2xl font-semibold">
        What your app should do
      </h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Gate entitlement on <code>isValid</code>, then require an exact{" "}
          <code>productId</code> match.
        </li>
        <li>Handle every optional field being absent.</li>
        <li>
          Do not reject verification because optional metadata is unknown.
        </li>
        <li>
          Keep SDKs reasonably current so new fields become available while old
          installed builds continue to verify.
        </li>
      </ul>
      <p>
        Continue to the{" "}
        <Link to="/docs/api" className="text-primary underline">
          IAPKit API reference
        </Link>{" "}
        for the current wire contract.
      </p>
    </DocsPage>
  );
}
