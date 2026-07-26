import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';

function VerifyPurchaseWithProviderProps() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="VerifyPurchaseWithProviderProps"
        description="VerifyPurchaseWithProviderProps field reference, including IAPKit client payload opt-in behavior."
        path="/docs/types/verify-purchase-with-provider-props"
        keywords="VerifyPurchaseWithProviderProps, OpenIAP types, Verify Purchase With Provider Props"
      />
      <h1>VerifyPurchaseWithProviderProps</h1>
      <section>
        <AnchorLink id="verify-purchase-with-provider-props" level="h2">
          VerifyPurchaseWithProviderProps
        </AnchorLink>
        <p>
          Input type for <code>verifyPurchaseWithProvider()</code> - used to
          verify purchases through external providers like{' '}
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            IAPKit
          </a>
          .
        </p>
        <p>
          Input to <code>verifyPurchaseWithProvider</code> — pick a managed
          validator. The <code>PurchaseVerificationProvider</code> enum
          currently exposes only IAPKit (open source under MIT — source at{' '}
          <a
            href="https://github.com/hyodotdev/openiap/tree/main/packages/kit"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>packages/kit</code>
          </a>
          {`).`} See{' '}
          <a
            href="https://openiap.dev/docs/features/validation"
            target="_blank"
            rel="noopener noreferrer"
          >
            Validation docs
          </a>
          .
        </p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>provider</code>
              </td>
              <td>
                <code>PurchaseVerificationProvider</code>
              </td>
              <td>
                The verification provider to use. Currently only{' '}
                <code>'iapkit'</code> is supported.
              </td>
            </tr>
            <tr>
              <td>
                <code>iapkit</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitProps?</code>
              </td>
              <td>IAPKit-specific verification parameters.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-verify-purchase-with-iapkit-props" level="h3">
          RequestVerifyPurchaseWithIapkitProps
        </AnchorLink>
        <p>
          Parameters for IAPKit verification. Product client payload enrichment
          is opt-in, so existing integrations keep the same response shape and
          bandwidth by default.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>apiKey</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>
                API key used for the Authorization header (Bearer {'{apiKey}'}
                ).
              </td>
            </tr>
            <tr>
              <td>
                <code>baseUrl</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>
                Available in OpenIAP Spec 2.3.1 / openiap-apple 2.4.0 /
                openiap-google 2.4.0. IAPKit server origin. Defaults to{' '}
                <code>https://kit.openiap.dev</code>; set it to a reachable
                HTTP(S) origin for self-hosted or local IAPKit verification. The{' '}
                <code>apiKey</code> must be issued by the same IAPKit/Convex
                deployment that this origin uses.
              </td>
            </tr>
            <tr>
              <td>
                <code>includeClientPayload</code>
              </td>
              <td>
                <code>boolean?</code>
              </td>
              <td>
                Defaults to <code>false</code>. When <code>true</code>, a valid
                Apple or Google verification may include the public product{' '}
                <code>clientPayload</code> stored in IAPKit. Invalid receipts,
                products without an active catalog row, removed products,
                products without a payload, and Horizon or Amazon responses omit
                it.
              </td>
            </tr>
            <tr>
              <td>
                <code>apple</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitAppleProps?</code>
              </td>
              <td>Apple/iOS verification parameters.</td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitGoogleProps?</code>
              </td>
              <td>Google/Android verification parameters.</td>
            </tr>
            <tr>
              <td>
                <code>amazon</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitAmazonProps?</code>
              </td>
              <td>
                Amazon Appstore verification parameters for Fire OS and Vega OS
                purchase receipts.
              </td>
            </tr>
          </tbody>
        </table>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Client-visible data only:</strong> Product client payloads
            can be retrieved by apps and must never contain credentials, signing
            keys, or server-authoritative rules. The body is limited to 16 KiB
            measured as UTF-8 bytes. Use an <code>openiap-kit_pk_</code>{' '}
            publishable key in the app. It is extractable and consumes project
            quota, but cannot perform administrative operations. Never embed an{' '}
            <code>openiap-kit_sk_</code> secret key.
          </p>
        </div>

        <p>
          See the{' '}
          <Link to="/docs/types/verify-purchase-with-provider-result#iapkit-product-client-payload">
            <code>IapkitProductClientPayload</code> result shape
          </Link>{' '}
          and the{' '}
          <Link to="/docs/kit-backend#product-client-payloads">
            IAPKit product client payload guide
          </Link>
          .
        </p>

        <AnchorLink
          id="request-verify-purchase-with-iapkit-apple-props"
          level="h4"
        >
          RequestVerifyPurchaseWithIapkitAppleProps
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>jws</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>The JWS token returned with the purchase response.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink
          id="request-verify-purchase-with-iapkit-google-props"
          level="h4"
        >
          RequestVerifyPurchaseWithIapkitGoogleProps
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                The token provided to the user's device when the product or
                subscription was purchased.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink
          id="request-verify-purchase-with-iapkit-amazon-props"
          level="h4"
        >
          RequestVerifyPurchaseWithIapkitAmazonProps
        </AnchorLink>
        <p>
          Amazon Appstore receipt verification parameters. Fire OS and Vega OS
          both use this <code>amazon</code> payload when verifying through
          IAPKit.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>userId</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>
                Amazon Appstore user id returned by{' '}
                <code>PurchaseResponse.getUserData().getUserId()</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>receiptId</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                Amazon Appstore receipt id returned by{' '}
                <code>PurchaseResponse.getReceipt().getReceiptId()</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>sandbox</code>
              </td>
              <td>
                <code>boolean?</code>
              </td>
              <td>
                Use Amazon RVS Cloud Sandbox for Amazon App Tester receipts.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default VerifyPurchaseWithProviderProps;
