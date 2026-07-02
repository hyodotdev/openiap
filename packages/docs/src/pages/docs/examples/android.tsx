import StoreExampleTemplate, {
  type StoreExampleConfig,
} from './StoreExampleTemplate';

const ANDROID_VIDEO_BASE = '/examples/google/videos';
const ANDROID_POSTER = '/examples/google/home.webp';
const ANDROID_VIDEO_VERSION = 'v=20260527-google-play-english';

function androidVideo(fileName: string) {
  return `${ANDROID_VIDEO_BASE}/${fileName}?${ANDROID_VIDEO_VERSION}`;
}

export const ANDROID_CONFIG: StoreExampleConfig = {
  title: 'Android Example',
  seo: {
    title: 'Android Example',
    description:
      'OpenIAP Google Play Billing example walkthrough for Android purchases, subscriptions, restore flows, and IAPKit verification.',
    path: '/docs/example/android',
    keywords:
      'OpenIAP Android example, Google Play Billing example, Android IAP video, Play purchase verification',
  },
  storeName: 'Google Play Billing',
  sourcePath: 'packages/google/Example/',
  sourceHref:
    'https://github.com/hyodotdev/openiap/tree/main/packages/google/Example',
  intro: (
    <>
      The Android example is the Kotlin/Compose app compiled with the Play
      flavor. It links Google Play Billing, uses Play Console product IDs, maps
      purchase tokens into the OpenIAP purchase model, and verifies purchases
      through IAPKit when managed verification is enabled.
    </>
  ),
  goal: (
    <>
      prove the app is using Google Play Billing end to end: Play Console
      catalog lookup, purchase launch, purchase update handling, purchaseToken
      verification, restore, and acknowledgement or consumption.
    </>
  ),
  overview: (
    <>
      This page uses the same shared walkthrough structure as Fire OS and
      Horizon OS, with clips recorded from the Google Play Billing build so the
      article can compare store behavior without changing the application flow.
    </>
  ),
  proofPoints: [
    {
      area: 'Adapter selection',
      proof: (
        <>
          The Play flavor loads the Google Play Billing module instead of the
          Horizon or Amazon modules.
        </>
      ),
      where: 'Home badge, build flavor, and Play-specific setup.',
    },
    {
      area: 'Billing connection',
      proof: (
        <>
          <code>initConnection</code> connects the Play Billing client before
          products or purchases are queried.
        </>
      ),
      where: 'First load of each purchase screen.',
    },
    {
      area: 'Catalog',
      proof: (
        <>
          <code>fetchProducts</code> maps Play <code>ProductDetails</code> into
          OpenIAP product and subscription product types.
        </>
      ),
      where: 'Product and subscription rows.',
    },
    {
      area: 'Purchase token',
      proof: (
        <>
          Play <code>purchaseToken</code> is carried through{' '}
          <code>PurchaseAndroid</code> for verification and transaction finish.
        </>
      ),
      where: 'Purchase details and verification payload.',
    },
    {
      area: 'Fulfillment',
      proof: (
        <>
          <code>finishTransaction</code> acknowledges owned products and
          consumes consumables after validation.
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
      a Google purchase request, for example <code>google: {'{ skus }'}</code>
    </>
  ),
  subscriptionRequestShape: (
    <>
      a Google subscription request with SKU and offer token data when the
      selected Play offer requires it
    </>
  ),
  purchaseUpdateText: (
    <>
      The example watches the latest <code>PurchaseAndroid</code> update from
      the Play Billing listener.
    </>
  ),
  finishText: (
    <>
      Verify, call <code>finishTransaction</code>, then refresh{' '}
      <code>getAvailablePurchases</code>.
    </>
  ),
  subscriptionManagementText: (
    <>
      The clip should call out Play subscription offers, base plans, replacement
      parameters, and Play subscription management.
    </>
  ),
  availablePurchasesText: (
    <>
      This menu is the Google Play entitlement recovery story. It should show
      active purchases returned from Play Billing through{' '}
      <code>getAvailablePurchases</code> and restore actions.
    </>
  ),
  verificationIntro: (
    <>
      This clip shows where the app switches from local Play Billing state to
      managed validation. For IAPKit, Android sends the Play purchase token
      through the Google payload.
    </>
  ),
  verificationItems: [
    {
      part: 'IAPKit key',
      explanation: (
        <>
          Configure the project key before recording managed verification. The
          client should not be the source of truth for entitlement grants.
        </>
      ),
    },
    {
      part: 'Google payload',
      explanation: (
        <>
          Use <code>verifyPurchaseWithProvider</code> with an{' '}
          <code>iapkit.google</code> payload containing the Play purchase token.
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
        <>
          Acknowledge or consume only after verification and entitlement grant.
        </>
      ),
    },
  ],
  readinessTitle: 'Android Readiness',
  readinessIntro: (
    <>
      Before publishing the article or sharing the video, verify these items so
      the demo reads as a real Google Play Billing integration.
    </>
  ),
  readinessItems: [
    {
      item: 'Build flavor',
      expected: (
        <>
          Use <code>:Example:assemblePlayDebug</code> so the app links Google
          Play Billing and loads the Play OpenIAP module.
        </>
      ),
    },
    {
      item: 'Play Console products',
      expected: (
        <>
          The in-app products and subscriptions must exist in Play Console with
          IDs matching the example SKU lists.
        </>
      ),
    },
    {
      item: 'Tester account',
      expected: (
        <>
          Use a Play license tester or internal testing account that can open
          the purchase sheet for the uploaded package/signature.
        </>
      ),
    },
    {
      item: 'Subscription offers',
      expected: (
        <>
          Base plans and offer tokens should be active so the subscription clip
          can show realistic offer metadata.
        </>
      ),
    },
    {
      item: 'Verification key',
      expected: (
        <>Configure the IAPKit key before recording the verification clip.</>
      ),
    },
  ],
  frameworkIntro: (
    <>
      The Android video should prove the Play Billing layer first. App teams can
      then move the same lifecycle into Expo, React Native, Flutter, Kotlin
      Multiplatform, .NET MAUI, and Godot.
    </>
  ),
  frameworkVerificationApi: {
    label: 'verifyPurchaseWithProvider',
    to: '/docs/features/validation#verify-purchase-with-provider',
  },
  frameworkNote: (
    <>
      For Google Play, pass the IAPKit Google payload with the Play purchase
      token.
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
// React Native uses the same top-level API names from 'react-native-iap'.

const products = await fetchProducts({
  skus: ['dev.hyo.martie.10bulbs'],
  type: 'in-app',
});
const [product] = products ?? [];
if (!product) throw new Error('Play product not found');

await requestPurchase({
  request: { google: { skus: [product.id] } },
  type: 'in-app',
});

async function onPurchaseUpdated(purchase: Purchase) {
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: {
      google: { purchaseToken: purchase.purchaseToken ?? purchase.id },
    },
  });

  if (result.iapkit?.isValid) {
    await finishTransaction({ purchase, isConsumable: true });
    await getAvailablePurchases();
  }
}`,
  buildCommand: `cd packages/google
./gradlew :Example:assemblePlayDebug
./gradlew :Example:installPlayDebug

adb shell monkey -p dev.hyo.martie -c android.intent.category.LAUNCHER 1`,
  videos: {
    overview: {
      title: 'Overview',
      description:
        'Google Play Billing home screen context and feature navigation for the shared walkthrough.',
    },
    purchase: {
      title: 'Purchase Flow',
      description:
        'Product fetch, Play purchase sheet, approved tester purchase, and finish callback.',
      src: androidVideo('google-inapp.mp4'),
      poster: ANDROID_POSTER,
    },
    subscription: {
      title: 'Subscription Flow',
      description:
        'Subscription products, Play subscription sheet, approved tester subscription, and active subscription state.',
      src: androidVideo('google-subscription.mp4'),
      poster: ANDROID_POSTER,
    },
    available: {
      title: 'Available Purchases',
      description:
        'Restored active subscription and owned non-consumable rows returned by getAvailablePurchases.',
      src: androidVideo('google-available-purchases.mp4'),
      poster: ANDROID_POSTER,
    },
    verification: {
      title: 'Purchase Verification',
      description:
        'Verification provider selector and IAPKit key configuration surface for Play purchaseToken validation.',
      src: androidVideo('google-verification.mp4'),
      poster: ANDROID_POSTER,
    },
  },
};

function AndroidExample() {
  return <StoreExampleTemplate config={ANDROID_CONFIG} />;
}

export default AndroidExample;
