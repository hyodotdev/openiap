import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { LIBRARIES } from '../../../lib/images';
import { OPENIAP_VERSIONS } from '../../../lib/versioning';

const nativePackages = [
  {
    name: 'OpenIAP Spec',
    version: OPENIAP_VERSIONS.spec,
    removalVersion: '3.0.0',
  },
  {
    name: 'openiap-apple',
    version: OPENIAP_VERSIONS.apple,
    removalVersion: '3.0.0',
  },
  {
    name: 'openiap-google',
    version: OPENIAP_VERSIONS.google,
    removalVersion: '3.0.0',
  },
] as const;

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
      [
        'useWebhookEvents',
        'connect to the secret Bearer-authenticated project stream from a trusted backend, MCP, or CI process; shipped apps should use lifecycle webhooks and app-open entitlement fetches',
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
      [
        'useWebhookEvents',
        'connect to the secret Bearer-authenticated project stream from a trusted backend, MCP, or CI process; shipped apps should use lifecycle webhooks and app-open entitlement fetches',
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
        'RequestPurchaseOnPromotedProductIOSAsync',
        'PromotedProductIOS, then RequestPurchaseAsync',
      ],
    ],
  },
] as const;

const calloutStyle = {
  padding: '1rem',
  background: 'rgba(220, 104, 67, 0.1)',
  borderLeft: '4px solid var(--accent-color)',
  borderRadius: '0.5rem',
  margin: '1rem 0',
};

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
        Deprecated OpenIAP APIs remain supported throughout each package&apos;s
        current stable major. Migrate now: the native specification and each
        framework library remove their deprecated OpenIAP-owned surfaces when
        that package reaches the major version listed below.
      </p>

      <div style={calloutStyle}>
        <strong>No immediate removal:</strong> deprecation is an advance
        warning, not a patch- or minor-release break. Removal happens only in
        the listed major release. Each package reaches its major independently;
        this table does not imply one lockstep release date.
      </div>

      <section>
        <AnchorLink id="removal-schedule" level="h2">
          Removal schedule
        </AnchorLink>

        <h3>OpenIAP specification and native packages</h3>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Current version</th>
              <th>Deprecated APIs removed in</th>
            </tr>
          </thead>
          <tbody>
            {nativePackages.map((item) => (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td>
                  <code>{item.version}</code>
                </td>
                <td>
                  <code>{item.removalVersion}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Framework libraries</h3>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Library</th>
              <th>Current version</th>
              <th>Deprecated APIs removed in</th>
            </tr>
          </thead>
          <tbody>
            {LIBRARIES.map((library) => (
              <tr key={library.name}>
                <td>
                  <Link to={library.setupPath}>{library.displayName}</Link>
                </td>
                <td>
                  <code>{library.version}</code>
                </td>
                <td>
                  <code>{library.deprecatedApiRemovalVersion}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>
          IAPKit is a hosted service rather than a versioned framework library,
          so this major-version schedule does not apply to its staged data
          migrations.
        </p>
        <p>
          Generated framework declarations repeat the canonical schema phrase{' '}
          <code>Scheduled for removal in OpenIAP 3.0.</code> That phrase names
          the specification and native-package removal train. A generated copy
          shipped by React Native, Expo, Flutter, Godot, KMP, or MAUI remains
          available until that framework reaches its own removal major in the
          table above.
        </p>
        <p>
          Kotlin emits compiler and IDE warnings on supported deprecated types,
          properties, enum values, and functions. Kotlin does not permit{' '}
          <code>@Deprecated</code> on value parameters, and a data-class named
          constructor argument does not trigger its property annotation.
          Deprecated GraphQL resolver arguments and those constructor call sites
          therefore retain KDoc and this migration catalog; reading the
          deprecated property still warns.
        </p>
        <p>
          Raw map/object compatibility inputs—including JavaScript objects,
          plugin configuration, and custom MethodChannel payloads—treat an own
          canonical key, including <code>null</code>, as authoritative.
          Generated Swift and Kotlin request models expose nullable{' '}
          <code>apple</code> / <code>google</code> and <code>ios</code> /{' '}
          <code>android</code> members without a separate “key supplied” bit;
          typed facades therefore prefer a non-null canonical member and
          otherwise retain the legacy optional fallback until the listed major.
          Omit the legacy member instead of relying on canonical{' '}
          <code>null</code> to suppress it.
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
          Flutter 9.x still accepts the following legacy native or custom
          MethodChannel payload shapes. These are input fallbacks, not public
          generated fields, and all are scheduled for removal in{' '}
          <code>flutter_inapp_purchase 10.0.0</code>.
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
          Only using it implicitly in place of <code>transactionId</code> ends
          in Flutter 10.
        </p>
        <h3>Issue #248 and Android raw purchase JSON</h3>
        <ul>
          <li>
            Before the planned Flutter 9.6.1 patch, issue{' '}
            <a
              href="https://github.com/hyodotdev/openiap/issues/248"
              target="_blank"
              rel="noopener noreferrer"
            >
              #248
            </a>{' '}
            causes canonical <code>dataAndroid</code> input to be lost by the
            Dart compatibility converter.
          </li>
          <li>
            The planned patch in{' '}
            <a
              href="https://github.com/hyodotdev/openiap/pull/251"
              target="_blank"
              rel="noopener noreferrer"
            >
              PR #251
            </a>{' '}
            reads <code>dataAndroid</code> first and accepts{' '}
            <code>originalJsonAndroid</code> only as a temporary Flutter 9.x
            input fallback. If both keys exist, <code>dataAndroid</code> wins.
          </li>
          <li>
            The fallback is scheduled for removal in{' '}
            <code>flutter_inapp_purchase 10.0.0</code>. Custom native adapters,
            MethodChannel fixtures, and mocks should emit{' '}
            <code>dataAndroid</code> now.
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
          channel names. Custom integrations that still do so must migrate
          before Flutter 10:
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
          The official Dart API emits the canonical forms below. Flutter 9.x
          continues to normalize these historical custom-channel inputs and
          warns only when a fallback is selected; canonical calls stay silent.
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
          Current migration catalog
        </AnchorLink>
        <p>
          The following OpenIAP-owned deprecated schema surfaces are scheduled
          by the package table above. Generated Swift, Kotlin, TypeScript, Dart,
          GDScript, and C# declarations carry the canonical deprecation guidance
          from the GraphQL schema.
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
          Package-specific compatibility shims
        </AnchorLink>
        <p>
          These public aliases and wrappers are not separate GraphQL schema
          members, so their package source carries the removal warning directly.
          They follow the native or framework major shown in each heading.
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
