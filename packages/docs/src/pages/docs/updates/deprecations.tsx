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
    ],
  },
  {
    title: 'react-native-iap 16.0.0',
    rows: [
      ["ProductTypeInput 'inapp'", "'in-app'"],
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
      ['acknowledgePurchase', 'acknowledgePurchaseAndroid'],
      ['consumePurchase', 'consumePurchaseAndroid'],
      ['getReceiptIOS', 'getReceiptDataIOS'],
      ['validateReceiptAndroid', 'verifyPurchase'],
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
      </section>

      <section>
        <AnchorLink id="flutter-original-json-android" level="h2">
          Flutter Android purchase JSON
        </AnchorLink>
        <p>
          <code>PurchaseAndroid.dataAndroid</code> is the only public,
          schema-defined field for Google Play&apos;s raw signed purchase JSON.
          <code>originalJsonAndroid</code> is not a public Purchase field and is
          never the preferred output key.
        </p>
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
