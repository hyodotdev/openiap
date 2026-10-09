import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { LIBRARIES } from '../../../lib/images';

// The 2.x/3.x majors below are the retired shared-contract lineage the docs
// once called the "OpenIAP Spec". The Client Protocol is versioned on its own
// from 0.1.0 and its numbers do not continue this train.
const nativePackages = [
  {
    name: 'openiap-apple',
    lastCompatibleMajor: '2.x',
    removalVersion: '3.0.0',
  },
  {
    name: 'openiap-google',
    lastCompatibleMajor: '2.x',
    removalVersion: '3.0.0',
  },
] as const;

const lastCompatibleMajor = (removalVersion: string) =>
  `${Number(removalVersion.split('.')[0]) - 1}.x`;

const migrationGroups = [
  {
    title: 'Validation and storefront APIs',
    rows: [
      ['validateReceipt', 'verifyPurchase'],
      ['validateReceiptIOS', 'verifyPurchase'],
      ['getStorefrontIOS', 'getStorefront'],
      [
        'requestPurchaseOnPromotedProductIOS',
        "the SDK's promoted-product listener or callback, then requestPurchase",
      ],
      [
        'checkAlternativeBillingAvailabilityAndroid',
        'isBillingProgramAvailableAndroid with the BillingProgramAndroid value your app is enrolled in',
      ],
      [
        'showAlternativeBillingDialogAndroid',
        'showBillingProgramInformationDialogAndroid (the in-app Billing Programs dialog); launchExternalLinkAndroid covers the external-link flows (External Offer, External Content Link, Billing Choice external links)',
      ],
      [
        'createAlternativeBillingTokenAndroid',
        'createBillingProgramReportingDetailsAndroid with the BillingProgramAndroid value your app is enrolled in',
      ],
    ],
  },
  {
    title: 'Purchase and connection inputs',
    rows: [
      [
        'RequestPurchasePropsByPlatforms.ios / RequestSubscriptionPropsByPlatforms.ios',
        'apple',
      ],
      [
        'RequestPurchasePropsByPlatforms.android / RequestSubscriptionPropsByPlatforms.android',
        'google',
      ],
      [
        'useAlternativeBilling',
        'enableBillingProgramAndroid in InitConnectionConfig',
      ],
      ['alternativeBillingModeAndroid', 'enableBillingProgramAndroid'],
      [
        'RequestSubscriptionAndroidProps.replacementMode',
        'subscriptionProductReplacementParams for item-level replacement (Play Billing 8.1+)',
      ],
    ],
  },
  {
    title: 'Shared fields and errors',
    rows: [
      [
        'PurchaseCommon.platform / PurchaseInput.platform / PurchaseIOS.platform / PurchaseAndroid.platform',
        'store',
      ],
      ['willExpireSoon', 'daysUntilExpirationIOS'],
      [
        'presentCodeRedemptionSheetIOS Boolean result',
        'nullable PurchaseIOS result: verified on Apple 27+ with Xcode 27+; null after the system sheet on iOS 15–26 and visionOS 1–26; Catalyst 16–26 throws StoreKitError.unknown and Catalyst 15 has no effect',
      ],
      ['receipt-failed', 'purchase-verification-failed'],
      ['receipt-finished', 'purchase-verification-finished'],
      ['receipt-finished-failed', 'purchase-verification-finish-failed'],
    ],
  },
  {
    title: 'Offer and billing-program models',
    rows: [
      ['SubscriptionOfferIOS', 'SubscriptionOffer'],
      ['DiscountIOS / DiscountOfferIOS', 'SubscriptionOffer'],
      ['ProductAndroidOneTimePurchaseOfferDetail', 'DiscountOffer'],
      ['ProductSubscriptionAndroidOfferDetails', 'SubscriptionOffer'],
      [
        'ProductAndroid.oneTimePurchaseOfferDetailsAndroid',
        'ProductAndroid.discountOffers',
      ],
      [
        'ProductSubscriptionAndroid.oneTimePurchaseOfferDetailsAndroid',
        'subscriptionOffers; one-time offer fields do not apply to subscriptions',
      ],
      [
        'ProductSubscriptionAndroid.discountOffers',
        'subscriptionOffers; one-time offer fields do not apply to subscriptions',
      ],
      [
        'ProductAndroid.subscriptionOfferDetailsAndroid / ProductSubscriptionAndroid.subscriptionOfferDetailsAndroid',
        'subscriptionOffers',
      ],
      [
        'ProductIOS.subscriptionInfoIOS / ProductSubscriptionIOS.discountsIOS',
        'subscriptionOffers',
      ],
      [
        'ProductSubscriptionIOS.subscriptionInfoIOS',
        'subscriptionOffers for offers and subscriptionGroupIdIOS for the group identifier',
      ],
      ['AlternativeBillingModeAndroid', 'BillingProgramAndroid'],
      [
        "AlternativeBillingModeAndroid value 'user-choice'",
        "BillingProgramAndroid value 'user-choice-billing'",
      ],
      [
        "AlternativeBillingModeAndroid value 'alternative-only'",
        "BillingProgramAndroid value 'external-offer'",
      ],
      [
        'ExternalOfferAvailabilityResultAndroid',
        'BillingProgramAvailabilityResultAndroid from isBillingProgramAvailableAndroid',
      ],
      [
        'ExternalOfferReportingDetailsAndroid',
        'BillingProgramReportingDetailsAndroid from createBillingProgramReportingDetailsAndroid',
      ],
    ],
  },
] as const;

const flutterPublicMigrations = [
  ['ReplacementMode / ReplaceMode', 'AndroidReplacementMode'],
  ['TypeInApp', 'ProductQueryType'],
  ['builder replacementMode', 'subscriptionProductReplacementParams'],
  [
    'builder useAlternativeBilling',
    'InitConnectionConfig.enableBillingProgramAndroid',
  ],
  ['purchaseUpdated', 'purchaseUpdatedListener'],
  ['PurchaseResult / purchaseError', 'PurchaseError / purchaseErrorListener'],
  ['ConnectionResult / connectionUpdated', 'the initConnection result'],
  [
    'requestPurchaseOnPromotedProductIOS',
    'purchasePromoted, then requestPurchase',
  ],
] as const;

const flutterMethodChannelMigrations = [
  ['getAvailableItemsByType', 'getAvailablePurchases'],
  ['getPurchaseHistoryByType', 'getAvailablePurchases for active purchases'],
  ['buyItemByType', 'requestPurchase'],
  ['acknowledgePurchase', 'finishTransaction or acknowledgePurchaseAndroid'],
  ['consumeProduct / consumePurchase', 'finishTransaction with isConsumable'],
  ['showInAppMessages', 'showInAppMessagesAndroid'],
  ['getAppTransaction', 'getAppTransactionIOS'],
  ['getSubscriptionStatus', 'subscriptionStatusIOS'],
] as const;

const flutterPurchasePayloadMigrations = [
  ['originalJsonAndroid', 'dataAndroid', 'Android'],
  ['purchaseStateAndroid', 'purchaseState', 'Android'],
  ['transactionStateIOS', 'purchaseState', 'iOS'],
  ['transactionReceipt', 'purchaseToken', 'iOS'],
  [
    'id used as a transactionId fallback',
    'an explicit transactionId; keep id as the purchase identity',
    'Android and iOS',
  ],
  [
    'top-level { sku } for verifyPurchase / validateReceiptIOS',
    '{ apple: { sku } }',
    'iOS and macOS',
  ],
] as const;

const flutterCustomWireMigrations = [
  ["product type 'inapp'", "'in-app'"],
  ['requestPurchase.request.ios / requestSubscription.request.ios', 'apple'],
  [
    'requestPurchase.request.android / requestSubscription.request.android',
    'google',
  ],
  ['productId / sku used as a product id', 'id'],
  [
    'discounts / subscription product metadata',
    'discountOffers or subscriptionOffers, plus subscriptionGroupIdIOS when applicable',
  ],
  ['subResponseCode', 'subResponseCodeAndroid'],
  ['fetchProducts skuArr / productIds', 'skus'],
  [
    'offerTokenArr',
    'offerToken for one-time products or subscriptionOffers for subscriptions',
  ],
  [
    'obfuscatedAccountIdAndroid / obfuscatedProfileIdAndroid',
    'obfuscatedAccountId / obfuscatedProfileId',
  ],
  ['purchaseTokenAndroid / token', 'purchaseToken'],
  ['finishTransaction transactionIdentifier', 'transactionId'],
  [
    'replacementModeAndroid / replacementMode',
    'subscriptionProductReplacementParams',
  ],
  ['unsuffixed deep-link sku / packageName', 'skuAndroid / packageNameAndroid'],
  ['numeric-indexed iOS SKU maps', '{ skus: [...] }'],
] as const;

// scripts/scheduled-removals.mjs keeps this list, the deprecation
// notices, and the package majors in step.
const scheduledRemovals = [
  {
    title:
      'Removal in openiap-google 5.0, react-native-iap 18.0, expo-iap 7.0, and flutter_inapp_purchase 12.0',
    rows: [
      [
        'horizonEnabled=true',
        'openiapStore=horizon, or no pin: a debug build follows the connected Quest',
      ],
      ['openiapPlatform=none (flutter_inapp_purchase)', 'openiapStore=none'],
    ],
  },
  {
    title: 'Removal in expo-iap 7.0',
    rows: [
      [
        'modules.horizon / EXPO_IAP_HORIZON=1',
        'ORG_GRADLE_PROJECT_openiapStore=horizon in the EAS profile env; a local debug build follows the connected Quest',
      ],
      [
        'EXPO_IAP_FIREOS=1',
        'modules.amazon.fireOS, which also turns Vega auto-detection off, or ORG_GRADLE_PROJECT_openiapStore=amazon in the EAS profile env',
      ],
      [
        'EXPO_IAP_VEGA=1',
        'modules.amazon.vegaOS, or a root manifest.toml when Fire OS is not declared',
      ],
      ['EXPO_IAP_ONSIDE=1', 'modules.onside'],
    ],
  },
  {
    title: 'Removal in OpenIap.Maui 4.0',
    rows: [['OpenIapAndroidStore', 'OpenIapStore']],
  },
  {
    title: 'Removal in react-native-iap 18.0',
    rows: [
      [
        'NitroProduct.originalPriceAndroid, originalPriceAmountMicrosAndroid, introductoryPriceValueAndroid, introductoryPriceCyclesAndroid, introductoryPricePeriodAndroid, subscriptionPeriodAndroid, freeTrialPeriodAndroid',
        'subscriptionOffers and discountOffers on the product that fetchProducts returns',
      ],
    ],
  },
] as const;

const packageCompatibilityMigrations = [
  {
    title: 'openiap-apple (OpenIAP 3.0)',
    rows: [
      [
        'ReceiptValidationProps / ReceiptValidationResult / ReceiptValidationResultIOS',
        'VerifyPurchaseProps / VerifyPurchaseResult / VerifyPurchaseResultIOS',
      ],
      [
        'OpenIapErrorCode / OpenIapEvent / OpenIapPlatform',
        'ErrorCode / IapEvent / IapPlatform',
      ],
      ['getStorefrontIOSWithCompletion', 'getStorefrontWithCompletion'],
      [
        'requestPurchaseOnPromotedProductIOSWithCompletion',
        'promotedProductListenerIOS followed by requestPurchase',
      ],
      [
        'short requestSubscriptionWithSku(_:offer:completion:) overload',
        'the extended overload with compactJWS, promotionalOfferJWS, winBackOfferId, and billingPlanType',
      ],
      [
        'raw/custom purchase id used as a transactionId fallback',
        'an explicit transactionId; keep id as the canonical purchase identity',
      ],
      ['OpenIapStore.deepLinkToSubscriptionsIOS', 'deepLinkToSubscriptions'],
      [
        'OpenIapVersion.gqlVersion / OpenIapVersionInfo.gqlVersion',
        'OpenIapVersion.clientProtocolVersion',
      ],
    ],
  },
  {
    title: 'openiap-google (OpenIAP 3.0)',
    rows: [
      [
        'ReceiptValidationProps / ReceiptValidationResult / ReceiptValidationResultIOS',
        'VerifyPurchaseProps / VerifyPurchaseResult / VerifyPurchaseResultIOS',
      ],
      [
        'AlternativeBillingMode',
        'BillingProgramAndroid through InitConnectionConfig.enableBillingProgramAndroid',
      ],
      [
        'Play OpenIapModule(context, AlternativeBillingMode, legacy listeners)',
        'OpenIapModule(context), then register listeners and pass InitConnectionConfig.enableBillingProgramAndroid to initConnection',
      ],
      [
        'Play OpenIapModule(context, enableAlternativeBilling) / OpenIapStore(context, enableAlternativeBilling)',
        'construct normally, then pass InitConnectionConfig.enableBillingProgramAndroid to initConnection',
      ],
      [
        'Play OpenIapStore(context, AlternativeBillingMode, userChoiceBillingListener)',
        'OpenIapStore(context), then register listeners and pass InitConnectionConfig.enableBillingProgramAndroid to initConnection',
      ],
      [
        'Amazon OpenIapModule(context, enableAlternativeBilling)',
        'OpenIapModule(context); Amazon ignores the legacy option',
      ],
      [
        'Amazon OpenIapModule(context, AlternativeBillingMode, legacy listeners)',
        'OpenIapModule(context); Amazon ignores the legacy options, then register listeners with add/remove APIs',
      ],
      [
        'Amazon OpenIapStore(context, AlternativeBillingMode, userChoiceBillingListener)',
        'OpenIapStore(context); Amazon ignores the legacy options',
      ],
      [
        'Horizon OpenIapModule / OpenIapStore constructors with AlternativeBillingMode or legacy listeners',
        'OpenIapModule(context) / OpenIapStore(context); Horizon ignores the legacy options',
      ],
      [
        'Horizon manifest keys com.meta.horizon.platform.ovr.OCULUS_APP_ID / com.meta.horizon.platform.ovr.HORIZON_APP_ID / com.oculus.vr.APP_ID',
        'com.meta.horizon.platform.HORIZON_APP_ID',
      ],
      [
        'setUserChoiceBillingListener / setDeveloperProvidedBillingListener',
        'the corresponding add/remove listener APIs',
      ],
      [
        'UserChoiceDetails / UserChoiceBillingListener',
        'UserChoiceBillingDetails / OpenIapUserChoiceBillingListener',
      ],
      [
        'DeveloperProvidedBillingDetails / DeveloperProvidedBillingListener',
        'DeveloperProvidedBillingDetailsAndroid / OpenIapDeveloperProvidedBillingListener',
      ],
      ['OpenIapStore.connectionStatus', 'OpenIapStore.isConnected'],
      [
        'OpenIapError.InvalidReceipt',
        'OpenIapError.InvalidPurchaseVerification',
      ],
      [
        'checkAlternativeBillingAvailability',
        'isBillingProgramAvailable with BillingProgramAndroid.ExternalOffer',
      ],
      ['showAlternativeBillingInformationDialog', 'launchExternalLink'],
      [
        'createAlternativeBillingReportingToken',
        'createBillingProgramReportingDetails with BillingProgramAndroid.ExternalOffer',
      ],
      ['OpenIapLog.d / i / w / e', 'debug / info / warn / error'],
    ],
  },
  {
    title: 'react-native-iap 16.0.0',
    rows: [
      ["ProductTypeInput 'inapp'", "'in-app'"],
      ['request.ios / request.android', 'request.apple / request.google'],
      ['replacementMode', 'subscriptionProductReplacementParams'],
      ['useIAP().alternativeBillingModeAndroid', 'enableBillingProgramAndroid'],
      ['acknowledgePurchase', 'acknowledgePurchaseAndroid'],
      ['consumePurchase', 'consumePurchaseAndroid'],
      ['requestPromotedProductIOS', 'getPromotedProductIOS'],
      ['getReceiptIOS', 'getReceiptDataIOS'],
      [
        'requestPurchaseOnPromotedProductIOS',
        'promotedProductListenerIOS, then requestPurchase',
      ],
      [
        'useIAP().requestPurchaseOnPromotedProductIOS',
        'onPromotedProductIOS, then requestPurchase',
      ],
    ],
  },
  {
    title: 'expo-iap 5.0.0',
    rows: [
      ["ProductTypeInput 'inapp'", "'in-app'"],
      ['request.ios / request.android', 'request.apple / request.google'],
      ['Android custom-channel skuArr', 'skus'],
      [
        'Android custom-channel offerTokenArr',
        'subscriptionOffers for subscriptions',
      ],
      ['replacementMode', 'subscriptionProductReplacementParams'],
      ['useIAP().alternativeBillingModeAndroid', 'enableBillingProgramAndroid'],
      ['acknowledgePurchase', 'acknowledgePurchaseAndroid'],
      ['consumePurchase', 'consumePurchaseAndroid'],
      ['getReceiptIOS', 'getReceiptDataIOS'],
      ['validateReceiptAndroid', 'verifyPurchase'],
      [
        'Android deep-link sku / packageName',
        'skuAndroid / packageNameAndroid',
      ],
      [
        'requestPurchaseOnPromotedProductIOS',
        'promotedProductListenerIOS, then requestPurchase',
      ],
      [
        'useIAP().requestPurchaseOnPromotedProductIOS',
        'onPromotedProductIOS, then requestPurchase',
      ],
      ['config.iosAlternativeBilling', 'config.ios.alternativeBilling'],
      [
        'config.horizonAppId / config.android.horizonAppId',
        'config.android.horizon.appId',
      ],
      [
        'config.android.amazon.fireOS / boolean config.android.amazon.vegaOS',
        'config.modules.amazon.fireOS / config.modules.amazon.vegaOS',
      ],
    ],
  },
  {
    title: 'godot-iap 3.0.0',
    rows: [
      ['godot-iap get_storefront_ios', 'get_storefront'],
      ['godot-iap validate_receipt_ios / validate_receipt', 'verify_purchase'],
      [
        'godot-iap request_purchase_on_promoted_product_ios',
        'promoted_product_ios, then request_purchase',
      ],
      [
        'godot-iap check_alternative_billing_availability_android',
        'is_billing_program_available_android with BillingProgramAndroid.EXTERNAL_OFFER',
      ],
      [
        'godot-iap show_alternative_billing_dialog_android',
        'launch_external_link_android',
      ],
      [
        'godot-iap create_alternative_billing_token_android',
        'create_billing_program_reporting_details_android with BillingProgramAndroid.EXTERNAL_OFFER',
      ],
      [
        'flattened verify_purchase_with_provider IAPKit keys',
        'keep provider at the top level and nest apiKey, baseUrl, includeClientPayload, apple, google, and amazon under iapkit',
      ],
      ["ProductQueryType 'inapp' / 'in_app'", "'in-app'"],
      ["ProductQueryType 'subscription'", "'subs'"],
      [
        'raw request selector and ios / android purchase envelopes',
        'requestPurchase or requestSubscription with apple / google',
      ],
      ['raw offer_token', 'offerToken'],
      [
        'raw obfuscatedAccountIdAndroid / obfuscatedProfileIdAndroid / purchaseTokenAndroid',
        'the corresponding unsuffixed Google request keys',
      ],
      [
        'raw replacementModeAndroid / replacementMode',
        'subscriptionProductReplacementParams',
      ],
      ['raw skuArr / numeric-indexed iOS SKU maps', 'skus'],
      [
        'raw offerTokenArr',
        'offerToken for a one-time product or subscriptionOffers for a subscription',
      ],
      ['Android native requestPurchaseJson', 'requestPurchase'],
      [
        'iOS simple requestPurchase(sku:) / top-level sku request',
        'requestPurchaseWithPayload using an apple request envelope',
      ],
    ],
  },
  {
    title: 'kmp-iap 3.0.0',
    rows: [
      [
        'kmp-iap requestPurchaseOnPromotedProductIOS',
        'promotedProductListener, then requestPurchase',
      ],
      ['kmp-iap getStorefrontIOS', 'getStorefront'],
      ['kmp-iap validateReceiptIOS / validateReceipt', 'verifyPurchase'],
      [
        'PurchaseRequestBuilder.ios / PurchaseRequestBuilder.android',
        'PurchaseRequestBuilder.apple / PurchaseRequestBuilder.google',
      ],
      [
        'AndroidOptionsBuilder.replacementMode',
        'subscriptionProductReplacementParams',
      ],
      [
        'generated RequestPurchasePropsByPlatforms.ios / .android and RequestSubscriptionPropsByPlatforms.ios / .android',
        'apple / google',
      ],
      [
        'generated RequestPurchaseProps.useAlternativeBilling / InitConnectionConfig.alternativeBillingModeAndroid',
        'InitConnectionConfig.enableBillingProgramAndroid',
      ],
      [
        'generated RequestSubscriptionAndroidProps.replacementMode',
        'subscriptionProductReplacementParams',
      ],
    ],
  },
  {
    title: 'OpenIap.Maui 2.0.0',
    rows: [
      ['OpenIap.Maui Iap facade', 'OpenIapClient'],
      [
        'net9.0, net9.0-android, net9.0-ios, and net9.0-maccatalyst targets',
        'the matching net10.0 target frameworks with the .NET 10 MAUI workload',
      ],
      [
        'RequestPurchaseOnPromotedProductIOSAsync',
        'PromotedProductIOS, then RequestPurchaseAsync',
      ],
    ],
  },
] as const;

function Migration() {
  return (
    <div className="doc-page">
      <SEO
        title="Migration"
        description="OpenIAP migration guides per major train: removal versions and canonical replacements for native and framework packages."
        path="/docs/updates/migration"
        keywords="OpenIAP migration, deprecated API, breaking changes, major upgrade, legacy compatibility"
      />

      <h1>Migration</h1>
      <p className="lead">
        One section per coordinated major train. Each train lists the versions
        that drop the previously deprecated, OpenIAP-owned compatibility surface
        and the canonical call to use instead.
      </p>

      <section>
        <AnchorLink id="next-major" level="h2">
          Scheduled removals
        </AnchorLink>
        <p>
          These deprecated keys and fields remain available in the community
          provider release train. Their removal moves to the versions below;
          shared Gradle flags are removed together across the packages that read
          them. Migrate using{' '}
          <Link to="/docs/setup/store#selection">
            How the Store Is Selected
          </Link>
          .
        </p>
        {scheduledRemovals.map((group) => (
          <div key={group.title}>
            <h4>{group.title}</h4>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Deprecated key</th>
                  <th>Migrate to</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map(([deprecated, replacement]) => (
                  <tr key={deprecated}>
                    <td>
                      <code>{deprecated}</code>
                    </td>
                    <td>{replacement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section>
        <AnchorLink id="provider-contract-upgrade" level="h2">
          Community providers and Client Protocol 1.0.0
        </AnchorLink>
        <p>
          The October 2026 train adds community store providers. Each change
          below says who is affected and what to do; upgrade native and
          framework dependencies together (the{' '}
          <Link to="/docs/updates/releases#community-store-providers-2026-10-02">
            release card
          </Link>{' '}
          lists the versions).
        </p>

        <AnchorLink id="client-protocol-1-removals" level="h3">
          Replace the aliases removed in 1.0.0
        </AnchorLink>
        <p>
          Client Protocol 1.0.0 removes the previously deprecated names below.
          Update imports, hook calls, mocks, and native bindings when upgrading
          to this release train.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Removed</th>
              <th>Use instead</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>openRedeemOfferCodeAndroid</code> /{' '}
                <code>presentCodeRedemptionSheetIOS</code>
              </td>
              <td>
                <code>openRedeemOfferCode()</code>, which returns a purchase or
                null
              </td>
            </tr>
            <tr>
              <td>
                Godot <code>open_redeem_offer_code_android</code> /{' '}
                <code>present_code_redemption_sheet_ios</code>
              </td>
              <td>
                <code>await open_redeem_offer_code()</code>
              </td>
            </tr>
            <tr>
              <td>
                Apple <code>presentCodeRedemptionSheetResultIOS</code>
              </td>
              <td>
                <code>openRedeemOfferCode()</code>
              </td>
            </tr>
            <tr>
              <td>
                ObjC <code>presentCodeRedemptionSheetIOSWithCompletion:</code>
              </td>
              <td>
                <code>openRedeemOfferCodeWithCompletion:</code>
              </td>
            </tr>
            <tr>
              <td>
                Horizon verification <code>success</code>
              </td>
              <td>
                <code>isValid</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>OpenIapVersion.specVersion</code>
              </td>
              <td>
                <code>OpenIapVersion.clientProtocolVersion</code>
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          A null redemption result can mean the store opened its UI without
          reporting a purchase immediately, or has no redemption flow. Observe
          purchase updates and refresh available purchases when the app resumes.
          React Native, Expo, Flutter, and MAUI now reject with a typed error
          when the Play redeem page cannot open; earlier versions resolved null.
          Catch that error. Godot emits <code>purchase_error</code> on Android
          and iOS failures while returning null.
        </p>

        <AnchorLink id="provider-contract-store-id" level="h3">
          Purchases and verification results require storeId
        </AnchorLink>
        <p>
          <strong>What changed:</strong> <code>storeId</code> is required at
          construction on <code>Purchase</code>, <code>PurchaseInput</code>, and{' '}
          <code>RequestVerifyPurchaseWithIapkitResult</code> in TypeScript,
          Dart, Kotlin purchases, and the new Swift public initializers; C# and
          the Kotlin IAPKit result infer official ids instead. A community
          purchase uses store <code>unknown</code> with its own provider id; see{' '}
          <Link to="/docs/guides/store-providers#identity">
            Preserve store identity
          </Link>{' '}
          for the full rule. The unknown store spells{' '}
          <code>IapStore.Unknown</code> in Dart, Kotlin, and C#,{' '}
          <code>IapStore.unknown</code> in Swift, <code>IapStore.UNKNOWN</code>{' '}
          in GDScript, and <code>&apos;unknown&apos;</code> in TypeScript.
        </p>
        <p>
          <strong>Who is affected:</strong> apps that hand-build purchase,{' '}
          <code>PurchaseInput</code>, or verification values (fixtures, mocks,
          custom adapters, server-driven finish flows), and custom types that
          implement <code>PurchaseCommon</code>, which must add{' '}
          <code>storeId</code>. Passing SDK-returned purchases through needs no
          change. Swift apps are affected only through decoding and custom{' '}
          <code>PurchaseCommon</code> conformers: base had no public purchase
          initializer.
        </p>
        <p>
          <strong>What to do:</strong> add <code>storeId</code> when
          constructing the value:
        </p>
        <ul>
          <li>
            Saved official JSON without it still decodes to the canonical id,
            but a community value needs an explicit valid id.
          </li>
          <li>
            A mismatched or invalid id fails to decode: TypeScript, Dart,
            Kotlin, and Swift decoders throw, GDScript <code>from_dict</code>{' '}
            returns null (null-check decoded values), and C# deserialization
            throws <code>JsonException</code>. A hand-built C# record with a
            missing community id or a mismatched id throws whenever{' '}
            <code>StoreId</code> is read, including <code>Equals</code>,{' '}
            <code>GetHashCode</code>, and serialization.
          </li>
          <li>
            <code>store_id</code> defaults to <code>&quot;&quot;</code> in
            GDScript. <code>from_dict</code> rejects a blank id for every store,
            so a hand-built object round-tripped outside{' '}
            <code>finish_transaction</code> decodes to null. The Godot finish
            helpers stamp the connected provider&apos;s id onto blank finish
            inputs (a blank id for an official store is stripped instead), and
            GDScript <code>PurchaseInput</code> has no <code>store_id</code>.
          </li>
        </ul>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import type { PurchaseAndroid } from 'react-native-iap';

const purchase: PurchaseAndroid = {
  ...savedPurchase, // your stored purchase
  store: 'google',
  storeId: 'play',
};`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final purchase = PurchaseAndroid(
  // ...existing fields,
  store: IapStore.Google,
  storeId: 'play',
);`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val purchase = PurchaseAndroid(
    // ...existing fields,
    store = IapStore.Google,
    storeId = "play",
)`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`var purchase = new PurchaseAndroid
{
    // ...existing fields,
    Store = IapStore.Google,
    StoreId = "play",
};`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`const Types = preload("res://addons/godot-iap/types.gd")

var purchase = Types.PurchaseAndroid.new()
purchase.store = Types.IapStore.GOOGLE
purchase.store_id = "play"`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          An iOS purchase uses <code>store</code> <code>apple</code> with{' '}
          <code>storeId</code> <code>apple</code>.
        </p>

        <AnchorLink id="provider-contract-kmp-store" level="h3">
          KMP Store gains UNKNOWN
        </AnchorLink>
        <p>
          <strong>What changed:</strong> the public <code>Store</code> enum has
          a new <code>UNKNOWN</code> case, returned for community-provider
          builds (the Android <code>provider</code> build and any non-Apple iOS
          provider) and on iOS when the Apple provider selection fails.
        </p>
        <p>
          <strong>Who is affected:</strong> exhaustive{' '}
          <code>when (getStore())</code> expressions without an{' '}
          <code>else</code> branch, which no longer compile.
        </p>
        <p>
          <strong>What to do:</strong> add the <code>UNKNOWN</code> branch.
        </p>
        <CodeBlock language="kotlin">{`// kmpIAP is your KmpInAppPurchase instance.
when (kmpIAP.getStore()) {
    Store.PLAY_STORE -> TODO("Play")
    Store.AMAZON -> TODO("Amazon")
    Store.APP_STORE -> TODO("App Store")
    Store.HORIZON -> TODO("Horizon")
    Store.UNKNOWN -> TODO("community provider")
    // NONE is never returned; it only completes the exhaustive when.
    Store.NONE -> TODO("no store")
}`}</CodeBlock>

        <AnchorLink id="provider-contract-kotlin-result" level="h3">
          Kotlin IAPKit result is no longer a data class
        </AnchorLink>
        <p>
          <strong>What changed:</strong>{' '}
          <code>RequestVerifyPurchaseWithIapkitResult</code> is now a plain
          class with a private primary constructor. The old 3-, 5-, and
          6-argument constructors keep their signatures, but <code>copy</code>{' '}
          lost binary compatibility; <code>component1-3</code> still exist, and{' '}
          <code>equals</code>/<code>hashCode</code> now compare all seven fields
          instead of three. <code>PurchaseAndroid</code> gains a required{' '}
          <code>storeId</code> parameter after <code>store</code> (after{' '}
          <code>storefrontCountryCodeIOS</code> on <code>PurchaseIOS</code>), so
          their constructor and <code>copy</code> signatures change and later{' '}
          <code>componentN</code> indexes shift.
        </p>
        <p>
          <strong>Who is affected:</strong> Kotlin callers on OpenIAP Google
          4.0.0 and KMP 4.0.0 that construct or copy purchases or results, or
          decode saved JSON.
        </p>
        <p>
          <strong>What to do:</strong> recompile against 4.0.0 and pass{' '}
          <code>storeId</code> to purchase constructors. The result&apos;s{' '}
          <code>copy</code> keeps <code>storeId</code> while <code>store</code>{' '}
          is unchanged (a new store resets it to the official id, or throws for{' '}
          <code>Unknown</code> without <code>storeId</code>) and now preserves{' '}
          <code>clientPayload</code>, <code>productId</code>, and{' '}
          <code>environment</code>. A result built with{' '}
          <code>IapStore.Unknown</code> and no <code>storeId</code> still
          compiles but throws <code>IllegalArgumentException</code>. A
          purchase&apos;s <code>copy</code> keeps its <code>storeId</code>, so
          pass a matching <code>storeId</code> when you change{' '}
          <code>store</code>. JSON with a missing or unrecognized{' '}
          <code>store</code> value used to decode as Unknown and now throws
          unless it carries a valid community <code>storeId</code>.
        </p>

        <AnchorLink id="provider-contract-openiap-core" level="h3">
          Shared classes move to openiap-core
        </AnchorLink>
        <p>
          <strong>What changed:</strong> the shared <code>dev.hyo.openiap</code>{' '}
          classes moved into the new <code>openiap-core</code> artifact, which
          the store artifacts depend on.
        </p>
        <p>
          <strong>Who is affected:</strong> apps that link the{' '}
          <code>openiap-google</code> AAR by file.
        </p>
        <p>
          <strong>What to do:</strong> add <code>openiap-core</code> next to it;
          Maven consumers get it transitively.
        </p>

        <AnchorLink id="provider-contract-tvos" level="h3">
          Apple requires tvOS 16
        </AnchorLink>
        <p>
          <strong>What changed:</strong> the SwiftPM floor moves from tvOS 15 to
          tvOS 16. The CocoaPods deployment target already required 16.0.
        </p>
        <p>
          <strong>Who is affected:</strong> tvOS apps on OpenIAP Apple 4.0.0
          that build through SwiftPM with a 15.x deployment target.
        </p>
        <p>
          <strong>What to do:</strong> raise the tvOS deployment target to 16.0.
        </p>

        <AnchorLink id="provider-contract-cancellation" level="h3">
          Cancelled Apple operations throw CancellationError
        </AnchorLink>
        <p>
          <strong>What changed:</strong> cancelling the calling task of{' '}
          <code>requestPurchase</code> or another StoreKit operation now throws{' '}
          <code>CancellationError</code> with no purchase-error event.
          Previously <code>requestPurchase</code>, <code>fetchProducts</code>,{' '}
          <code>getPromotedProductIOS</code>, and{' '}
          <code>subscriptionStatusIOS</code> wrapped the cancellation into an
          emitted <code>PurchaseError</code>, and <code>syncIOS</code>,{' '}
          <code>restorePurchases</code>, and <code>openRedeemOfferCode</code>{' '}
          threw it as a <code>PurchaseError</code> without an event.{' '}
          <code>initConnection</code> still returns false when{' '}
          <code>endConnection</code> interrupts its init task. The SwiftUI
          store&apos;s <code>getAvailablePurchases</code> and{' '}
          <code>getActiveSubscriptions</code> also throw{' '}
          <code>CancellationError</code>, without updating state, when the task
          is cancelled or <code>endConnection</code> completes while they wait;
          its <code>initConnection</code> throws it when its task is cancelled,
          even after connecting.
        </p>
        <p>
          <strong>Who is affected:</strong> Swift apps that call OpenIAP from a
          task that can be cancelled, such as a SwiftUI <code>.task</code>.
        </p>
        <p>
          <strong>What to do:</strong> catch <code>CancellationError</code> at
          the call site alongside the existing <code>PurchaseError</code> path;
          keep using the listener for real purchase failures. A user dismissing
          the purchase sheet still reports <code>user-cancelled</code> through
          the listener.
        </p>

        <AnchorLink id="provider-contract-flutter-init" level="h3">
          Flutter initConnection returns the native result on Apple
        </AnchorLink>
        <p>
          <strong>What changed:</strong> on iOS and macOS{' '}
          <code>initConnection()</code> now returns the native Boolean, false
          when StoreKit cannot make payments; the plugins returned nil (read as
          true) before.
        </p>
        <p>
          <strong>Who is affected:</strong> Flutter apps that treat the Apple
          init result as always true.
        </p>
        <p>
          <strong>What to do:</strong> branch on the result and show the store
          as unavailable when it is false.
        </p>

        <AnchorLink id="provider-contract-error-codes" level="h3">
          Android errors carry the provider&apos;s code
        </AnchorLink>
        <p>
          <strong>What changed:</strong> the wrappers forward the
          provider&apos;s Android error code where they returned fixed codes:
        </p>
        <ul>
          <li>
            React Native: calls before init already reported{' '}
            <code>not-prepared</code>; thrown init errors,{' '}
            <code>verifyPurchase</code>, and{' '}
            <code>verifyPurchaseWithProvider</code> now forward the
            provider&apos;s code, and deep-link and <code>endConnection</code>{' '}
            errors arrive as OpenIAP errors.
          </li>
          <li>
            Expo: Android calls that rejected every failure with{' '}
            <code>service-error</code> now forward the provider&apos;s code (
            <code>not-prepared</code> before init on Play and Horizon; Amazon
            queries work before init); thrown init errors and verification
            forward it too.
          </li>
          <li>
            Flutter: calls that answered native failures with{' '}
            <code>service-error</code> now forward the provider&apos;s code
            (Dart-guarded calls still throw <code>not-prepared</code> before
            init), and thrown init errors forward it instead of{' '}
            <code>init-connection</code>.
          </li>
          <li>
            Godot: failure results now carry a <code>code</code> field (the
            provider&apos;s code, else <code>service-error</code>, or{' '}
            <code>purchase-verification-failed</code> for verification);{' '}
            <code>verify_purchase_with_provider</code> before init now reports{' '}
            <code>not-prepared</code>, as <code>restore_purchases</code> and the
            entitlement reads already did; <code>init_connection</code> still
            returns only a Boolean.
          </li>
        </ul>
        <p>
          On Amazon, <code>getStorefront</code> and IAPKit verification without
          a userId now throw <code>StoreConnectionFailure</code> instead of{' '}
          <code>InitConnection</code> when the user-data request cannot start
          (code still <code>init-connection</code>; <code>initConnection</code>{' '}
          still returns false), so Kotlin callers matching by type must handle
          the new class.
        </p>
        <p>
          <strong>Who is affected:</strong> apps that match literal Android
          error codes or messages.
        </p>
        <p>
          <strong>What to do:</strong> handle specific codes such as{' '}
          <code>not-prepared</code>.
        </p>
        <CodeBlock language="typescript">{`import {
  ErrorCode,
  getAvailablePurchases,
  initConnection,
} from 'expo-iap';
import type { PurchaseError } from 'expo-iap';

async function loadPurchases() {
  try {
    return await getAvailablePurchases();
  } catch (error) {
    // Before: expo-iap rejected this Android call with service-error.
    if ((error as PurchaseError).code !== ErrorCode.NotPrepared) throw error;
    const connected = await initConnection();
    if (!connected) throw error;
    return getAvailablePurchases();
  }
}`}</CodeBlock>

        <AnchorLink id="provider-contract-verify-codes" level="h3">
          Failed verification reports the native code
        </AnchorLink>
        <p>
          <strong>What changed:</strong> Flutter reports the native error code
          from <code>verifyPurchase</code> and{' '}
          <code>verifyPurchaseWithProvider</code> on every platform instead of
          always <code>purchase-verification-failed</code>; KMP does the same
          for verify-with-provider on iOS, and Godot on iOS and Android. Generic
          Android failures in Flutter now report{' '}
          <code>transaction-validation-failed</code>.
        </p>
        <p>
          <strong>Who is affected:</strong> apps that match{' '}
          <code>purchase-verification-failed</code> from these calls.
        </p>
        <p>
          <strong>What to do:</strong> match the specific codes.
        </p>

        <AnchorLink id="provider-contract-restore" level="h3">
          Android restore runs the provider first
        </AnchorLink>
        <p>
          <strong>What changed:</strong> React Native, Expo, and Flutter run the
          provider&apos;s Android restore before querying ownership. On Horizon
          each owned purchase then reaches the purchase listeners; Play and
          Amazon restores deliver nothing by themselves. Godot runs the same
          restore but emits no <code>purchase_updated</code> signal on Horizon,
          and a failed restore still emits <code>purchase_error</code>: read
          owned purchases with <code>get_available_purchases_result</code>.
          Flutter restore failures on iOS and macOS now read{' '}
          <code>Failed to restore purchases [code]: ...</code> instead of{' '}
          <code>Failed to sync iOS purchases [code]: ...</code> (the code still
          forwards the native code).
        </p>
        <p>
          <strong>Who is affected:</strong> Horizon apps with purchase
          listeners, and Flutter apps that match the Apple restore failure
          message.
        </p>
        <p>
          <strong>What to do:</strong> make the purchase handler idempotent so a
          repeated delivery grants once, and keep reading owned purchases after
          the restore resolves.
        </p>
        <CodeBlock language="typescript">{`import { purchaseUpdatedListener } from 'react-native-iap';

// Horizon redelivers every owned purchase on restore; grantOnce is your code
// and must grant at most once per token against your stored entitlements.
purchaseUpdatedListener((purchase) => {
  if (purchase.purchaseState !== 'purchased') return;
  void grantOnce(purchase.purchaseToken ?? purchase.id, purchase.productId);
});`}</CodeBlock>

        <AnchorLink id="provider-contract-godot-events" level="h3">
          Godot purchase_error events change
        </AnchorLink>
        <p>
          <strong>What changed:</strong> a failed Apple restore now emits one{' '}
          <code>purchase_error</code> carrying OpenIAP&apos;s code instead of
          two (<code>sync-error</code> then <code>service-error</code>);{' '}
          <code>verify_purchase</code> now emits <code>purchase_error</code> on
          failure instead of returning null silently (on Apple every failure, on
          Android when the native result carries a code). On Apple,{' '}
          <code>get_storefront</code> failures, the{' '}
          <code>products_fetched</code> failure payloads for{' '}
          <code>fetch_products</code>, and the failure results of the iOS-only
          methods now carry OpenIAP&apos;s code instead of{' '}
          <code>service-error</code> or no code.
        </p>
        <p>
          <strong>Who is affected:</strong> Godot apps that count restore
          errors, call <code>verify_purchase</code> or{' '}
          <code>get_storefront</code>, or read failure codes from{' '}
          <code>products_fetched</code>.
        </p>
        <p>
          <strong>What to do:</strong> handle one restore event, null-check the
          verify result alongside the signal, and match specific codes.
        </p>

        <AnchorLink id="provider-contract-godot-export" level="h3">
          Godot export rejects an unknown Android store
        </AnchorLink>
        <p>
          <strong>What changed:</strong> an unrecognized{' '}
          <code>openiap/android_store</code> value now fails the export instead
          of falling back to Play.
        </p>
        <p>
          <strong>Who is affected:</strong> Godot Android builds with a
          misspelled store value.
        </p>
        <p>
          <strong>What to do:</strong> fix the store value.
        </p>

        <AnchorLink id="provider-contract-subscription-flag" level="h3">
          iOS subscription checks use the active flag
        </AnchorLink>
        <p>
          <strong>What changed:</strong> <code>hasActiveSubscriptions</code> on
          iOS now answers from OpenIAP&apos;s active flag (expiration in the
          future): React Native and Flutter on every call (Flutter on iOS and
          macOS), KMP and MAUI on id-filtered calls (MAUI also on Mac Catalyst),
          as Expo, Godot, and native already did. A subscriber in billing grace
          reads inactive. Flutter <code>hasActiveSubscriptions</code> no longer
          checks init in Dart: before <code>initConnection</code>, iOS and macOS
          connect and answer instead of throwing <code>not-prepared</code>, Play
          and Horizon report the provider&apos;s <code>not-prepared</code>, and
          failures read{' '}
          <code>Failed to check active subscriptions [code]: ...</code> instead
          of <code>Failed to get active subscriptions [code]: ...</code>; match
          codes, not messages.
        </p>
        <p>
          <strong>Who is affected:</strong> apps that grant access during
          billing grace, and Flutter apps that match the failure message or call
          it before <code>initConnection</code>.
        </p>
        <p>
          <strong>What to do:</strong> to keep grace access, read the renewal
          info from <code>getActiveSubscriptions</code> instead of the boolean.
        </p>
        <CodeBlock language="typescript">{`import { getActiveSubscriptions } from 'react-native-iap';

// hasActiveSubscriptions() is false in billing grace; use renewal info
// when grace keeps access.
const subs = await getActiveSubscriptions();
const inGrace = subs.some(
  (sub) => (sub.renewalInfoIOS?.gracePeriodExpirationDate ?? 0) > Date.now(),
);`}</CodeBlock>
      </section>

      {/* ---------------------------------------------------------------
          Migration train: 2.x -> 3.0
          Add the next train as a sibling <section> ABOVE this one (newest
          first), with its own AnchorLink id (for example "v3-to-v4") and its
          own removal table. Keep the heading ids inside a train unique across
          the page - other docs deep-link to them. The train-independent
          policy section stays last.
          --------------------------------------------------------------- */}
      <section>
        <AnchorLink id="v2-to-v3" level="h2">
          2.x &rarr; 3.0
        </AnchorLink>
        <p>
          The coordinated major train removes the previously deprecated,
          OpenIAP-owned compatibility surface. Use this catalog to update calls
          before upgrading.
        </p>

        <Callout kind="warning" title="Breaking major release">
          The listed versions do not include compatibility wrappers, deprecated
          schema members, or legacy custom-wire aliases. Upgrade coordinated
          native and framework dependencies together.
        </Callout>

        <AnchorLink id="removal-schedule" level="h3">
          Removal boundaries
        </AnchorLink>

        <h4>Native packages</h4>
        <table className="doc-table deprecation-schedule-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Last compatible major</th>
              <th>Removed in</th>
            </tr>
          </thead>
          <tbody>
            {nativePackages.map((item) => (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td>
                  <code>{item.lastCompatibleMajor}</code>
                </td>
                <td>
                  <code>{item.removalVersion}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Framework libraries</h4>
        <table className="doc-table deprecation-schedule-table">
          <thead>
            <tr>
              <th>Library</th>
              <th>Last compatible major</th>
              <th>Removed in</th>
            </tr>
          </thead>
          <tbody>
            {LIBRARIES.map((library) => (
              <tr key={library.name}>
                <td>
                  <Link to={library.setupPath}>{library.displayName}</Link>
                </td>
                <td>
                  <code>
                    {lastCompatibleMajor(library.deprecatedApiRemovalVersion)}
                  </code>
                </td>
                <td>
                  <code>{library.deprecatedApiRemovalVersion}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>
          IAPKit is a hosted service rather than a versioned framework library.
          Its scoped keys, client payloads, verification, and staged data
          migrations are unchanged by this SDK-only major train.
        </p>
        <p>
          Generated Swift, Kotlin, TypeScript, Dart, GDScript, and C# contracts
          now expose only the canonical schema. The former declarations remain
          listed below solely as migration reference.
        </p>
        <p>
          Raw JavaScript objects, plugin configuration, custom MethodChannel
          payloads, and direct Godot dictionaries must also use canonical keys.
          Removed aliases are rejected or ignored; they never override missing
          canonical input.
        </p>
        <AnchorLink id="flutter-original-json-android" level="h3">
          Flutter purchase payload compatibility
        </AnchorLink>
        <p>
          <code>PurchaseAndroid.dataAndroid</code> is the only public,
          schema-defined field for Google Play&apos;s raw signed purchase JSON.{' '}
          <code>originalJsonAndroid</code> is not a public Purchase field and is
          never the preferred output key.
        </p>
        <p>
          Flutter 9.x accepted the following legacy native or custom
          MethodChannel payload shapes. Flutter 10 accepts only the canonical
          forms in the middle column.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Legacy Flutter 9.x input</th>
              <th>Emit instead</th>
              <th>Platform</th>
            </tr>
          </thead>
          <tbody>
            {flutterPurchasePayloadMigrations.map(
              ([deprecated, replacement, platform]) => (
                <tr key={deprecated}>
                  <td>
                    <code>{deprecated}</code>
                  </td>
                  <td>
                    <code>{replacement}</code>
                  </td>
                  <td>{platform}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
        <p>
          The canonical <code>id</code> purchase identity is not deprecated.
          Flutter 10 requires an explicit <code>transactionId</code>.
        </p>
        <h4>Issue #248 and Android raw purchase JSON</h4>
        <ul>
          <li>
            Before Flutter 9.6.1, issue{' '}
            <a
              href="https://github.com/hyodotdev/openiap/issues/248"
              target="_blank"
              rel="noopener noreferrer"
            >
              #248
            </a>{' '}
            caused canonical <code>dataAndroid</code> input to be lost by the
            Dart compatibility converter.
          </li>
          <li>
            The patch in{' '}
            <a
              href="https://github.com/hyodotdev/openiap/pull/251"
              target="_blank"
              rel="noopener noreferrer"
            >
              PR #251
            </a>{' '}
            read <code>dataAndroid</code> first and accepted{' '}
            <code>originalJsonAndroid</code> only as a temporary Flutter 9.x
            input fallback. If both keys exist, <code>dataAndroid</code> wins.
          </li>
          <li>
            Flutter 10 removes that fallback. Custom native adapters,
            MethodChannel fixtures, and mocks must emit <code>dataAndroid</code>
            .
          </li>
        </ul>
        <p>
          See the canonical field reference in{' '}
          <Link to="/docs/types/purchase#purchase-android">
            PurchaseAndroid
          </Link>
          .
        </p>
        <AnchorLink id="flutter-10-package-migrations" level="h3">
          Flutter 10 package-specific migrations
        </AnchorLink>
        <p>
          In addition to the generated OpenIAP schema surfaces below,{' '}
          <code>flutter_inapp_purchase 10.0.0</code> removes these Flutter-only
          compatibility APIs:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Deprecated Flutter surface</th>
              <th>Migrate to</th>
            </tr>
          </thead>
          <tbody>
            {flutterPublicMigrations.map(([deprecated, replacement]) => (
              <tr key={deprecated}>
                <td>
                  <code>{deprecated}</code>
                </td>
                <td>
                  <code>{replacement}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Custom MethodChannel integrations</h4>
        <p>
          Applications normally use the Dart API and never call these internal
          channel names. Flutter 10 custom integrations must use the
          replacements:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Legacy channel method</th>
              <th>Migrate to</th>
            </tr>
          </thead>
          <tbody>
            {flutterMethodChannelMigrations.map(([deprecated, replacement]) => (
              <tr key={deprecated}>
                <td>
                  <code>{deprecated}</code>
                </td>
                <td>
                  <code>{replacement}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Custom MethodChannel payloads</h4>
        <p>
          The official Dart API emits the canonical forms below. Flutter 10 no
          longer normalizes the historical custom-channel inputs.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Legacy payload shape</th>
              <th>Emit instead</th>
            </tr>
          </thead>
          <tbody>
            {flutterCustomWireMigrations.map(([deprecated, replacement]) => (
              <tr key={deprecated}>
                <td>
                  <code>{deprecated}</code>
                </td>
                <td>
                  <code>{replacement}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AnchorLink id="migration-catalog" level="h3">
          Removed schema migration catalog
        </AnchorLink>
        <p>
          The following OpenIAP-owned schema surfaces were removed by the
          package versions above.
        </p>

        {migrationGroups.map((group) => (
          <div key={group.title}>
            <h4>{group.title}</h4>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Deprecated surface</th>
                  <th>Migrate to</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map(([deprecated, replacement]) => (
                  <tr key={deprecated}>
                    <td>
                      <code>{deprecated}</code>
                    </td>
                    <td>
                      <code>{replacement}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <AnchorLink id="package-compatibility-shims" level="h3">
          Removed package-specific compatibility shims
        </AnchorLink>
        <p>
          These public aliases and wrappers were package-local rather than
          GraphQL schema members. They are absent from the major versions named
          in each heading.
        </p>

        {packageCompatibilityMigrations.map((group) => (
          <div key={group.title}>
            <h4>{group.title}</h4>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Deprecated package surface</th>
                  <th>Migrate to</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map(([deprecated, replacement]) => (
                  <tr key={deprecated}>
                    <td>
                      <code>{deprecated}</code>
                    </td>
                    <td>
                      <code>{replacement}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section>
        <AnchorLink id="scope" level="h2">
          What this schedule does not remove
        </AnchorLink>
        <p>
          The schedule applies to OpenIAP-owned deprecated schema members and
          explicit compatibility shims. It does not automatically remove:
        </p>
        <ul>
          <li>
            redirects kept so existing documentation links continue to work;
          </li>
          <li>
            documentation that describes an upstream StoreKit or Play Billing
            legacy technology still supported by the stores; or
          </li>
          <li>
            StoreKit, Play Billing, Amazon, or Horizon response-shape
            normalization, including upstream names such as{' '}
            <code>productIdentifier</code>, <code>localizedPrice</code>, and
            historical receipt payload labels;
          </li>
          <li>
            internal React Native, Expo, KMP, or Godot recovery of native
            response fields that applications do not author;
          </li>
          <li>
            input normalization that accepts historical error-code spellings;
          </li>
          <li>
            safe fallbacks used when an operating-system version does not
            support a newer store API; or
          </li>
          <li>
            staged IAPKit storage migrations with their own retention and
            rollback requirements.
          </li>
        </ul>
        <p>
          Check the <Link to="/docs/updates/releases">release notes</Link>{' '}
          before every major upgrade for the final removal list and
          package-specific migration steps.
        </p>
      </section>
    </div>
  );
}

export default Migration;
