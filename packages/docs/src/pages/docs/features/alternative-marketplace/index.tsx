import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function AlternativeMarketplace() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Alternative Marketplace"
        description="Integrate alternative app marketplaces for iOS in-app purchases. Support EU DMA-compliant third-party stores with OpenIAP."
        path="/docs/features/alternative-marketplace"
        keywords="alternative marketplace, DMA, EU, third-party store, iOS, MarketplaceKit"
      />
      <h1>Alternative Marketplace</h1>

      <section>
        <p>
          Alternative marketplaces are third-party app stores that distribute
          iOS apps outside of Apple's App Store. With the EU Digital Markets Act
          (DMA), Apple is required to allow alternative marketplaces on iOS
          starting with iOS 17.4. This opens up new distribution and
          monetization channels for developers — including the ability to
          process in-app purchases through the marketplace's own payment system
          rather than Apple's.
        </p>
        <p>
          OpenIAP integrates with alternative marketplaces so that your existing
          purchase code works seamlessly regardless of where the app was
          installed from. The library automatically detects the installation
          source using <code>MarketplaceKit</code> and routes IAP calls to the
          appropriate payment module.
        </p>

        <AnchorLink id="how-it-works" level="h3">
          How It Works
        </AnchorLink>
        <ul>
          <li>
            <strong>Auto-detection:</strong> On iOS 17.4+,{' '}
            <code>MarketplaceKit</code> identifies which store distributed the
            app at runtime
          </li>
          <li>
            <strong>Unified API:</strong> The same <code>useIAP</code> hook,{' '}
            <code>fetchProducts</code>, <code>requestPurchase</code>, and other
            methods work identically — no platform-specific code needed
          </li>
          <li>
            <strong>Fail-safe:</strong> If the app was installed from the App
            Store (or the marketplace cannot be determined), standard Apple
            StoreKit is used automatically
          </li>
        </ul>

        <div className="alert-card alert-card--info">
          <p>
            <strong>Expanding support:</strong> Currently, <code>expo-iap</code>{' '}
            supports <strong>Onside</strong> as the first alternative
            marketplace integration. As the ecosystem evolves, additional
            marketplaces may be supported across other OpenIAP framework
            libraries (react-native-iap, flutter_inapp_purchase, kmp-iap,
            godot-iap) based on demand and partnership agreements.
          </p>
        </div>
      </section>

      <section>
        <AnchorLink id="supported-marketplaces" level="h2">
          Supported Marketplaces
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Marketplace</th>
              <th>Region</th>
              <th>Framework</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/features/alternative-marketplace/onside">
                  Onside
                </Link>
              </td>
              <td>EU (DMA)</td>
              <td>expo-iap</td>
              <td>Available</td>
            </tr>
          </tbody>
        </table>
        <p>
          If you're a marketplace provider interested in OpenIAP integration,
          please{' '}
          <a
            href="https://github.com/hyodotdev/openiap/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            open an issue on GitHub
          </a>
          .
        </p>
      </section>

      <section>
        <AnchorLink id="see-also" level="h2">
          See Also
        </AnchorLink>
        <ul>
          <li>
            <Link to="/docs/features/external-purchase">
              External Purchase / Alternative Billing
            </Link>{' '}
            — Platform-native external purchase APIs (different from marketplace
            integration)
          </li>
          <li>
            <Link to="/docs/setup/expo">Expo Setup</Link> — expo-iap
            installation and config plugin options
          </li>
        </ul>
      </section>
    </div>
  );
}

export default AlternativeMarketplace;
