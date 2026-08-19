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

      <h2 className="mt-10 text-2xl font-semibold">IAPKit guarantees</h2>
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
          Required verdict fields stay strict. Every verification response is
          checked against the published schema before it leaves IAPKit.
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

      <h2 className="mt-10 text-2xl font-semibold">Reported SDK version</h2>
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

      <h2 className="mt-10 text-2xl font-semibold">Contract enforcement</h2>
      <p>
        CI compares Kit&apos;s response enums with the OpenIAP schema used to
        generate every SDK. Runtime response validation and SDK parser tests
        then verify that unknown optional metadata degrades without weakening
        required fields.
      </p>
      <p>
        Read the{" "}
        <a
          href="https://openiap.dev/docs/kit-compatibility"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          canonical OpenIAP compatibility policy
        </a>{" "}
        for the cross-SDK behavior matrix, or continue to the{" "}
        <Link to="/docs/api" className="text-primary underline">
          IAPKit API reference
        </Link>{" "}
        for the current wire contract.
      </p>
    </DocsPage>
  );
}
