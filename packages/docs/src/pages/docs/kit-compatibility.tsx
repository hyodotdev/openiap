import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
import CodeBlock from '../../components/CodeBlock';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function KitCompatibility() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="IAPKit Version Compatibility"
        description="How IAPKit keeps verification working for app builds that were compiled against an older OpenIAP SDK: additive-only responses, degrade-on-unknown parsing, strict verdict fields, and the X-OpenIAP-Spec client version header."
        path="/docs/kit-compatibility"
        keywords="IAPKit compatibility, backward compatibility, OpenIAP spec version, X-OpenIAP-Spec, additive only, degrade on unknown, receipt verification compatibility"
      />
      <h1>Version Compatibility</h1>
      <p>
        You do not have to force your users onto a new app build when IAPKit
        changes. This page states what IAPKit guarantees to an app that was
        compiled against an older OpenIAP SDK, and what it deliberately does
        not.
      </p>

      <section>
        <AnchorLink id="three-clocks" level="h2">
          Why this needs a policy
        </AnchorLink>
        <p>
          Three things move on separate clocks, and only the first is under
          OpenIAP's control:
        </p>
        <ul>
          <li>
            <strong>IAPKit</strong> — deploys from <code>main</code>, so every
            caller sees a change at the same moment.
          </li>
          <li>
            <strong>The SDK version you compiled against</strong> — changes when
            you upgrade and ship.
          </li>
          <li>
            <strong>The app build on a user's device</strong> — changes when
            that user updates. Some never do.
          </li>
        </ul>
        <p>
          The third has no upper bound, so IAPKit cannot assume the oldest
          caller is recent. Everything below follows from that.
        </p>
      </section>

      <section>
        <AnchorLink id="guarantees" level="h2">
          What IAPKit guarantees
        </AnchorLink>
        <ul>
          <li>
            <strong>Responses are additive.</strong> A field is never removed,
            renamed, or given a new meaning. New fields are optional, and a new
            response shape is gated behind an explicit request flag — the way{' '}
            <code>includeClientPayload</code> is, so a build that never sends it
            never receives it.
          </li>
          <li>
            <strong>A truly breaking change gets a new path.</strong> It would
            ship as <code>/v2</code>, and <code>/v1</code> would keep serving.
            No app is ever forced to move.
          </li>
          <li>
            <strong>The verdict stays strict.</strong> <code>isValid</code> and
            the echoed <code>store</code> are the security boundary and are
            always validated exactly.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="degrade" level="h2">
          What the SDKs do with a value they do not know
        </AnchorLink>
        <p>
          Optional metadata degrades; it never fails the purchase. Receipt
          verification is the security boundary, and losing a label is not worth
          rejecting a receipt the store already confirmed.
        </p>
        <ul>
          <li>
            <code>state</code> — an unrecognised value becomes{' '}
            <code>unknown</code>. <code>isValid</code> remains authoritative, so
            gate entitlement on it rather than on the state label.
          </li>
          <li>
            <code>clientPayload</code> — a payload this build cannot read,
            including one using a format added later, is dropped and the result
            still returns.
          </li>
          <li>
            <code>environment</code> — forwarded as an opaque string. It is{' '}
            <code>String</code> in the spec, not an enum, so do not reject a
            value you do not recognise. App Store Server alone names{' '}
            <code>Sandbox</code>, <code>Production</code>, <code>Xcode</code>{' '}
            and <code>LocalTesting</code>.
          </li>
        </ul>
        <Callout kind="important">
          <p>
            <strong>Do not re-derive these constraints in your app.</strong>{' '}
            Comparing <code>environment</code> against the value you asked for
            is fine. Rejecting the verification because the value is not one you
            enumerated is the pattern that breaks when IAPKit adds one.
          </p>
        </Callout>
      </section>

      <section>
        <AnchorLink id="spec-header" level="h2">
          Reporting your spec version
        </AnchorLink>
        <p>
          Native verification requests carry the OpenIAP spec version the build
          was compiled against:
        </p>
        <CodeBlock language="text">{`POST /v1/purchase/verify
Authorization: Bearer <publishable key>
X-OpenIAP-Spec: 3.2.0`}</CodeBlock>
        <p>
          It is reported, never negotiated. IAPKit records it so a contract
          change can be measured against the versions actually calling, and
          never branches verification on it — a client cannot change how its
          receipt is verified by claiming a version. The header is omitted when
          the version cannot be read, which is not an error.
        </p>
      </section>

      <section>
        <AnchorLink id="enforcement" level="h2">
          How this is enforced
        </AnchorLink>
        <p>The rules above are checked by CI rather than left to review:</p>
        <ul>
          <li>
            The purchase-state, client-payload-format and verify-store enums are
            compared against the GraphQL spec every SDK generates from. Drift
            fails both CI and the IAPKit deploy.
          </li>
          <li>
            Every <code>/v1/purchase/verify</code> response is validated against
            the published schema before it is sent, so the documented shape and
            the emitted one cannot diverge.
          </li>
          <li>
            Each SDK has tests that feed its parser values from a hypothetical
            future IAPKit — an unknown state, an unknown client-payload format,
            an unrecognised environment — and assert the receipt survives.
          </li>
          <li>
            The entitlement decision is pinned by an exhaustive table, so a new
            purchase state has to be classified deliberately.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="your-side" level="h2">
          What to do in your app
        </AnchorLink>
        <ul>
          <li>
            Gate entitlement on <code>isValid</code>, then match{' '}
            <code>productId</code>. Treat <code>state</code> as a label for
            logging and UI, not as the decision.
          </li>
          <li>
            Handle every optional field being absent. Any of them can be missing
            for a legitimate reason.
          </li>
          <li>
            Never fail a verification because a value is unrecognised. Log it
            and continue.
          </li>
          <li>
            Keep the SDK reasonably current so new fields become available, but
            know that an old build keeps verifying correctly in the meantime.
          </li>
        </ul>
        <p>
          See <Link to="/docs/kit-backend">Purchase Verification</Link> for the
          endpoint surface and{' '}
          <Link to="/docs/types/verify-purchase-with-provider-result">
            VerifyPurchaseWithProviderResult
          </Link>{' '}
          for the field-by-field contract.
        </p>
      </section>
    </div>
  );
}

export default KitCompatibility;
