import StoreExampleTemplate, {
  type StoreExampleConfig,
} from './StoreExampleTemplate';

const APPLE_ASSET_BASE = '/examples/apple';
const APPLE_VIDEO_BASE = `${APPLE_ASSET_BASE}/videos`;
const APPLE_VIDEO_VERSION = 'v=20260528-storekit-ios-edited';

function appleVideo(fileName: string) {
  return `${APPLE_VIDEO_BASE}/${fileName}?${APPLE_VIDEO_VERSION}`;
}

export const IOS_CONFIG: StoreExampleConfig = {
  title: 'iOS Example',
  seo: {
    title: 'iOS Example',
    description:
      'OpenIAP StoreKit 2 example walkthrough for iOS purchases, subscriptions, restore flows, and IAPKit verification.',
    path: '/docs/example/ios',
    keywords:
      'OpenIAP iOS example, StoreKit 2 example, iOS IAP video, App Store purchase verification',
  },
  storeName: 'App Store / StoreKit 2',
  sourcePath: 'packages/apple/Example/',
  sourceHref:
    'https://github.com/hyodotdev/openiap/tree/main/packages/apple/Example',
  intro: (
    <>
      The iOS example is the SwiftUI app backed by the OpenIAP Apple package. It
      uses StoreKit 2, App Store Connect product IDs, StoreKit transactions, and
      the same OpenIAP lifecycle used by the framework SDKs.
    </>
  ),
  goal: (
    <>
      prove the app is using StoreKit 2 end to end: App Store Connect catalog
      lookup, purchase launch, transaction update handling, signed transaction
      verification, restore, and final transaction finish.
    </>
  ),
  overview: (
    <>
      Each clip is recorded from the native SwiftUI example running through
      iPhone Mirroring. The flow uses the same action-by-action structure as the
      other stores, while the StoreKit 2 sandbox sheet shows the Apple-specific
      confirmation step.
    </>
  ),
  overviewImage: {
    src: `${APPLE_ASSET_BASE}/home.webp`,
    alt: 'OpenIAP iOS example home screen',
  },
  proofPoints: [
    {
      area: 'Adapter selection',
      proof: (
        <>
          The app links the Apple package and calls the StoreKit 2
          implementation instead of an Android billing adapter.
        </>
      ),
      where: 'Home screen and SwiftUI example source.',
    },
    {
      area: 'User context',
      proof: (
        <>
          <code>initConnection</code> prepares StoreKit listeners before product
          and transaction calls run.
        </>
      ),
      where: 'First load of each purchase screen.',
    },
    {
      area: 'Catalog',
      proof: (
        <>
          <code>fetchProducts</code> maps App Store Connect products and
          subscription products into OpenIAP product types.
        </>
      ),
      where: 'Product and subscription rows.',
    },
    {
      area: 'Transaction identity',
      proof: (
        <>
          StoreKit signed transaction data is carried through the OpenIAP
          purchase shape for server or IAPKit verification.
        </>
      ),
      where: 'Purchase details and verification payload.',
    },
    {
      area: 'Finish',
      proof: (
        <>
          <code>finishTransaction</code> completes the StoreKit transaction
          after validation and entitlement grant.
        </>
      ),
      where: 'Purchase flow and restore flow.',
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
      an Apple purchase request, for example <code>apple: {'{ sku }'}</code>
    </>
  ),
  subscriptionRequestShape: (
    <>
      an Apple subscription request, for example <code>apple: {'{ sku }'}</code>
    </>
  ),
  purchaseUpdateText: (
    <>
      The example listens for StoreKit transaction updates and maps them into
      OpenIAP <code>PurchaseIOS</code> values.
    </>
  ),
  finishText: (
    <>
      Verify, grant the entitlement, call <code>finishTransaction</code>, then
      refresh <code>getAvailablePurchases</code>.
    </>
  ),
  subscriptionManagementText: (
    <>
      The clip calls out StoreKit subscription products, sandbox account
      confirmation, and the same purchase update path used by the in-app flow.
    </>
  ),
  availablePurchasesText: (
    <>
      This menu is the iOS entitlement recovery story. It should show
      Transaction.currentEntitlements-backed restore behavior through{' '}
      <code>getAvailablePurchases</code> and <code>restorePurchases</code>.
    </>
  ),
  verificationIntro: (
    <>
      This clip shows where the app switches from local StoreKit state to
      server-side validation. For IAPKit, iOS sends the StoreKit signed
      transaction JWS through the Apple payload.
    </>
  ),
  verificationItems: [
    {
      part: 'IAPKit key',
      explanation: (
        <>
          Configure the project key before recording managed verification. The
          app should not expose long-lived backend credentials.
        </>
      ),
    },
    {
      part: 'Apple payload',
      explanation: (
        <>
          Use <code>verifyPurchaseWithProvider</code> with an{' '}
          <code>iapkit.apple</code> payload containing the StoreKit JWS.
        </>
      ),
    },
    {
      part: 'Unlock decision',
      explanation: (
        <>
          Grant access only after the verified transaction matches the expected
          product and account state.
        </>
      ),
    },
    {
      part: 'Finish order',
      explanation: (
        <>
          Finish the StoreKit transaction after verification and entitlement
          grant, not before.
        </>
      ),
    },
  ],
  readinessTitle: 'iOS Readiness',
  readinessIntro: (
    <>
      Before publishing the article or sharing the video, verify these items so
      the demo reads as a real App Store integration.
    </>
  ),
  readinessItems: [
    {
      item: 'App Store Connect products',
      expected: (
        <>
          The in-app and subscription product IDs must exist and be available
          for the app bundle used by the example.
        </>
      ),
    },
    {
      item: 'Sandbox tester',
      expected: (
        <>
          The device should be signed in with an App Store sandbox tester or a
          StoreKit testing setup appropriate for the recording.
        </>
      ),
    },
    {
      item: 'Bundle ID',
      expected: (
        <>
          The Xcode target bundle identifier must match the App Store Connect
          app that owns the products.
        </>
      ),
    },
    {
      item: 'Verification key',
      expected: (
        <>Configure the IAPKit key before recording the verification clip.</>
      ),
    },
    {
      item: 'Restore state',
      expected: (
        <>
          Prepare at least one owned non-consumable or active subscription so
          the restore clip shows meaningful entitlement recovery.
        </>
      ),
    },
  ],
  frameworkIntro: (
    <>
      The iOS video should prove the StoreKit 2 layer first. App teams can then
      move the same lifecycle into Expo, React Native, Flutter, Kotlin
      Multiplatform, .NET MAUI, and Godot.
    </>
  ),
  frameworkVerificationApi: {
    label: 'verifyPurchaseWithProvider',
    to: '/docs/features/validation#verify-purchase-with-provider',
  },
  frameworkNote: (
    <>
      For iOS, pass the IAPKit Apple payload with the StoreKit signed
      transaction JWS.
    </>
  ),
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
if (!product) throw new Error('App Store product not found');

await requestPurchase({
  request: { apple: { sku: product.id } },
  type: 'in-app',
});

async function onPurchaseUpdated(purchase: Purchase) {
  const jws = purchase.purchaseToken ?? purchase.id;
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: { apple: { jws } },
  });

  if (result.iapkit?.isValid) {
    await finishTransaction({ purchase, isConsumable: true });
    await getAvailablePurchases();
  }
}`,
  buildCommand: `cd packages/apple/Example
open Martie.xcodeproj`,
  videos: {
    overview: {
      title: 'Overview',
      description:
        'SwiftUI example home screen showing the iOS StoreKit 2 target and shared feature menus.',
      poster: `${APPLE_ASSET_BASE}/home.webp`,
    },
    purchase: {
      title: 'Purchase Flow',
      description:
        'Product screen, StoreKit catalog state, and the sandbox purchase sheet for an in-app product.',
      src: appleVideo('apple-inapp.mp4'),
      poster: `${APPLE_ASSET_BASE}/purchase-flow.webp`,
    },
    subscription: {
      title: 'Subscription Flow',
      description:
        'Subscription product screen and StoreKit sandbox confirmation for the monthly premium plan.',
      src: appleVideo('apple-subscription.mp4'),
      poster: `${APPLE_ASSET_BASE}/subscription-flow-upgrade.webp`,
    },
    available: {
      title: 'Available Purchases',
      description:
        'Current entitlement recovery and purchase history backed by StoreKit transaction state.',
      src: appleVideo('apple-available-purchases.mp4'),
      poster: `${APPLE_ASSET_BASE}/available-purchases.webp`,
    },
    verification: {
      title: 'Purchase Verification',
      description:
        'Verification selector and product context before sending the StoreKit JWS to IAPKit.',
      src: appleVideo('apple-verification.mp4'),
      poster: `${APPLE_ASSET_BASE}/purchase-flow.webp`,
    },
  },
};

function IosExample() {
  return <StoreExampleTemplate config={IOS_CONFIG} />;
}

export default IosExample;
