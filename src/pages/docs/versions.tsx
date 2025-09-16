import { useScrollToHash } from '../../hooks/useScrollToHash';
import AnchorLink from '../../components/AnchorLink';

// Single source of truth for the latest version string
export const LATEST_VERSION = 'v1.1.11';

function Versions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Version History</h1>

      <section>
        <AnchorLink id="v1-1-11" level="h2">
          {LATEST_VERSION} (2025.10)
        </AnchorLink>
        <ul>
          <li>
            <strong>Docs Alignment:</strong>
            <ul>
              <li>
                Adopted the <code>RequestPurchaseProps</code> wrapper and
                per-platform params naming across type docs and API references.
              </li>
              <li>
                Synced search metadata and protocol examples with the
                <code>props.params</code> structure used in the latest SDKs.
              </li>
            </ul>
          </li>
          <li>
            <strong>Error Code Consistency:</strong>
            <ul>
              <li>
                Documented <code>ErrorCode</code> enum values using the
                canonical <code>E_SNAKE_CASE</code> strings returned by OpenIAP
                modules.
              </li>
            </ul>
          </li>
          <li>
            <strong>Release Coordination:</strong> Skipped intermediate 1.1.x
            tags so the docs version stays aligned with other OpenIAP libraries
            that shipped coordinated updates.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="v1-1-1" level="h2">
          v1.1.1 (2025.09)
        </AnchorLink>
        <ul>
          <li>
            <strong>Type Enhancements:</strong>
            <ul>
              <li>
                Enhanced ActiveSubscription interface with backend validation
                fields:
                <ul>
                  <li>Added transactionId for transaction identification</li>
                  <li>
                    Added purchaseToken for JWT (iOS) or purchase token
                    (Android)
                  </li>
                  <li>Added transactionDate for transaction timestamp</li>
                </ul>
              </li>
            </ul>
          </li>
          <li>
            <strong>API Documentation Updates:</strong>
            <ul>
              <li>
                Updated showManageSubscriptionsIOS to correctly reflect it
                returns Purchase[] containing subscriptions with changed
                auto-renewal status
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="v1-1-0" level="h2">
          v1.1.0 (2025.09)
        </AnchorLink>
        <ul>
          <li>
            <strong>Type System Improvements:</strong>
            <ul>
              <li>Renamed PaymentDiscount → DiscountOffer for clarity</li>
              <li>
                Added comprehensive ErrorCode enum with 34 error constants
              </li>
              <li>
                Fixed fetchProducts type parameter behavior (fetches both types
                when not specified)
              </li>
            </ul>
          </li>
          <li>
            <strong>Documentation Restructuring:</strong>
            <ul>
              <li>
                Added PlatformTabs component with iOS/Android content separation
                and smooth animations
              </li>
              <li>
                Restructured Platform-Specific Types and Error Handling with
                tabbed navigation
              </li>
              <li>
                Unified ErrorCode enum location and removed duplicate error
                tables
              </li>
              <li>Added info-note styling and retry strategy notes</li>
              <li>
                Changed "ProductCommon" to "Common Fields" throughout
                documentation
              </li>
            </ul>
          </li>
        </ul>
        <div className="version-links">
          <strong>Key Changes:</strong>
          <ul>
            <li>Type definitions now match actual implementation exactly</li>
            <li>Platform-specific documentation clearly separated</li>
            <li>
              Unified error handling approach with comprehensive error codes
            </li>
            <li>
              Improved developer experience with clearer naming conventions
            </li>
          </ul>
        </div>
      </section>

      <section>
        <AnchorLink id="v1-0-1" level="h2">
          v1.0.1 (2025.09)
        </AnchorLink>
        <ul>
          <li>
            Added comprehensive iOS API documentation (19 APIs with IOS suffix)
          </li>
          <li>Added getAppTransactionIOS documentation (iOS 16+)</li>
          <li>Fixed camelCase to kebab-case conversion in search modal</li>
          <li>Updated API naming conventions following expo-iap standards</li>
        </ul>
        <div className="version-links">
          <strong>Implementations:</strong>
          <ul>
            <li>
              <a
                href="https://github.com/hyochan/react-native-iap/pull/2986"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                react-native-iap#2986 - Add iOS/Android naming conventions
              </a>
            </li>
            <li>
              <a
                href="https://github.com/hyochan/expo-iap/pull/182"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                expo-iap#182 - Implement platform-specific API naming
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <AnchorLink id="v1-0-0" level="h2">
          v1.0.0 (2025.08)
        </AnchorLink>
        <ul>
          <li>Initial release of OpenIAP documentation</li>
          <li>Complete API reference</li>
          <li>Platform setup guides</li>
          <li>Type definitions</li>
        </ul>
        <div className="version-links">
          <strong>Supported Libraries:</strong>
          <ul>
            <li>
              <a
                href="https://github.com/hyochan/react-native-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                react-native-iap - React Native in-app purchases
              </a>
            </li>
            <li>
              <a
                href="https://github.com/hyochan/expo-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                expo-iap - Expo in-app purchases module
              </a>
            </li>
            <li>
              <a
                href="https://github.com/hyochan/kmp-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                kmp-iap - Kotlin Multiplatform in-app purchases
              </a>
            </li>
            <li>
              <a
                href="https://github.com/hyochan/flutter_inapp_purchase"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                flutter_inapp_purchase - Flutter in-app purchases plugin
              </a>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export default Versions;
