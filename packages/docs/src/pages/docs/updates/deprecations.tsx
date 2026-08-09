import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import SEO from '../../../components/SEO';
import { LIBRARIES } from '../../../lib/images';

const nativePackages = [
  {
    name: 'OpenIAP Spec',
    lastCompatibleMajor: '2.x',
    removalVersion: '3.0.0',
  },
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
        "isBillingProgramAvailableAndroid with the 'external-offer' BillingProgramAndroid value",
      ],
      ['showAlternativeBillingDialogAndroid', 'launchExternalLinkAndroid'],
      [
        'createAlternativeBillingTokenAndroid',
        "createBillingProgramReportingDetailsAndroid with the 'external-offer' BillingProgramAndroid value",
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
        'nullable PurchaseIOS result: verified on Apple 27+ with Xcode 27+; null after the system sheet on iOS/Catalyst 15–26, visionOS 1–26, or Apple 27 from an older build',
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
        'OpenIapVersion.specVersion',
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

function Deprecations() {
  return (
    <div className="doc-page">
      <SEO
        title="Deprecations & 3.0 Migration"
        description="OpenIAP deprecated API policy, removal versions, and migration replacements for native and framework packages."
        path="/docs/updates/deprecations"
        keywords="OpenIAP 3.0, deprecated API, migration, breaking changes, legacy compatibility"
      />

      <h1>Deprecations &amp; 3.0 Migration</h1>
      <p className="lead">
        The coordinated major train removes the previously deprecated,
        OpenIAP-owned compatibility surface. Use this catalog to update calls
        before upgrading.
      </p>

      <Callout kind="warning" title="Breaking major release">
        The listed versions do not include compatibility wrappers, deprecated
        schema members, or legacy custom-wire aliases. Upgrade coordinated
        native and framework dependencies together.
      </Callout>

      <section>
        <AnchorLink id="removal-schedule" level="h2">
          Removal boundaries
        </AnchorLink>

        <h3>OpenIAP specification and native packages</h3>
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

        <h3>Framework libraries</h3>
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
      </section>

      <section>
        <AnchorLink id="flutter-original-json-android" level="h2">
          Flutter purchase payload compatibility
        </AnchorLink>
        <p>
          <code>PurchaseAndroid.dataAndroid</code> is the only public,
          schema-defined field for Google Play&apos;s raw signed purchase JSON.
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
        <h3>Issue #248 and Android raw purchase JSON</h3>
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
      </section>

      <section>
        <AnchorLink id="flutter-10-package-migrations" level="h2">
          Flutter 10 package-specific migrations
        </AnchorLink>
        <p>
          In addition to the generated OpenIAP schema surfaces below,
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

        <h3>Custom MethodChannel integrations</h3>
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

        <h3>Custom MethodChannel payloads</h3>
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
      </section>

      <section>
        <AnchorLink id="migration-catalog" level="h2">
          Removed schema migration catalog
        </AnchorLink>
        <p>
          The following OpenIAP-owned schema surfaces were removed by the
          package versions above.
        </p>

        {migrationGroups.map((group) => (
          <div key={group.title}>
            <h3>{group.title}</h3>
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
      </section>

      <section>
        <AnchorLink id="package-compatibility-shims" level="h2">
          Removed package-specific compatibility shims
        </AnchorLink>
        <p>
          These public aliases and wrappers were package-local rather than
          GraphQL schema members. They are absent from the major versions named
          in each heading.
        </p>

        {packageCompatibilityMigrations.map((group) => (
          <div key={group.title}>
            <h3>{group.title}</h3>
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

export default Deprecations;
