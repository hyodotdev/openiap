import StoreExampleTemplate, {
  type StoreExampleConfig,
} from './StoreExampleTemplate';
import { IOS_CONFIG } from './ios';
import { ANDROID_CONFIG } from './android';
import { HORIZON_CONFIG } from './horizon';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';

const FIREOS_VIDEO_BASE = '/examples/amazon/videos';
const FIREOS_POSTER = '/examples/amazon/home.png';
const FIREOS_VIDEO_VERSION = 'v=20260526-corrected';

function fireOsVideo(fileName: string) {
  return `${FIREOS_VIDEO_BASE}/${fileName}?${FIREOS_VIDEO_VERSION}`;
}

const PRODUCT_SKUS = [
  'dev.hyo.martie.10bulbs',
  'dev.hyo.martie.30bulbs',
  'dev.hyo.martie.certified',
];

const SUBSCRIPTION_SKUS = [
  'dev.hyo.martie.premium',
  'dev.hyo.martie.premium_year',
];

const FIREOS_CONFIG: StoreExampleConfig = {
  title: 'Fire OS Example',
  seo: {
    title: 'Fire OS Example',
    description:
      'OpenIAP Amazon Appstore IAP example walkthrough for Fire OS purchases, subscriptions, restore flows, and IAPKit verification.',
    path: '/docs/example',
    keywords:
      'OpenIAP Fire OS example, Amazon Appstore IAP, Fire tablet IAP, Amazon RVS, IAPKit verification',
  },
  storeName: 'Amazon Appstore IAP',
  sourcePath: 'packages/google/Example/',
  sourceHref:
    'https://github.com/hyodotdev/openiap/tree/main/packages/google/Example',
  intro: (
    <>
      The Fire OS recording uses the shared Android Kotlin/Compose example app
      compiled with the <code>amazon</code> flavor. It links the Amazon Appstore
      SDK, uses Amazon catalog IDs, maps receipt IDs into the OpenIAP Android
      purchase model, and verifies purchases through IAPKit when managed
      verification is enabled.
    </>
  ),
  goal: (
    <>
      prove the app is using Amazon Appstore IAP end to end: product catalog
      lookup, one-SKU purchase launch, purchase update handling, receipt ID
      verification, restore, and fulfillment.
    </>
  ),
  overview: (
    <>
      This tab shows the Fire OS version of the same example walkthrough. The
      written flow stays shared across targets; only the store surface,
      readiness checklist, and video recordings change.
    </>
  ),
  proofPoints: [
    {
      area: 'Adapter selection',
      proof: (
        <>
          The <code>amazon</code> flavor loads the Amazon module instead of Play
          Billing or Horizon Billing.
        </>
      ),
      where: 'Home badge, build flavor, and Fire OS setup.',
    },
    {
      area: 'User context',
      proof: (
        <>
          <code>initConnection</code> registers Amazon IAP callbacks and
          requests Amazon user data for receipt verification.
        </>
      ),
      where: 'First load of each purchase screen.',
    },
    {
      area: 'Catalog',
      proof: (
        <>
          <code>fetchProducts</code> maps Amazon consumables, entitlements, and
          subscriptions into OpenIAP product types.
        </>
      ),
      where: 'Product and subscription rows.',
    },
    {
      area: 'Receipt identity',
      proof: (
        <>
          Amazon <code>receiptId</code> is exposed through the Android purchase
          shape as the purchase token used by verification and fulfillment.
        </>
      ),
      where: 'Purchase details and verification payload.',
    },
    {
      area: 'Fulfillment',
      proof: (
        <>
          <code>finishTransaction</code> calls Amazon fulfillment with the
          receipt ID after validation.
        </>
      ),
      where: 'Purchase flow and unfinished transaction restore flow.',
    },
  ],
  productSkus: PRODUCT_SKUS,
  subscriptionSkus: SUBSCRIPTION_SKUS,
  purchaseRequestShape: (
    <>
      an Android-compatible request shape. The Fire OS build selects the Amazon
      module underneath and sends one SKU to Amazon Appstore IAP.
    </>
  ),
  subscriptionRequestShape: (
    <>
      an Android-compatible subscription request with the selected Amazon
      subscription SKU
    </>
  ),
  purchaseUpdateText: (
    <>
      The screen watches <code>currentPurchase</code> and the latest{' '}
      <code>PurchaseAndroid</code> update emitted by the Amazon listener.
    </>
  ),
  finishText: (
    <>
      Verify with IAPKit or your backend, call <code>finishTransaction</code>,
      then refresh <code>getAvailablePurchases</code>.
    </>
  ),
  subscriptionManagementText: (
    <>
      The Fire OS clip should call out Amazon Appstore account requirements and
      Amazon subscription management language.
    </>
  ),
  availablePurchasesText: (
    <>
      This menu is the Fire OS entitlement recovery story. On entry, refresh,
      and restore, the screen calls <code>getAvailablePurchases</code>. The
      Amazon adapter backs that with purchase updates from the signed-in Amazon
      Appstore account.
    </>
  ),
  verificationIntro: (
    <>
      This clip shows where the app switches from local Amazon purchase state to
      managed validation through IAPKit and Amazon Receipt Verification Service.
      Add the project key from{' '}
      <a
        href={IAPKIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="external-link"
        onClick={trackIapKitClick}
      >
        kit.openiap.dev
      </a>{' '}
      before recording managed verification.
    </>
  ),
  verificationItems: [
    {
      part: 'IAPKit key',
      explanation: (
        <>
          Configure <code>iapkit.api.key</code> before recording managed
          verification. Do not ship long-lived backend credentials in the app.
        </>
      ),
    },
    {
      part: 'Amazon payload',
      explanation: (
        <>
          Use <code>verifyPurchaseWithProvider</code> with an{' '}
          <code>iapkit.amazon</code> payload containing the Amazon receipt ID.
        </>
      ),
    },
    {
      part: 'Unlock decision',
      explanation: (
        <>
          Grant access only after verification succeeds; do not trust a
          client-only premium flag or a button tap.
        </>
      ),
    },
    {
      part: 'Finish order',
      explanation: (
        <>
          Finish after verification and entitlement grant because finishing
          tells Amazon that the purchase was fulfilled.
        </>
      ),
    },
  ],
  readinessTitle: 'Fire OS Readiness',
  readinessIntro: (
    <>
      Before publishing the article or sharing the video, verify these items so
      the recording reads as an Amazon Appstore integration rather than a
      generic Android screen recording.
    </>
  ),
  readinessItems: [
    {
      item: 'Build flavor',
      expected: (
        <>
          Use <code>:Example:assembleAmazonDebug</code> so the app links the
          Amazon Appstore SDK and loads the Amazon OpenIAP module.
        </>
      ),
    },
    {
      item: 'Catalog IDs',
      expected: (
        <>
          Amazon catalog entries should match the example in-app and
          subscription SKU lists.
        </>
      ),
    },
    {
      item: 'Tester account',
      expected: (
        <>
          The Fire OS tablet must be signed in with an Amazon account that can
          exercise the configured Appstore test catalog.
        </>
      ),
    },
    {
      item: 'Verification key',
      expected: (
        <>
          Set <code>iapkit.api.key</code> in{' '}
          <code>packages/google/local.properties</code> before recording the
          IAPKit clip.
        </>
      ),
    },
    {
      item: 'Sandbox receipts',
      expected: (
        <>
          Use the IAPKit Amazon payload with <code>sandbox: true</code> for
          tester receipts so RVS validation uses the correct environment.
        </>
      ),
    },
  ],
  frameworkIntro: (
    <>
      The Fire OS video proves the Amazon adapter at the native store layer
      first. App teams can move the same lifecycle into Expo, React Native,
      Flutter, Kotlin Multiplatform, .NET MAUI, and Godot without inventing new
      operation names.
    </>
  ),
  frameworkNote: (
    <>
      For Amazon, pass the IAPKit Amazon payload with the receipt ID. Expo and
      React Native reuse the Android purchase request shape while the Fire OS
      build selects the Amazon native module underneath.
    </>
  ),
  frameworkVerificationApi: {
    label: 'verifyPurchaseWithProvider',
    to: '/docs/features/validation#verify-purchase-with-provider',
  },
  frameworkSnippet: `import {
  type Purchase,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  verifyPurchaseWithProvider,
} from 'expo-iap';

const products = await fetchProducts({
  skus: ['dev.hyo.martie.10bulbs'],
  type: 'in-app',
});
const [product] = products ?? [];
if (!product) throw new Error('Amazon product not found');

await requestPurchase({
  request: { google: { skus: [product.id] } },
  type: 'in-app',
});

async function onPurchaseUpdated(purchase: Purchase) {
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: {
      amazon: {
        receiptId: purchase.purchaseToken ?? purchase.id,
        sandbox: true,
      },
    },
  });

  if (result.iapkit?.isValid) {
    await finishTransaction({ purchase, isConsumable: true });
    await getAvailablePurchases();
  }
}`,
  buildCommand: `cd packages/google
./gradlew :Example:assembleAmazonDebug
./gradlew :Example:installAmazonDebug

adb shell monkey -p dev.hyo.martie -c android.intent.category.LAUNCHER 1`,
  videos: {
    overview: {
      title: 'Overview',
      description:
        'App launch, Fire OS store context, and the feature menu used throughout the walkthrough.',
      src: fireOsVideo('fireos-overview.mp4'),
      poster: FIREOS_POSTER,
    },
    purchase: {
      title: 'Purchase Flow',
      description:
        'Consumable product screen, product fetch, purchase action, and verification result area.',
      src: fireOsVideo('fireos-inapp.mp4'),
      poster: FIREOS_POSTER,
    },
    subscription: {
      title: 'Subscription Flow',
      description:
        'Subscription product screen, offer list, subscription action, and Amazon tester requirements.',
      src: fireOsVideo('fireos-subscription.mp4'),
      poster: FIREOS_POSTER,
    },
    available: {
      title: 'Available Purchases',
      description:
        'Restore and available-purchase screen for entitlement recovery and receipt inspection.',
      src: fireOsVideo('fireos-available-purchases.mp4'),
      poster: FIREOS_POSTER,
    },
    verification: {
      title: 'Purchase Verification',
      description:
        'IAPKit verification wiring, local app state, and where Amazon RVS-backed results appear.',
      src: fireOsVideo('fireos-verification.mp4'),
      poster: FIREOS_POSTER,
    },
  },
};

const VIDEO_TARGETS = [
  { id: 'apple', label: 'Apple', config: IOS_CONFIG },
  { id: 'google', label: 'Google', config: ANDROID_CONFIG },
  { id: 'horizon', label: 'Horizon OS', config: HORIZON_CONFIG },
  { id: 'fireos', label: 'Fire OS', config: FIREOS_CONFIG },
];

function variantsFor(key: keyof StoreExampleConfig['videos']) {
  return VIDEO_TARGETS.map((target) => {
    const video = target.config.videos[key];

    return {
      id: target.id,
      label: target.label,
      title: video.title,
      description: video.description,
      src: video.src,
      poster: video.poster,
    };
  });
}

const EXAMPLE_CONFIG: StoreExampleConfig = {
  ...FIREOS_CONFIG,
  title: 'Example',
  seo: {
    title: 'Example',
    description:
      'Run the OpenIAP example app and compare store-specific recordings for Apple, Google, Horizon OS, and Fire OS.',
    path: '/docs/example',
    keywords:
      'OpenIAP example app, IAP example video, App Store IAP, Google Play Billing, Meta Horizon Billing, Amazon Appstore IAP',
  },
  storeName: 'store adapter',
  intro: (
    <>
      The OpenIAP example uses the same product, subscription, restore, and
      verification screens across store targets. The written walkthrough stays
      shared; each video card lets you switch between Apple, Google, Horizon OS,
      and Fire OS recordings for the same action.
    </>
  ),
  goal: (
    <>
      prove the store adapter works end to end: catalog lookup, purchase launch,
      purchase update handling, verification, restore, and final transaction
      fulfillment.
    </>
  ),
  overview: (
    <>
      Each clip is recorded from the store-specific example build, but the
      sequence is intentionally the same so the article can compare store
      behavior without duplicating the whole document.
    </>
  ),
  overviewImage: {
    src: FIREOS_POSTER,
    alt: 'OpenIAP example app home screen',
  },
  proofPoints: [
    {
      area: 'Adapter selection',
      proof: (
        <>
          The selected build links the matching store adapter: StoreKit 2,
          Google Play Billing, Meta Horizon Billing, or Amazon Appstore IAP.
        </>
      ),
      where: 'Home badge, build flavor, and setup notes.',
    },
    {
      area: 'Connection',
      proof: (
        <>
          <code>initConnection</code> prepares the store listener before product
          or transaction calls run.
        </>
      ),
      where: 'First load of each purchase screen.',
    },
    {
      area: 'Catalog',
      proof: (
        <>
          <code>fetchProducts</code> maps store catalog data into OpenIAP
          product and subscription types.
        </>
      ),
      where: 'Product and subscription rows.',
    },
    {
      area: 'Purchase identity',
      proof: (
        <>
          Store transaction IDs, purchase tokens, receipt IDs, or signed
          transaction data are carried through the OpenIAP purchase shape for
          verification and finish.
        </>
      ),
      where: 'Purchase details and verification payload.',
    },
    {
      area: 'Fulfillment',
      proof: (
        <>
          <code>finishTransaction</code> runs only after validation and
          entitlement grant.
        </>
      ),
      where: 'Purchase flow and unfinished transaction restore flow.',
    },
  ],
  purchaseRequestShape: <>the store-compatible request shape for that target</>,
  subscriptionRequestShape: (
    <>the store-compatible subscription request shape for that target</>
  ),
  purchaseUpdateText: (
    <>
      The screen watches the latest OpenIAP purchase update emitted by the store
      listener.
    </>
  ),
  finishText: (
    <>
      Verify with IAPKit or your backend, call <code>finishTransaction</code>,
      then refresh <code>getAvailablePurchases</code>.
    </>
  ),
  subscriptionManagementText: (
    <>
      The selected video shows the target store's subscription confirmation,
      management, or tester-account requirements.
    </>
  ),
  availablePurchasesText: (
    <>
      This menu is the entitlement recovery story. On entry, refresh, and
      restore, the screen calls <code>getAvailablePurchases</code> so the app
      can rebuild local access from the active store account.
    </>
  ),
  verificationIntro: (
    <>
      This clip shows where the app switches from local store state to trusted
      validation. IAPKit provider verification uses{' '}
      <code>verifyPurchaseWithProvider</code>, while custom backends can call
      the same store-specific verification services from a trusted environment.
    </>
  ),
  verificationItems: [
    {
      part: 'Provider payload',
      explanation: (
        <>
          Send the matching IAPKit payload for Apple, Google, Amazon, or Horizon
          instead of shipping provider secrets in the app.
        </>
      ),
    },
    {
      part: 'Store evidence',
      explanation: (
        <>
          Include the signed transaction, purchase token, receipt ID, or
          entitlement data required by the selected store.
        </>
      ),
    },
    {
      part: 'Unlock decision',
      explanation: (
        <>
          Grant access only after the verified response matches the expected
          product and account state.
        </>
      ),
    },
    {
      part: 'Finish order',
      explanation: (
        <>Finish the transaction after verification and entitlement grant.</>
      ),
    },
  ],
  readinessTitle: 'Recording Readiness',
  readinessIntro: (
    <>
      Before publishing the article or sharing the video, verify the target
      store setup so each tab reads as a real integration rather than a generic
      screen recording.
    </>
  ),
  readinessItems: [
    {
      item: 'Build target',
      expected: (
        <>
          Install the matching example build for Apple, Google, Horizon OS, or
          Fire OS before recording that tab.
        </>
      ),
    },
    {
      item: 'Catalog IDs',
      expected: (
        <>
          Store catalog entries should match the example in-app and subscription
          SKU lists.
        </>
      ),
    },
    {
      item: 'Tester account',
      expected: (
        <>
          Use a sandbox, license tester, Quest tester, or Amazon tester account
          that can open the purchase sheet.
        </>
      ),
    },
    {
      item: 'Verification key',
      expected: (
        <>
          Configure the IAPKit key or backend endpoint before recording the
          verification clip.
        </>
      ),
    },
  ],
  frameworkIntro: (
    <>
      The native examples prove the store layer first. App teams can move the
      same lifecycle into Expo, React Native, Flutter, Kotlin Multiplatform,
      .NET MAUI, and Godot without changing the OpenIAP operation names.
    </>
  ),
  frameworkNote: (
    <>
      Use the provider payload for the selected store. The request shape changes
      by language and platform, but the lifecycle remains fetch, request,
      verify, finish, and refresh.
    </>
  ),
  videos: {
    overview: {
      title: 'Overview',
      description:
        'Switch tabs to compare the same example home flow across store targets.',
      variants: variantsFor('overview'),
    },
    purchase: {
      title: 'Purchase Flow',
      description:
        'Switch tabs to compare the same in-app purchase action across store targets.',
      variants: variantsFor('purchase'),
    },
    subscription: {
      title: 'Subscription Flow',
      description:
        'Switch tabs to compare the same subscription action across store targets.',
      variants: variantsFor('subscription'),
    },
    available: {
      title: 'Available Purchases',
      description:
        'Switch tabs to compare restore and entitlement recovery across store targets.',
      variants: variantsFor('available'),
    },
    verification: {
      title: 'Purchase Verification',
      description:
        'Switch tabs to compare the verification handoff across store targets.',
      variants: variantsFor('verification'),
    },
  },
};

function ExampleIndex() {
  return <StoreExampleTemplate config={EXAMPLE_CONFIG} />;
}

export default ExampleIndex;
