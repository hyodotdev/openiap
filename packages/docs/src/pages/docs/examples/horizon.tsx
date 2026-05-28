import StoreExampleTemplate, {
  type StoreExampleConfig,
} from './StoreExampleTemplate';

const HORIZON_VIDEO_BASE = '/examples/horizon/videos';
const HORIZON_POSTER = '/examples/horizon/home.webp';
const HORIZON_VIDEO_VERSION = 'v=20260527-subscription-purchase';

function horizonVideo(fileName: string) {
  return `${HORIZON_VIDEO_BASE}/${fileName}?${HORIZON_VIDEO_VERSION}`;
}

export const HORIZON_CONFIG: StoreExampleConfig = {
  title: 'Horizon OS Example',
  seo: {
    title: 'Horizon OS Example',
    description:
      'OpenIAP Meta Horizon Billing example walkthrough for Quest purchases, subscriptions, restore flows, and entitlement verification.',
    path: '/docs/example/horizon',
    keywords:
      'OpenIAP Horizon example, Meta Horizon Billing example, Quest IAP video, Horizon entitlement verification',
  },
  storeName: 'Meta Horizon Billing',
  sourcePath: 'packages/google/Example/',
  sourceHref:
    'https://github.com/hyodotdev/openiap/tree/main/packages/google/Example',
  intro: (
    <>
      The Horizon OS example is the shared Android Kotlin/Compose app compiled
      with the Horizon flavor. It links Meta Horizon Billing, uses Horizon
      Developer Hub product IDs, maps Horizon purchases into the OpenIAP Android
      purchase model, and keeps entitlement verification tied to Meta's
      server-side verification path.
    </>
  ),
  goal: (
    <>
      prove the app is using Meta Horizon Billing end to end: Horizon catalog
      lookup, Quest purchase launch, purchase update handling, entitlement
      verification, restore, and acknowledgement or consumption.
    </>
  ),
  overview: (
    <>
      This page uses the same walkthrough structure as Fire OS, but the
      recordings are captured from a Quest 3 through Meta Quest Casting so the
      viewer sees the Horizon OS panel running on-device.
    </>
  ),
  proofPoints: [
    {
      area: 'Adapter selection',
      proof: (
        <>
          The Horizon flavor loads the Meta Horizon Billing compatibility module
          instead of Google Play Billing or Amazon Appstore IAP.
        </>
      ),
      where: 'Home badge, build flavor, and Horizon-specific setup.',
    },
    {
      area: 'App identity',
      proof: (
        <>
          <code>initConnection</code> reads the Horizon app ID from the Android
          manifest and prepares the billing client.
        </>
      ),
      where: 'First load of each purchase screen.',
    },
    {
      area: 'Catalog',
      proof: (
        <>
          <code>fetchProducts</code> maps Horizon product details into OpenIAP
          Android product and subscription product types.
        </>
      ),
      where: 'Product and subscription rows.',
    },
    {
      area: 'Purchase token',
      proof: (
        <>
          Horizon purchase tokens and order IDs are carried through{' '}
          <code>PurchaseAndroid</code> for restore, verification, and finish.
        </>
      ),
      where: 'Purchase details and verification payload.',
    },
    {
      area: 'Fulfillment',
      proof: (
        <>
          <code>finishTransaction</code> acknowledges owned items and consumes
          consumables through the Horizon Billing client after validation.
        </>
      ),
      where: 'Purchase flow and unfinished transaction restore flow.',
    },
  ],
  productSkus: [
    'dev.hyo.martie.10bulbs',
    'dev.hyo.martie.30bulbs',
    'dev.hyo.martie.certified',
  ],
  subscriptionSkus: ['dev.hyo.martie.premium', 'dev.hyo.martie.premium_year'],
  purchaseRequestShape: (
    <>
      an Android-compatible request shape, for example{' '}
      <code>google: {'{ skus }'}</code>, with the Horizon flavor selecting the
      Meta billing module underneath
    </>
  ),
  subscriptionRequestShape: (
    <>
      an Android-compatible subscription request with Horizon product IDs and
      term/base-plan metadata
    </>
  ),
  purchaseUpdateText: (
    <>
      The example watches the latest <code>PurchaseAndroid</code> update emitted
      from the Horizon billing listener.
    </>
  ),
  finishText: (
    <>
      Verify entitlement state, call <code>finishTransaction</code>, then
      refresh <code>getAvailablePurchases</code>.
    </>
  ),
  subscriptionManagementText: (
    <>
      The clip should call out Horizon account requirements and the subscription
      product setup used by Quest devices.
    </>
  ),
  availablePurchasesText: (
    <>
      This menu is the Horizon entitlement recovery story. It should show active
      purchases returned from Horizon Billing through{' '}
      <code>getAvailablePurchases</code> and restore actions.
    </>
  ),
  verificationIntro: (
    <>
      This clip shows where the app switches from local Horizon Billing state to
      trusted entitlement validation. Horizon verification requires Meta app
      credentials and should be performed on a backend or managed verification
      service, not by shipping access tokens in the client.
    </>
  ),
  verificationItems: [
    {
      part: 'Meta credentials',
      explanation: (
        <>
          Horizon entitlement verification requires an app access token or user
          access token. Keep that credential on a trusted backend.
        </>
      ),
    },
    {
      part: 'Horizon payload',
      explanation: (
        <>
          Use <code>verifyPurchase</code> with a <code>horizon</code> payload:
          access token, SKU, and user ID.
        </>
      ),
    },
    {
      part: 'Unlock decision',
      explanation: (
        <>
          Grant access only after Meta entitlement verification succeeds for the
          expected SKU and user.
        </>
      ),
    },
    {
      part: 'Finish order',
      explanation: (
        <>
          Acknowledge or consume only after verification and entitlement grant.
        </>
      ),
    },
  ],
  readinessTitle: 'Horizon OS Readiness',
  readinessIntro: (
    <>
      Before publishing the article or sharing the video, verify these items so
      the demo reads as a real Meta Horizon Billing integration.
    </>
  ),
  readinessItems: [
    {
      item: 'Build flavor',
      expected: (
        <>
          Use <code>:Example:assembleHorizonDebug</code> so the app links Meta
          Horizon Billing and loads the Horizon OpenIAP module.
        </>
      ),
    },
    {
      item: 'Horizon app ID',
      expected: (
        <>
          The Android manifest must include the Meta/Horizon app ID required by
          the Horizon Billing SDK.
        </>
      ),
    },
    {
      item: 'Horizon products',
      expected: (
        <>
          Product IDs in Horizon Developer Hub must match the example SKU lists.
        </>
      ),
    },
    {
      item: 'Subscription levels',
      expected: (
        <>
          The example expects the monthly and yearly subscription SKUs to be
          configured at the same Horizon level to avoid unintended automatic
          upgrades.
        </>
      ),
    },
    {
      item: 'Quest tester',
      expected: (
        <>
          Record on a Quest/Horizon OS device signed in with an account that can
          exercise the configured test catalog.
        </>
      ),
    },
    {
      item: 'Verification backend',
      expected: (
        <>
          Prepare a backend or managed service that can hold Meta credentials
          and call entitlement verification safely.
        </>
      ),
    },
  ],
  frameworkIntro: (
    <>
      The Horizon video should prove the Quest billing layer first. App teams
      can then move the same lifecycle into Expo, React Native, Flutter, Kotlin
      Multiplatform, .NET MAUI, and Godot where Horizon support is enabled.
    </>
  ),
  frameworkVerificationApi: {
    label: 'verifyPurchase',
    to: '/docs/features/validation#verify-purchase',
  },
  frameworkNote: (
    <>
      For Horizon, use the Horizon verification payload on a trusted backend.
      Keep Meta access tokens out of client apps.
    </>
  ),
  frameworkSnippet: `import {
  type Purchase,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
} from 'expo-iap';

const products = await fetchProducts({
  skus: ['dev.hyo.martie.10bulbs'],
  type: 'in-app',
});
const [product] = products ?? [];
if (!product) throw new Error('Horizon product not found');

await requestPurchase({
  request: { google: { skus: [product.id] } },
  type: 'in-app',
});

async function onPurchaseUpdated(purchase: Purchase) {
  // Call your backend; do not ship Meta access tokens in the app.
  const verified = await verifyHorizonPurchaseOnBackend({
    sku: purchase.productId,
    purchaseToken: purchase.purchaseToken ?? purchase.id,
  });

  if (verified.success) {
    await finishTransaction({ purchase, isConsumable: true });
    await getAvailablePurchases();
  }
}`,
  buildCommand: `cd packages/google
./gradlew :Example:assembleHorizonDebug
./gradlew :Example:installHorizonDebug

adb shell monkey -p dev.hyo.martie -c android.intent.category.LAUNCHER 1`,
  videos: {
    overview: {
      title: 'Overview',
      description:
        'Quest launch, Horizon Billing context, and feature navigation.',
      src: horizonVideo('horizon-overview.mp4'),
      poster: HORIZON_POSTER,
    },
    purchase: {
      title: 'Purchase Flow',
      description:
        'Product screen, Buy action, Horizon confirmation, and post-purchase transaction state.',
      src: horizonVideo('horizon-inapp.mp4'),
      poster: HORIZON_POSTER,
    },
    subscription: {
      title: 'Subscription Flow',
      description:
        'Subscription screen, upgrade action, Horizon confirmation, and active subscription state.',
      src: horizonVideo('horizon-subscription.mp4'),
      poster: HORIZON_POSTER,
    },
    available: {
      title: 'Available Purchases',
      description:
        'Restore and entitlement recovery surface backed by getAvailablePurchases.',
      src: horizonVideo('horizon-available-purchases.mp4'),
      poster: HORIZON_POSTER,
    },
    verification: {
      title: 'Purchase Verification',
      description:
        'Verification provider selector and the handoff to trusted Meta entitlement verification.',
      src: horizonVideo('horizon-verification.mp4'),
      poster: HORIZON_POSTER,
    },
  },
};

function HorizonExample() {
  return <StoreExampleTemplate config={HORIZON_CONFIG} />;
}

export default HorizonExample;
