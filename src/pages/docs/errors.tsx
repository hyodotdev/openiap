import { Link } from 'react-router-dom';
import CodeBlock from '../../components/CodeBlock';
import PlatformTabs from '../../components/PlatformTabs';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Errors() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Error Codes</h1>

      <section>
        <h2>Error Structure</h2>
        <p>
          All purchase errors follow a consistent structure for easy handling.
          See <Link to="/docs/types#purchase-error">PurchaseError type</Link>{' '}
          for details.
        </p>
        <CodeBlock language="graphql">{`type PurchaseError {
  code: String!          # Error code constant
  message: String!       # Human-readable message
  productId: String      # Related product SKU (if applicable)
}`}</CodeBlock>
      </section>

      <section>
        <h2>Common Error Codes</h2>

        <h3>User Action Errors</h3>
        <table className="error-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>E_USER_CANCELLED</code>
              </td>
              <td>User cancelled the purchase flow</td>
              <td>No action needed, expected behavior</td>
            </tr>
            <tr>
              <td>
                <code>E_USER_ERROR</code>
              </td>
              <td>User-related error during purchase</td>
              <td>Check user account status</td>
            </tr>
            <tr>
              <td>
                <code>E_DEFERRED_PAYMENT</code>
              </td>
              <td>Payment was deferred (pending family approval, etc.)</td>
              <td>Wait for payment approval</td>
            </tr>
            <tr>
              <td>
                <code>E_INTERRUPTED</code>
              </td>
              <td>Purchase flow was interrupted</td>
              <td>Retry the purchase</td>
            </tr>
          </tbody>
        </table>

        <h3>Product Errors</h3>
        <table className="error-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>E_ITEM_UNAVAILABLE</code>
              </td>
              <td>Product not available in store</td>
              <td>Check product configuration in store console</td>
            </tr>
            <tr>
              <td>
                <code>E_SKU_NOT_FOUND</code>
              </td>
              <td>SKU not found in product list</td>
              <td>Verify SKU exists in store configuration</td>
            </tr>
            <tr>
              <td>
                <code>E_SKU_OFFER_MISMATCH</code>
              </td>
              <td>SKU offer ID mismatch</td>
              <td>Check offer configuration for the SKU</td>
            </tr>
            <tr>
              <td>
                <code>E_QUERY_PRODUCT</code>
              </td>
              <td>Failed to query product details</td>
              <td>Check product IDs and retry</td>
            </tr>
            <tr>
              <td>
                <code>E_ALREADY_OWNED</code>
              </td>
              <td>Item already owned by user</td>
              <td>Restore purchases to unlock content</td>
            </tr>
            <tr>
              <td>
                <code>E_ITEM_NOT_OWNED</code>
              </td>
              <td>Item not owned by user</td>
              <td>Purchase the item first</td>
            </tr>
          </tbody>
        </table>

        <h3>Network & Service Errors</h3>
        <table className="error-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>E_NETWORK_ERROR</code>
              </td>
              <td>Network connection error</td>
              <td>Check internet connection and retry</td>
            </tr>
            <tr>
              <td>
                <code>E_SERVICE_ERROR</code>
              </td>
              <td>Store service error</td>
              <td>Wait and retry, check store service status</td>
            </tr>
            <tr>
              <td>
                <code>E_REMOTE_ERROR</code>
              </td>
              <td>Remote server error</td>
              <td>Check server logs, retry request</td>
            </tr>
            <tr>
              <td>
                <code>E_INIT_CONNECTION</code>
              </td>
              <td>Failed to initialize store connection</td>
              <td>Check store service availability and retry</td>
            </tr>
            <tr>
              <td>
                <code>E_SERVICE_DISCONNECTED</code>
              </td>
              <td>Store service disconnected</td>
              <td>Reconnect to the store service</td>
            </tr>
            <tr>
              <td>
                <code>E_CONNECTION_CLOSED</code>
              </td>
              <td>Connection to store service was closed</td>
              <td>Reinitialize connection and retry</td>
            </tr>
            <tr>
              <td>
                <code>E_IAP_NOT_AVAILABLE</code>
              </td>
              <td>In-app purchase service not available</td>
              <td>Check device settings and IAP availability</td>
            </tr>
            <tr>
              <td>
                <code>E_BILLING_UNAVAILABLE</code>
              </td>
              <td>Billing service is unavailable</td>
              <td>Check Google Play/App Store availability</td>
            </tr>
            <tr>
              <td>
                <code>E_FEATURE_NOT_SUPPORTED</code>
              </td>
              <td>Requested feature not supported</td>
              <td>Check device/OS version compatibility</td>
            </tr>
            <tr>
              <td>
                <code>E_SYNC_ERROR</code>
              </td>
              <td>Synchronization error with store</td>
              <td>Retry synchronization</td>
            </tr>
          </tbody>
        </table>

        <h3>Validation Errors</h3>
        <table className="error-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>E_RECEIPT_FAILED</code>
              </td>
              <td>Receipt validation failed</td>
              <td>Check receipt validation logic, retry validation</td>
            </tr>
            <tr>
              <td>
                <code>E_RECEIPT_FINISHED</code>
              </td>
              <td>Receipt already processed/finished</td>
              <td>Transaction already completed, check records</td>
            </tr>
            <tr>
              <td>
                <code>E_RECEIPT_FINISHED_FAILED</code>
              </td>
              <td>Failed to finish receipt processing</td>
              <td>Check transaction state and retry</td>
            </tr>
            <tr>
              <td>
                <code>E_TRANSACTION_VALIDATION_FAILED</code>
              </td>
              <td>Transaction validation failed</td>
              <td>Verify transaction data and retry</td>
            </tr>
            <tr>
              <td>
                <code>E_EMPTY_SKU_LIST</code>
              </td>
              <td>Empty SKU list provided</td>
              <td>Provide at least one SKU to query</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Error Handling Examples</h2>

        <h3>Error Handling Pattern</h3>
        <p>
          Implement error handlers that respond appropriately to each error
          type:
        </p>
        <ul>
          <li>
            <strong>User Cancellation</strong> - Silent handling, no alerts
          </li>
          <li>
            <strong>Product Issues</strong> - Inform user about availability
          </li>
          <li>
            <strong>Ownership Conflicts</strong> - Trigger purchase restoration
          </li>
          <li>
            <strong>Network Errors</strong> - Suggest retry with backoff
          </li>
          <li>
            <strong>Unknown Errors</strong> - Generic fallback message
          </li>
        </ul>

        <h3>Retry Strategy</h3>
        <p>Implement retry logic for transient errors:</p>
        <div className="info-note">
          <strong>Note:</strong> These retry strategies are automatically
          handled within the OpenIAP module. You don't need to implement them
          manually.
        </div>
        <table className="error-table">
          <thead>
            <tr>
              <th>Error Type</th>
              <th>Can Retry</th>
              <th>Strategy</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>E_NETWORK_ERROR</td>
              <td>Yes</td>
              <td>Exponential backoff (2^n seconds)</td>
            </tr>
            <tr>
              <td>E_SERVICE_ERROR</td>
              <td>Yes</td>
              <td>Linear backoff (n * 5 seconds)</td>
            </tr>
            <tr>
              <td>E_REMOTE_ERROR</td>
              <td>Yes</td>
              <td>Fixed delay (10 seconds)</td>
            </tr>
            <tr>
              <td>E_CONNECTION_CLOSED</td>
              <td>Yes</td>
              <td>Reinitialize and retry</td>
            </tr>
            <tr>
              <td>E_SYNC_ERROR</td>
              <td>Yes</td>
              <td>Exponential backoff</td>
            </tr>
            <tr>
              <td>E_USER_CANCELLED</td>
              <td>No</td>
              <td>Do not retry</td>
            </tr>
            <tr>
              <td>E_ALREADY_OWNED</td>
              <td>No</td>
              <td>Restore instead</td>
            </tr>
            <tr>
              <td>E_DEFERRED_PAYMENT</td>
              <td>No</td>
              <td>Wait for approval</td>
            </tr>
            <tr>
              <td>E_NOT_PREPARED</td>
              <td>No</td>
              <td>Initialize connection first</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Platform-Specific Error Handling</h2>

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>iOS Error Codes</h3>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Native Code</th>
                      <th>Mapped Error</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>0</td>
                      <td>E_UNKNOWN</td>
                      <td>Unknown error</td>
                    </tr>
                    <tr>
                      <td>1</td>
                      <td>E_USER_CANCELLED</td>
                      <td>User cancelled transaction</td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>E_NETWORK_ERROR</td>
                      <td>Network unavailable</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>E_ITEM_UNAVAILABLE</td>
                      <td>Product not available</td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>E_SERVICE_ERROR</td>
                      <td>App Store service error</td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>E_RECEIPT_FAILED</td>
                      <td>Receipt validation failed</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>E_ALREADY_OWNED</td>
                      <td>Product already purchased</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <h3>Android Response Codes</h3>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Response Code</th>
                      <th>Mapped Error</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>0</td>
                      <td>OK</td>
                      <td>Success</td>
                    </tr>
                    <tr>
                      <td>1</td>
                      <td>E_USER_CANCELLED</td>
                      <td>User pressed back or cancelled</td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>E_SERVICE_ERROR</td>
                      <td>Network connection down</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>E_SERVICE_ERROR</td>
                      <td>Billing API unavailable</td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>E_ITEM_UNAVAILABLE</td>
                      <td>Requested product not available</td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>E_DEVELOPER_ERROR</td>
                      <td>Invalid arguments provided</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>E_UNKNOWN</td>
                      <td>Fatal error during API action</td>
                    </tr>
                    <tr>
                      <td>7</td>
                      <td>E_ALREADY_OWNED</td>
                      <td>Item already owned</td>
                    </tr>
                    <tr>
                      <td>8</td>
                      <td>E_ITEM_NOT_OWNED</td>
                      <td>Item not owned</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>

        <h3>ErrorCode Enum (Unified)</h3>
        <p>
          Complete list of error codes that can be returned by the IAP library.
        </p>
        <CodeBlock language="typescript">{`enum ErrorCode {
  E_UNKNOWN = 'E_UNKNOWN',
  E_USER_CANCELLED = 'E_USER_CANCELLED',
  E_USER_ERROR = 'E_USER_ERROR',
  E_ITEM_UNAVAILABLE = 'E_ITEM_UNAVAILABLE',
  E_REMOTE_ERROR = 'E_REMOTE_ERROR',
  E_NETWORK_ERROR = 'E_NETWORK_ERROR',
  E_SERVICE_ERROR = 'E_SERVICE_ERROR',
  E_RECEIPT_FAILED = 'E_RECEIPT_FAILED',
  E_RECEIPT_FINISHED = 'E_RECEIPT_FINISHED',
  E_RECEIPT_FINISHED_FAILED = 'E_RECEIPT_FINISHED_FAILED',
  E_NOT_PREPARED = 'E_NOT_PREPARED',
  E_NOT_ENDED = 'E_NOT_ENDED',
  E_ALREADY_OWNED = 'E_ALREADY_OWNED',
  E_DEVELOPER_ERROR = 'E_DEVELOPER_ERROR',
  E_BILLING_RESPONSE_JSON_PARSE_ERROR = 'E_BILLING_RESPONSE_JSON_PARSE_ERROR',
  E_DEFERRED_PAYMENT = 'E_DEFERRED_PAYMENT',
  E_INTERRUPTED = 'E_INTERRUPTED',
  E_IAP_NOT_AVAILABLE = 'E_IAP_NOT_AVAILABLE',
  E_PURCHASE_ERROR = 'E_PURCHASE_ERROR',
  E_SYNC_ERROR = 'E_SYNC_ERROR',
  E_TRANSACTION_VALIDATION_FAILED = 'E_TRANSACTION_VALIDATION_FAILED',
  E_ACTIVITY_UNAVAILABLE = 'E_ACTIVITY_UNAVAILABLE',
  E_ALREADY_PREPARED = 'E_ALREADY_PREPARED',
  E_PENDING = 'E_PENDING',
  E_CONNECTION_CLOSED = 'E_CONNECTION_CLOSED',
  E_INIT_CONNECTION = 'E_INIT_CONNECTION',
  E_SERVICE_DISCONNECTED = 'E_SERVICE_DISCONNECTED',
  E_QUERY_PRODUCT = 'E_QUERY_PRODUCT',
  E_SKU_NOT_FOUND = 'E_SKU_NOT_FOUND',
  E_SKU_OFFER_MISMATCH = 'E_SKU_OFFER_MISMATCH',
  E_ITEM_NOT_OWNED = 'E_ITEM_NOT_OWNED',
  E_BILLING_UNAVAILABLE = 'E_BILLING_UNAVAILABLE',
  E_FEATURE_NOT_SUPPORTED = 'E_FEATURE_NOT_SUPPORTED',
  E_EMPTY_SKU_LIST = 'E_EMPTY_SKU_LIST',
}`}</CodeBlock>
      </section>

      <section>
        <h2>Testing Error Scenarios</h2>

        <h3>Testing Error Scenarios</h3>
        <h4>iOS Sandbox Testing</h4>
        <table className="error-table">
          <thead>
            <tr>
              <th>Test Account</th>
              <th>Simulated Error</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>test.purchase.failed@example.com</td>
              <td>E_RECEIPT_FAILED</td>
            </tr>
            <tr>
              <td>test.purchase.cancelled@example.com</td>
              <td>E_USER_CANCELLED</td>
            </tr>
            <tr>
              <td>test.purchase.unavailable@example.com</td>
              <td>E_ITEM_UNAVAILABLE</td>
            </tr>
          </tbody>
        </table>

        <h4>Android Testing Methods</h4>
        <table className="error-table">
          <thead>
            <tr>
              <th>Test Method</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>License Testing</td>
              <td>
                Add test accounts in Google Play Console for real purchases
                without charges
              </td>
            </tr>
            <tr>
              <td>Internal Testing Track</td>
              <td>Deploy to internal testers for production-like testing</td>
            </tr>
            <tr>
              <td>Closed Testing</td>
              <td>
                Test with limited group of users before production release
              </td>
            </tr>
            <tr>
              <td>Test Cards (Sandbox)</td>
              <td>Use test payment methods configured in Play Console</td>
            </tr>
          </tbody>
        </table>
        <div
          style={{
            background: 'rgba(255, 200, 0, 0.1)',
            border: '1px solid rgba(255, 200, 0, 0.3)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginTop: '1rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            <strong>⚠️ Important:</strong> Static test product IDs like{' '}
            <code>android.test.purchased</code> are <strong>deprecated</strong>{' '}
            and no longer work. Use real product IDs with test accounts instead.{' '}
            <Link to="/docs/updates">See Updates page for details →</Link>
          </p>
        </div>

        <h3>Development Testing</h3>
        <p>
          For development testing, consider implementing mock error generators
          that can simulate various error conditions without requiring actual
          purchases. This allows you to:
        </p>
        <ul>
          <li>Test error handling UI flows</li>
          <li>Verify analytics tracking</li>
          <li>Validate retry logic</li>
          <li>Ensure proper error recovery</li>
        </ul>
      </section>
    </div>
  );
}

export default Errors;
