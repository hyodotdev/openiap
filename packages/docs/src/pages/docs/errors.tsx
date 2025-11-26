import { Link } from 'react-router-dom';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
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
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`interface PurchaseError {
  code: string;          // Error code constant
  message: string;       // Human-readable message
  productId?: string;    // Related product SKU (if applicable)
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`struct PurchaseError: Error {
    let code: String      // Error code constant
    let message: String   // Human-readable message
    let productId: String? // Related product SKU (if applicable)
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class PurchaseError(
    val code: String,           // Error code constant
    val message: String,        // Human-readable message
    val productId: String? = null // Related product SKU (if applicable)
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`class PurchaseError {
  final String code;      // Error code constant
  final String message;   // Human-readable message
  final String? productId; // Related product SKU (if applicable)
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
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
                <code>UserCancelled</code>
              </td>
              <td>User cancelled the purchase flow</td>
              <td>No action needed, expected behavior</td>
            </tr>
            <tr>
              <td>
                <code>UserError</code>
              </td>
              <td>User-related error during purchase</td>
              <td>Check user account status</td>
            </tr>
            <tr>
              <td>
                <code>DeferredPayment</code>
              </td>
              <td>Payment was deferred (pending family approval, etc.)</td>
              <td>Wait for payment approval</td>
            </tr>
            <tr>
              <td>
                <code>Interrupted</code>
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
                <code>ItemUnavailable</code>
              </td>
              <td>Product not available in store</td>
              <td>Check product configuration in store console</td>
            </tr>
            <tr>
              <td>
                <code>SkuNotFound</code>
              </td>
              <td>SKU not found in product list</td>
              <td>Verify SKU exists in store configuration</td>
            </tr>
            <tr>
              <td>
                <code>SkuOfferMismatch</code>
              </td>
              <td>SKU offer ID mismatch</td>
              <td>Check offer configuration for the SKU</td>
            </tr>
            <tr>
              <td>
                <code>QueryProduct</code>
              </td>
              <td>Failed to query product details</td>
              <td>Check product IDs and retry</td>
            </tr>
            <tr>
              <td>
                <code>AlreadyOwned</code>
              </td>
              <td>Item already owned by user</td>
              <td>Restore purchases to unlock content</td>
            </tr>
            <tr>
              <td>
                <code>ItemNotOwned</code>
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
                <code>NetworkError</code>
              </td>
              <td>Network connection error</td>
              <td>Check internet connection and retry</td>
            </tr>
            <tr>
              <td>
                <code>ServiceError</code>
              </td>
              <td>Store service error</td>
              <td>Wait and retry, check store service status</td>
            </tr>
            <tr>
              <td>
                <code>RemoteError</code>
              </td>
              <td>Remote server error</td>
              <td>Check server logs, retry request</td>
            </tr>
            <tr>
              <td>
                <code>InitConnection</code>
              </td>
              <td>Failed to initialize store connection</td>
              <td>Check store service availability and retry</td>
            </tr>
            <tr>
              <td>
                <code>ServiceDisconnected</code>
              </td>
              <td>Store service disconnected</td>
              <td>Reconnect to the store service</td>
            </tr>
            <tr>
              <td>
                <code>ConnectionClosed</code>
              </td>
              <td>Connection to store service was closed</td>
              <td>Reinitialize connection and retry</td>
            </tr>
            <tr>
              <td>
                <code>IapNotAvailable</code>
              </td>
              <td>In-app purchase service not available</td>
              <td>Check device settings and IAP availability</td>
            </tr>
            <tr>
              <td>
                <code>BillingUnavailable</code>
              </td>
              <td>Billing service is unavailable</td>
              <td>Check Google Play/App Store availability</td>
            </tr>
            <tr>
              <td>
                <code>FeatureNotSupported</code>
              </td>
              <td>Requested feature not supported</td>
              <td>Check device/OS version compatibility</td>
            </tr>
            <tr>
              <td>
                <code>SyncError</code>
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
                <code>ReceiptFailed</code>
              </td>
              <td>Receipt validation failed</td>
              <td>Check receipt validation logic, retry validation</td>
            </tr>
            <tr>
              <td>
                <code>ReceiptFinished</code>
              </td>
              <td>Receipt already processed/finished</td>
              <td>Transaction already completed, check records</td>
            </tr>
            <tr>
              <td>
                <code>ReceiptFinishedFailed</code>
              </td>
              <td>Failed to finish receipt processing</td>
              <td>Check transaction state and retry</td>
            </tr>
            <tr>
              <td>
                <code>TransactionValidationFailed</code>
              </td>
              <td>Transaction validation failed</td>
              <td>Verify transaction data and retry</td>
            </tr>
            <tr>
              <td>
                <code>EmptySkuList</code>
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
              <td>NetworkError</td>
              <td>Yes</td>
              <td>Exponential backoff (2^n seconds)</td>
            </tr>
            <tr>
              <td>ServiceError</td>
              <td>Yes</td>
              <td>Linear backoff (n * 5 seconds)</td>
            </tr>
            <tr>
              <td>RemoteError</td>
              <td>Yes</td>
              <td>Fixed delay (10 seconds)</td>
            </tr>
            <tr>
              <td>ConnectionClosed</td>
              <td>Yes</td>
              <td>Reinitialize and retry</td>
            </tr>
            <tr>
              <td>SyncError</td>
              <td>Yes</td>
              <td>Exponential backoff</td>
            </tr>
            <tr>
              <td>UserCancelled</td>
              <td>No</td>
              <td>Do not retry</td>
            </tr>
            <tr>
              <td>AlreadyOwned</td>
              <td>No</td>
              <td>Restore instead</td>
            </tr>
            <tr>
              <td>DeferredPayment</td>
              <td>No</td>
              <td>Wait for approval</td>
            </tr>
            <tr>
              <td>NotPrepared</td>
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
                      <td>Unknown</td>
                      <td>Unknown error</td>
                    </tr>
                    <tr>
                      <td>1</td>
                      <td>UserCancelled</td>
                      <td>User cancelled transaction</td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>NetworkError</td>
                      <td>Network unavailable</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>ItemUnavailable</td>
                      <td>Product not available</td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>ServiceError</td>
                      <td>App Store service error</td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>ReceiptFailed</td>
                      <td>Receipt validation failed</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>AlreadyOwned</td>
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
                      <td>UserCancelled</td>
                      <td>User pressed back or cancelled</td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>ServiceError</td>
                      <td>Network connection down</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>ServiceError</td>
                      <td>Billing API unavailable</td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>ItemUnavailable</td>
                      <td>Requested product not available</td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>DeveloperError</td>
                      <td>Invalid arguments provided</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>Unknown</td>
                      <td>Fatal error during API action</td>
                    </tr>
                    <tr>
                      <td>7</td>
                      <td>AlreadyOwned</td>
                      <td>Item already owned</td>
                    </tr>
                    <tr>
                      <td>8</td>
                      <td>ItemNotOwned</td>
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
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`enum ErrorCode {
  Unknown = 'E_UNKNOWN',
  UserCancelled = 'E_USER_CANCELLED',
  UserError = 'E_USER_ERROR',
  ItemUnavailable = 'E_ITEM_UNAVAILABLE',
  RemoteError = 'E_REMOTE_ERROR',
  NetworkError = 'E_NETWORK_ERROR',
  ServiceError = 'E_SERVICE_ERROR',
  ReceiptFailed = 'E_RECEIPT_FAILED',
  ReceiptFinished = 'E_RECEIPT_FINISHED',
  ReceiptFinishedFailed = 'E_RECEIPT_FINISHED_FAILED',
  NotPrepared = 'E_NOT_PREPARED',
  NotEnded = 'E_NOT_ENDED',
  AlreadyOwned = 'E_ALREADY_OWNED',
  DeveloperError = 'E_DEVELOPER_ERROR',
  BillingResponseJsonParseError = 'E_BILLING_RESPONSE_JSON_PARSE_ERROR',
  DeferredPayment = 'E_DEFERRED_PAYMENT',
  Interrupted = 'E_INTERRUPTED',
  IapNotAvailable = 'E_IAP_NOT_AVAILABLE',
  PurchaseError = 'E_PURCHASE_ERROR',
  SyncError = 'E_SYNC_ERROR',
  TransactionValidationFailed = 'E_TRANSACTION_VALIDATION_FAILED',
  ActivityUnavailable = 'E_ACTIVITY_UNAVAILABLE',
  AlreadyPrepared = 'E_ALREADY_PREPARED',
  Pending = 'E_PENDING',
  ConnectionClosed = 'E_CONNECTION_CLOSED',
  InitConnection = 'E_INIT_CONNECTION',
  ServiceDisconnected = 'E_SERVICE_DISCONNECTED',
  QueryProduct = 'E_QUERY_PRODUCT',
  SkuNotFound = 'E_SKU_NOT_FOUND',
  SkuOfferMismatch = 'E_SKU_OFFER_MISMATCH',
  ItemNotOwned = 'E_ITEM_NOT_OWNED',
  BillingUnavailable = 'E_BILLING_UNAVAILABLE',
  FeatureNotSupported = 'E_FEATURE_NOT_SUPPORTED',
  EmptySkuList = 'E_EMPTY_SKU_LIST',
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`enum OpenIapError: Error {
    case unknown
    case userCancelled
    case userError
    case itemUnavailable
    case remoteError
    case networkError
    case serviceError
    case receiptFailed
    case receiptFinished
    case receiptFinishedFailed
    case notPrepared
    case notEnded
    case alreadyOwned
    case developerError
    case billingResponseJsonParseError
    case deferredPayment
    case interrupted
    case iapNotAvailable
    case purchaseError
    case syncError
    case transactionValidationFailed
    case activityUnavailable
    case alreadyPrepared
    case pending
    case connectionClosed
    case initConnection
    case serviceDisconnected
    case queryProduct
    case skuNotFound
    case skuOfferMismatch
    case itemNotOwned
    case billingUnavailable
    case featureNotSupported
    case emptySkuList
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`enum class OpenIapError {
    Unknown,
    UserCancelled,
    UserError,
    ItemUnavailable,
    RemoteError,
    NetworkError,
    ServiceError,
    ReceiptFailed,
    ReceiptFinished,
    ReceiptFinishedFailed,
    NotPrepared,
    NotEnded,
    AlreadyOwned,
    DeveloperError,
    BillingResponseJsonParseError,
    DeferredPayment,
    Interrupted,
    IapNotAvailable,
    PurchaseError,
    SyncError,
    TransactionValidationFailed,
    ActivityUnavailable,
    AlreadyPrepared,
    Pending,
    ConnectionClosed,
    InitConnection,
    ServiceDisconnected,
    QueryProduct,
    SkuNotFound,
    SkuOfferMismatch,
    ItemNotOwned,
    BillingUnavailable,
    FeatureNotSupported,
    EmptySkuList,
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`enum IAPError {
  unknown,
  userCancelled,
  userError,
  itemUnavailable,
  remoteError,
  networkError,
  serviceError,
  receiptFailed,
  receiptFinished,
  receiptFinishedFailed,
  notPrepared,
  notEnded,
  alreadyOwned,
  developerError,
  billingResponseJsonParseError,
  deferredPayment,
  interrupted,
  iapNotAvailable,
  purchaseError,
  syncError,
  transactionValidationFailed,
  activityUnavailable,
  alreadyPrepared,
  pending,
  connectionClosed,
  initConnection,
  serviceDisconnected,
  queryProduct,
  skuNotFound,
  skuOfferMismatch,
  itemNotOwned,
  billingUnavailable,
  featureNotSupported,
  emptySkuList,
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
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
              <td>ReceiptFailed</td>
            </tr>
            <tr>
              <td>test.purchase.cancelled@example.com</td>
              <td>UserCancelled</td>
            </tr>
            <tr>
              <td>test.purchase.unavailable@example.com</td>
              <td>ItemUnavailable</td>
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
