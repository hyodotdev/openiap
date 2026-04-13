import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function AlternativeMarketplaceOnside() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Onside Integration"
        description="Integrate Onside alternative marketplace for iOS in-app purchases in Expo apps. EU DMA-compliant third-party store support."
        path="/docs/features/alternative-marketplace/onside"
        keywords="Onside, alternative marketplace, DMA, EU, expo-iap, MarketplaceKit"
      />
      <h1>Onside Integration</h1>

      <p>
        <a href="https://onside.io" target="_blank" rel="noopener noreferrer">
          Onside
        </a>{' '}
        is an alternative app marketplace for iOS designed for the European
        Union under the DMA. It allows developers to offer in-app purchases
        through Onside's payment system with potentially lower fees than Apple's
        App Store.
      </p>
      <p>
        Currently supported in <strong>expo-iap</strong>. The best part:{' '}
        <strong>you don't need to change your purchase code</strong>. The
        library automatically switches between Apple and Onside depending on
        where the user installed your app.
      </p>

      <section>
        <AnchorLink id="features" level="h2">
          Features
        </AnchorLink>
        <ul>
          <li>
            <strong>Auto-Switch:</strong> The library detects the installation
            source and uses Onside or Apple IAP accordingly — no code changes
            needed
          </li>
          <li>
            <strong>Unified API:</strong> Use your existing <code>useIAP</code>{' '}
            hooks as-is
          </li>
          <li>
            <strong>Easy Setup:</strong> The Expo config plugin handles all
            native configuration
          </li>
          <li>
            <strong>Clean Queue:</strong> Automatically cleans up failed or
            cancelled Onside transactions so they don't reappear on next launch
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="requirements" level="h2">
          Requirements
        </AnchorLink>
        <ul>
          <li>
            <strong>Register your app</strong> at{' '}
            <a
              href="https://developer.onside.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              developer.onside.io
            </a>{' '}
            (mandatory)
          </li>
          <li>
            <strong>iOS 16.0+</strong> required (iOS 17.4+ for MarketplaceKit
            auto-detection)
          </li>
          <li>
            <strong>Onside Store</strong> must be installed on the user's device
            to process payments
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="setup" level="h2">
          Setup (3 Steps)
        </AnchorLink>

        <h3>Step 1: Enable the module</h3>
        <p>
          Add the Onside module to your Expo config. Make sure you have a{' '}
          <code>bundleIdentifier</code> configured.
        </p>
        <CodeBlock language="json">
          {`{
  "expo": {
    "plugins": [
      ["expo-iap", { "modules": { "onside": true } }]
    ]
  }
}`}
        </CodeBlock>

        <h3>Step 2: Initialize at startup</h3>
        <p>
          The library chooses the payment module (Onside or Apple) the first
          time IAP is used. The Onside check must <strong>finish before</strong>{' '}
          any code uses <code>useIAP</code> or other IAP methods. If IAP is used
          before the check completes, the library will default to Apple IAP.
        </p>

        <h4>Option A: Using the hook (Recommended)</h4>
        <p>
          Block rendering until the check is done. This guarantees the correct
          module is used:
        </p>
        <CodeBlock language="typescript">
          {`import { useOnside } from 'expo-iap';

export default function App() {
  const { isOnsideLoading } = useOnside();

  if (isOnsideLoading) return <SplashScreen />;

  return <MainApp />;
}`}
        </CodeBlock>

        <h4>Option B: Using the function</h4>
        <p>
          If you don't block rendering, ensure no screen uses{' '}
          <code>useIAP</code> until after{' '}
          <code>checkInstallationFromOnside()</code> has resolved:
        </p>
        <CodeBlock language="typescript">
          {`import { useEffect } from 'react';
import { checkInstallationFromOnside } from 'expo-iap';

export default function App() {
  useEffect(() => {
    checkInstallationFromOnside();
  }, []);

  return <MainApp />;
}`}
        </CodeBlock>

        <h3>Step 3: Use useIAP as always</h3>
        <p>
          Your existing purchase logic remains exactly the same. No code changes
          required:
        </p>
        <CodeBlock language="typescript">
          {`import { useIAP, finishTransaction } from 'expo-iap';

function Store() {
  const { products, fetchProducts, requestPurchase } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      // Works with both Apple and Onside purchases
      await finishTransaction(purchase, false);
    },
    onPurchaseError: (error) => {
      console.error(error.message);
    },
  });

  // ... same purchase UI code
}`}
        </CodeBlock>
      </section>

      <section>
        <AnchorLink id="tips" level="h2">
          Important Tips
        </AnchorLink>
        <ul>
          <li>
            <strong>Testing:</strong> You need a real iPhone with the{' '}
            <a
              href="https://onside.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              Onside Store
            </a>{' '}
            app installed
          </li>
          <li>
            <strong>How it works:</strong> On iOS 17.4+, MarketplaceKit detects
            the distributor. If the app was installed from Onside, the library
            uses the Onside native module for all IAP calls; otherwise it uses
            standard Apple StoreKit
          </li>
          <li>
            <strong>Fail-safe:</strong> If the app was installed from the App
            Store, it falls back to standard Apple IAP automatically
          </li>
          <li>
            <strong>CI/prebuild note:</strong> When <code>modules.onside</code>{' '}
            is enabled, the Expo config plugin updates{' '}
            <code>expo-module.config.json</code> at prebuild time. Run{' '}
            <code>npx expo prebuild</code> in CI or before committing after
            changing the Onside option
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="see-also" level="h2">
          See Also
        </AnchorLink>
        <ul>
          <li>
            <Link to="/docs/features/alternative-marketplace">
              Alternative Marketplace
            </Link>{' '}
            — Overview of alternative marketplace support in OpenIAP
          </li>
          <li>
            <Link to="/docs/setup/expo#config-plugin">Expo Config Plugin</Link>{' '}
            — <code>modules.onside</code> option
          </li>
          <li>
            <a
              href="https://developer.onside.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              Onside Developer Portal
            </a>{' '}
            — Register your app and manage products
          </li>
        </ul>
      </section>
    </div>
  );
}

export default AlternativeMarketplaceOnside;
