import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import StoreConnectionCallout from '../../../components/StoreConnectionCallout';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function GetStorefront() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getStorefront"
        description="Get the storefront country code for the active user."
        path="/docs/apis/get-storefront"
        keywords="getStorefront, country code, storefront, region"
      />
      <h1>getStorefront</h1>
      <p>Get the storefront country code for the active user.</p>
      <p>
        <strong>iOS:</strong> Reads <code>Storefront.current?.countryCode</code>{' '}
        (StoreKit 2). Returns the user's App Store storefront, not the device
        locale.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/storefront"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Reads <code>BillingConfig.countryCode</code>{' '}
        from <code>BillingClient.getBillingConfigAsync</code>. Reflects the Play
        Store account region, not the SIM/device locale.{' '}
        <a
          href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#getBillingConfigAsync(com.android.billingclient.api.GetBillingConfigParams,com.android.billingclient.api.BillingConfigResponseListener)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>

      <StoreConnectionCallout />

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`getStorefront(): Promise<string>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func getStorefront() async throws -> String`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getStorefront(): String`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun getStorefront(): String`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<String> getStorefront();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<string> GetStorefrontAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_storefront() -> String`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;string&gt;</code> — the store account&apos;s country
        code. StoreKit returns ISO 3166-1 alpha-3 (for example{' '}
        <code>"USA"</code> or <code>"KOR"</code>). Google Play Billing and
        Horizon return alpha-2 country codes, while Amazon returns its
        alpha-2-like <code>UserData.marketplace</code> value (for example{' '}
        <code>"US"</code> or <code>"DE"</code>). This is not the device locale.
        A failed store lookup rejects or throws a platform-mapped purchase
        error.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { getStorefront } from 'expo-iap';
// Same API in react-native-iap:
// import { getStorefront } from 'react-native-iap';

const countryCode = await getStorefront();
console.log(countryCode); // iOS: "USA"; Android/Amazon: "US"

// --- Or alongside the useIAP() hook (also exported from react-native-iap) ---
// getStorefront is a module-level helper; useIAP doesn't expose it on the
// hook return, so call the module function from inside your component once
// the hook reports the connection is ready.
import { useIAP } from 'expo-iap';

function StorefrontBadge() {
  const { connected } = useIAP();
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (!connected) return;
    void getStorefront().then(setCountry);
  }, [connected]);

  return <Text>Storefront: {country}</Text>;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let countryCode = try await OpenIapModule.shared.getStorefront()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val countryCode = openIapStore.getStorefront()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val countryCode = kmpIAP.getStorefront()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final countryCode = await FlutterInappPurchase.instance.getStorefront();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var countryCode = await ((QueryResolver)OpenIapClient.Instance).GetStorefrontAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var country_code = await iap.get_storefront()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetStorefront;
