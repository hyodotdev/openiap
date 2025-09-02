import { useScrollToHash } from '../../hooks/useScrollToHash';
import AnchorLink from '../../components/AnchorLink';

function Versions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Version History</h1>

      <section>
        <AnchorLink id="v1-0-1" level="h2">
          v1.0.1 (2025.09)
        </AnchorLink>
        <ul>
          <li>
            Added comprehensive iOS API documentation (19 APIs with IOS suffix)
          </li>
          <li>
            Added missing Android APIs
            (flushFailedPurchaseCachedAsPendingAndroid, getPackageNameAndroid)
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
