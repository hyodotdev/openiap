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
        description="VerifyPurchaseWithProviderProps type definition and field reference."
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
        <p>Parameters for IAPKit verification.</p>
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
