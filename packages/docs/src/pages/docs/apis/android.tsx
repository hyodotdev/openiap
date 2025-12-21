import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function AndroidAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Android APIs"
        description="OpenIAP Android-specific APIs - Google Play Billing APIs for acknowledgment, consumption, and alternative billing."
        path="/docs/apis/android"
        keywords="Android API, Google Play Billing, acknowledgePurchaseAndroid, alternative billing"
      />
      <h1>Android APIs</h1>
      <p>
        Android-specific APIs using Google Play Billing Library. These APIs are
        only available on Android and end with the <code>Android</code> suffix.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <code>acknowledgePurchaseAndroid</code>: Acknowledge non-consumable
            purchases
          </li>
          <li>
            <code>consumePurchaseAndroid</code>: Consume consumable purchases
          </li>
          <li>
            <strong>Alternative Billing:</strong> 3-step flow for external
            payment processing
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="purchase-completion" level="h2">
          Purchase Completion
        </AnchorLink>

        <AnchorLink id="acknowledge-purchase-android" level="h3">
          acknowledgePurchaseAndroid
        </AnchorLink>
        <p>
          Acknowledge a non-consumable purchase or subscription. Required within
          3 days or the purchase will be refunded.
        </p>
        <CodeBlock language="kotlin">{`suspend fun acknowledgePurchase(purchaseToken: String): Boolean`}</CodeBlock>
        <p>
          <strong>Note:</strong> This is called automatically by{' '}
          <Link to="/docs/apis/purchase#finish-transaction">
            finishTransaction()
          </Link>{' '}
          when <code>isConsumable</code> is <code>false</code>.
        </p>

        <AnchorLink id="consume-purchase-android" level="h3">
          consumePurchaseAndroid
        </AnchorLink>
        <p>
          Consume a consumable purchase, allowing repurchase. Automatically
          acknowledges the purchase.
        </p>
        <CodeBlock language="kotlin">{`suspend fun consumePurchase(purchaseToken: String): Boolean`}</CodeBlock>
        <p>
          <strong>Note:</strong> This is called automatically by{' '}
          <Link to="/docs/apis/purchase#finish-transaction">
            finishTransaction()
          </Link>{' '}
          when <code>isConsumable</code> is <code>true</code>.
        </p>
      </section>

      <section>
        <AnchorLink id="alternative-billing" level="h2">
          Alternative Billing APIs
        </AnchorLink>
        <p>
          Three-step flow for implementing alternative billing on Android. These
          APIs work with Google Play Billing Library 6.2+.
        </p>

        <div className="alert-card alert-card--info">
          <p>
            <strong>Configuration:</strong> Enable alternative billing mode
            during{' '}
            <Link to="/docs/apis/connection#init-connection">
              initConnection()
            </Link>{' '}
            with <code>alternativeBillingModeAndroid</code>.
          </p>
        </div>

        <AnchorLink id="check-alternative-billing-availability-android" level="h3">
          checkAlternativeBillingAvailabilityAndroid
        </AnchorLink>
        <p>
          <strong>Step 1:</strong> Check if alternative billing is available for
          this user/device.
        </p>
        <CodeBlock language="kotlin">{`// Returns true if available, false otherwise
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun checkAlternativeBillingAvailability(): Boolean`}</CodeBlock>

        <AnchorLink id="show-alternative-billing-dialog-android" level="h3">
          showAlternativeBillingDialogAndroid
        </AnchorLink>
        <p>
          <strong>Step 2:</strong> Show alternative billing information dialog
          to the user. Must be called <strong>before</strong> processing payment
          in your payment system.
        </p>
        <CodeBlock language="kotlin">{`// Returns true if user accepted, false if user canceled
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun showAlternativeBillingDialog(): Boolean`}</CodeBlock>

        <AnchorLink id="create-alternative-billing-token-android" level="h3">
          createAlternativeBillingTokenAndroid
        </AnchorLink>
        <p>
          <strong>Step 3:</strong> Create external transaction token for Google
          Play reporting. Must be called <strong>after</strong> successful
          payment in your payment system.
        </p>
        <CodeBlock language="kotlin">{`// Token must be reported to Google Play backend within 24 hours
// Returns token string, or null if creation failed
suspend fun createAlternativeBillingToken(): String?`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="alternative-billing-example" level="h2">
          Alternative Billing Flow Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  checkAlternativeBillingAvailabilityAndroid,
  showAlternativeBillingDialogAndroid,
  createAlternativeBillingTokenAndroid,
} from 'expo-iap';

async function handleAlternativePurchase() {
  // Step 1: Check availability
  const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
  if (!isAvailable) {
    // Fall back to standard billing
    return;
  }

  // Step 2: Show dialog to user
  const userAccepted = await showAlternativeBillingDialogAndroid();
  if (!userAccepted) {
    // User canceled
    return;
  }

  // Process payment in your payment system
  const paymentSuccess = await processPaymentInYourSystem();

  if (paymentSuccess) {
    // Step 3: Create token and report to Google Play
    const token = await createAlternativeBillingTokenAndroid();

    if (token) {
      // Report token to Google Play backend within 24 hours
      await reportTokenToGooglePlay(token);
    }
  }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Step 1: Check availability
val isAvailable = openIapStore.checkAlternativeBillingAvailability()
if (!isAvailable) {
    // Fall back to standard billing
    return
}

// Step 2: Show dialog to user
val userAccepted = openIapStore.showAlternativeBillingDialog()
if (!userAccepted) {
    // User canceled
    return
}

// Process payment in your payment system
val paymentSuccess = processPaymentInYourSystem()

if (paymentSuccess) {
    // Step 3: Create token and report to Google Play
    val token = openIapStore.createAlternativeBillingToken()

    token?.let {
        // Report token to Google Play backend within 24 hours
        reportTokenToGooglePlay(it)
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Step 1: Check availability
final isAvailable = await FlutterInappPurchase.instance
    .checkAlternativeBillingAvailabilityAndroid();
if (!isAvailable) {
  return; // Fall back to standard billing
}

// Step 2: Show dialog to user
final userAccepted = await FlutterInappPurchase.instance
    .showAlternativeBillingDialogAndroid();
if (!userAccepted) {
  return; // User canceled
}

// Process payment in your payment system
final paymentSuccess = await processPaymentInYourSystem();

if (paymentSuccess) {
  // Step 3: Create token and report to Google Play
  final token = await FlutterInappPurchase.instance
      .createAlternativeBillingTokenAndroid();

  if (token != null) {
    await reportTokenToGooglePlay(token);
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Important:</strong> The token from Step 3 must be reported
            to Google Play backend within 24 hours. See{' '}
            <a
              href="https://developer.android.com/google/play/billing/alternative"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google's Alternative Billing documentation
            </a>{' '}
            for backend integration details.
          </p>
        </div>
      </section>
    </div>
  );
}

export default AndroidAPIs;
