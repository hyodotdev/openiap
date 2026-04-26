import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:platform/platform.dart';

import 'enums.dart';
import 'types.dart' as gentype;
import 'builders.dart';
import 'helpers.dart';
import 'utils.dart';
import 'errors.dart' as errors;

export 'types.dart' hide PurchaseError;
export 'builders.dart';
export 'utils.dart';
export 'helpers.dart' hide PurchaseResult, ConnectionResult;
export 'extensions/purchase_helpers.dart';
export 'enums.dart' hide IapPlatform, PurchaseState;
export 'errors.dart'
    show
        getCurrentPlatform,
        PurchaseError,
        ErrorCodeUtils,
        PurchaseResult,
        ConnectionResult,
        getUserFriendlyErrorMessage;

typedef PurchaseError = errors.PurchaseError;
typedef SubscriptionOfferAndroid = gentype.AndroidSubscriptionOfferInput;

class FlutterInappPurchase with RequestPurchaseBuilderApi {
  // Singleton instance
  static FlutterInappPurchase? _instance;

  /// Get the singleton instance
  static FlutterInappPurchase get instance {
    _instance ??= FlutterInappPurchase();
    return _instance!;
  }

  // Instance-level stream controllers
  StreamController<gentype.Purchase?>? _purchaseController;
  Stream<gentype.Purchase?> get purchaseUpdated {
    _purchaseController ??= StreamController<gentype.Purchase?>.broadcast();
    return _purchaseController!.stream;
  }

  StreamController<PurchaseResult?>? _purchaseErrorController;
  Stream<PurchaseResult?> get purchaseError {
    _purchaseErrorController ??= StreamController<PurchaseResult?>.broadcast();
    return _purchaseErrorController!.stream;
  }

  StreamController<ConnectionResult>? _connectionController;
  Stream<ConnectionResult> get connectionUpdated {
    _connectionController ??= StreamController<ConnectionResult>.broadcast();
    return _connectionController!.stream;
  }

  StreamController<String?>? _purchasePromotedController;
  Stream<String?> get purchasePromoted {
    _purchasePromotedController ??= StreamController<String?>.broadcast();
    return _purchasePromotedController!.stream;
  }

  final Map<String, bool> _acknowledgedAndroidPurchaseTokens = <String, bool>{};

  /// Defining the [MethodChannel] for Flutter_Inapp_Purchase
  final MethodChannel _channel = const MethodChannel('flutter_inapp');

  MethodChannel get channel => _channel;

  Platform get _platform => _pf;
  // Public getters used by platform mixins
  bool get isIOS => _platform.isIOS || _platform.isMacOS;
  bool get isAndroid => _platform.isAndroid;
  String get operatingSystem => _platform.operatingSystem;

  final Platform _pf;

  FlutterInappPurchase({Platform? platform})
      : _pf = platform ?? const LocalPlatform();

  @visibleForTesting
  FlutterInappPurchase.private(Platform platform) : _pf = platform;

  // Purchase event streams
  final StreamController<gentype.Purchase> _purchaseUpdatedListener =
      StreamController<gentype.Purchase>.broadcast();
  final StreamController<PurchaseError> _purchaseErrorListener =
      StreamController<PurchaseError>.broadcast();
  final StreamController<gentype.UserChoiceBillingDetails>
      _userChoiceBillingAndroidListener =
      StreamController<gentype.UserChoiceBillingDetails>.broadcast();
  final StreamController<gentype.DeveloperProvidedBillingDetailsAndroid>
      _developerProvidedBillingAndroidListener = StreamController<
          gentype.DeveloperProvidedBillingDetailsAndroid>.broadcast();
  final StreamController<gentype.Purchase> _subscriptionBillingIssueListener =
      StreamController<gentype.Purchase>.broadcast();

  /// Purchase updated event stream
  Stream<gentype.Purchase> get purchaseUpdatedListener =>
      _purchaseUpdatedListener.stream;

  /// Purchase error event stream
  Stream<PurchaseError> get purchaseErrorListener =>
      _purchaseErrorListener.stream;

  /// User choice billing Android event stream
  Stream<gentype.UserChoiceBillingDetails> get userChoiceBillingAndroid =>
      _userChoiceBillingAndroidListener.stream;

  /// Developer provided billing Android event stream (8.3.0+)
  /// Fires when user selects developer-provided billing option in external payments flow.
  Stream<gentype.DeveloperProvidedBillingDetailsAndroid>
      get developerProvidedBillingAndroid =>
          _developerProvidedBillingAndroidListener.stream;

  /// Subscription billing-issue event stream (cross-platform).
  ///
  /// Emits when an active subscription needs user attention for a payment
  /// problem. Unifies StoreKit 2 `Message.Reason.billingIssue` (iOS 18+) and
  /// Google Play Billing `Purchase.isSuspended` (Play Billing 8.1+). NOT
  /// emitted on the Meta Horizon flavor (Billing 7.0 compat lacks the signal).
  Stream<gentype.Purchase> get subscriptionBillingIssueListener =>
      _subscriptionBillingIssueListener.stream;

  bool _isInitialized = false;

  Future<void> _setPurchaseListener() async {
    _purchaseController ??= StreamController.broadcast();
    _purchaseErrorController ??= StreamController.broadcast();
    _connectionController ??= StreamController.broadcast();
    _purchasePromotedController ??= StreamController.broadcast();

    _channel.setMethodCallHandler((MethodCall call) async {
      switch (call.method) {
        case 'purchase-updated':
          try {
            Map<String, dynamic> result =
                jsonDecode(call.arguments as String) as Map<String, dynamic>;

            // Convert directly to Purchase without intermediate PurchasedItem
            final purchase = convertToPurchase(
              result,
              originalJson: result,
              platformIsAndroid: _platform.isAndroid,
              platformIsIOS: _platform.isIOS || _platform.isMacOS,
              acknowledgedAndroidPurchaseTokens:
                  _acknowledgedAndroidPurchaseTokens,
            );

            _purchaseController!.add(purchase);
            _purchaseUpdatedListener.add(purchase);
          } catch (e, stackTrace) {
            debugPrint(
              '[flutter_inapp_purchase] ERROR in purchase-updated: $e',
            );
            debugPrint('[flutter_inapp_purchase] Stack trace: $stackTrace');
          }
          break;
        case 'purchase-error':
          debugPrint(
            '[flutter_inapp_purchase] Processing purchase-error event',
          );
          Map<String, dynamic> result =
              jsonDecode(call.arguments as String) as Map<String, dynamic>;
          final purchaseResult = PurchaseResult.fromJSON(result);
          _purchaseErrorController!.add(purchaseResult);
          // Also emit to Open IAP compatible stream
          final error = convertToPurchaseError(
            purchaseResult,
            platform: _platform.isIOS || _platform.isMacOS
                ? gentype.IapPlatform.IOS
                : gentype.IapPlatform.Android,
          );
          debugPrint(
            '[flutter_inapp_purchase] Emitting error to purchaseErrorListener: $error',
          );
          _purchaseErrorListener.add(error);
          break;
        case 'connection-updated':
          Map<String, dynamic> result =
              jsonDecode(call.arguments as String) as Map<String, dynamic>;
          _connectionController!.add(
            ConnectionResult.fromJSON(Map<String, dynamic>.from(result)),
          );
          break;
        case 'iap-promoted-product':
          String? productId = call.arguments as String?;
          _purchasePromotedController!.add(productId);
          break;
        case 'user-choice-billing-android':
          try {
            Map<String, dynamic> result =
                jsonDecode(call.arguments as String) as Map<String, dynamic>;
            final details = gentype.UserChoiceBillingDetails.fromJson(result);
            _userChoiceBillingAndroidListener.add(details);
          } catch (e, stackTrace) {
            debugPrint(
              '[flutter_inapp_purchase] ERROR in user-choice-billing-android: $e',
            );
            debugPrint('[flutter_inapp_purchase] Stack trace: $stackTrace');
          }
          break;
        case 'developer-provided-billing-android':
          try {
            Map<String, dynamic> result =
                jsonDecode(call.arguments as String) as Map<String, dynamic>;
            final details =
                gentype.DeveloperProvidedBillingDetailsAndroid.fromJson(result);
            _developerProvidedBillingAndroidListener.add(details);
          } catch (e, stackTrace) {
            debugPrint(
              '[flutter_inapp_purchase] ERROR in developer-provided-billing-android: $e',
            );
            debugPrint('[flutter_inapp_purchase] Stack trace: $stackTrace');
          }
          break;
        case 'subscription-billing-issue':
          try {
            Map<String, dynamic> result =
                jsonDecode(call.arguments as String) as Map<String, dynamic>;
            final purchase = convertToPurchase(
              result,
              originalJson: result,
              platformIsAndroid: _platform.isAndroid,
              platformIsIOS: _platform.isIOS || _platform.isMacOS,
              acknowledgedAndroidPurchaseTokens:
                  _acknowledgedAndroidPurchaseTokens,
            );
            _subscriptionBillingIssueListener.add(purchase);
          } catch (e, stackTrace) {
            debugPrint(
              '[flutter_inapp_purchase] ERROR in subscription-billing-issue: $e',
            );
            debugPrint('[flutter_inapp_purchase] Stack trace: $stackTrace');
          }
          break;
        default:
          throw ArgumentError('Unknown method ${call.method}');
      }
      return Future.value(null);
    });
  }

  /// Initialize the store connection. Must be called before any other IAP API.
  ///
  /// Parameters:
  /// - `alternativeBillingModeAndroid`: Android-only — opt into Google's alternative
  ///   billing flow (deprecated; prefer `enableBillingProgramAndroid`).
  /// - `enableBillingProgramAndroid`: Android-only — Play Billing 8.2.0+ billing program
  ///   (e.g. External Payments). iOS ignores both fields.
  ///
  /// Returns `true` once the platform billing client is connected.
  /// Throws when the billing client fails to initialize.
  ///
  /// ```dart
  /// await FlutterInappPurchase.instance.initConnection();
  /// ```
  ///
  /// See: https://www.openiap.dev/docs/apis/init-connection
  gentype.MutationInitConnectionHandler get initConnection => ({
        gentype.AlternativeBillingModeAndroid? alternativeBillingModeAndroid,
        gentype.BillingProgramAndroid? enableBillingProgramAndroid,
      }) async {
        if (_isInitialized) {
          return true;
        }

        try {
          await _setPurchaseListener();

          // Build config map for alternative billing and billing program
          Map<String, dynamic>? config;
          if (alternativeBillingModeAndroid != null ||
              enableBillingProgramAndroid != null) {
            config = {};
            if (alternativeBillingModeAndroid != null) {
              config['alternativeBillingModeAndroid'] =
                  alternativeBillingModeAndroid.toJson();
            }
            if (enableBillingProgramAndroid != null) {
              config['enableBillingProgramAndroid'] =
                  enableBillingProgramAndroid.toJson();
            }
          }

          await _channel.invokeMethod('initConnection', config);
          _isInitialized = true;
          return true;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'initialize IAP connection',
          );
        } catch (error) {
          throw PurchaseError(
            code: gentype.ErrorCode.NotPrepared,
            message: 'Failed to initialize IAP connection: ${error.toString()}',
          );
        }
      };

  /// Close the store connection and release resources.
  ///
  /// See: https://www.openiap.dev/docs/apis/end-connection
  gentype.MutationEndConnectionHandler get endConnection => () async {
        if (!_isInitialized) {
          return false;
        }

        try {
          // For flutter IAP compatibility, call endConnection directly
          await _channel.invokeMethod('endConnection');

          _isInitialized = false;
          return true;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'end IAP connection',
          );
        } catch (error) {
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to end IAP connection: ${error.toString()}',
          );
        }
      };

  /// Initiate a purchase or subscription flow. The result is delivered via the
  /// `purchaseUpdated` stream — NOT the return value.
  ///
  /// Parameters:
  /// - `params`: `RequestPurchaseProps`, discriminated by `type`. Pass platform fields
  ///   via `request.apple` (iOS sku) and `request.google` (skus, subscriptionOffers).
  ///
  /// Returns the dispatched purchase payload. **Do not rely on it** for the outcome.
  /// Throws on synchronous rejection (e.g. billing not ready, missing offerToken on subs).
  ///
  /// ```dart
  /// await FlutterInappPurchase.instance.requestPurchase(
  ///   RequestPurchaseProps(
  ///     request: RequestPurchasePropsByPlatforms(
  ///       apple: RequestPurchaseIosProps(sku: 'com.app.premium'),
  ///       google: RequestPurchaseAndroidProps(skus: ['com.app.premium']),
  ///     ),
  ///     type: ProductQueryType.InApp,
  ///   ),
  /// );
  /// ```
  ///
  /// **Warning:** Event-based. Subscribe to `purchaseUpdated` / `purchaseError` for
  /// the actual outcome.
  ///
  /// See: https://www.openiap.dev/docs/apis/request-purchase
  @override
  gentype.MutationRequestPurchaseHandler get requestPurchase => (params) async {
        if (!_isInitialized) {
          throw PurchaseError(
            code: gentype.ErrorCode.NotPrepared,
            message: 'IAP connection not initialized',
          );
        }

        // Determine type based on factory constructor used
        final type = params.toJson()['type'] as String;
        final productType = type == 'in-app'
            ? gentype.ProductQueryType.InApp
            : gentype.ProductQueryType.Subs;

        if (productType == gentype.ProductQueryType.All) {
          throw PurchaseError(
            code: gentype.ErrorCode.DeveloperError,
            message:
                'requestPurchase only supports IN_APP or SUBS request types',
          );
        }

        final nativeType = resolveProductType(productType);

        try {
          if (_platform.isIOS || _platform.isMacOS) {
            // Extract props from the JSON representation
            final json = params.toJson();
            final requestKey =
                type == 'in-app' ? 'requestPurchase' : 'requestSubscription';
            final requestData = json[requestKey] as Map<String, dynamic>?;

            if (requestData == null) {
              throw PurchaseError(
                code: gentype.ErrorCode.DeveloperError,
                message:
                    'Missing request data. JSON: ${json.toString().substring(0, 200)}',
              );
            }

            final iosData = requestData['ios'] as Map<String, dynamic>?;

            if (iosData == null) {
              throw PurchaseError(
                code: gentype.ErrorCode.DeveloperError,
                message:
                    'Missing iOS purchase parameters. Request data keys: ${requestData.keys.join(", ")}',
              );
            }

            final iosProps = type == 'in-app'
                ? gentype.RequestPurchaseIosProps.fromJson(iosData)
                : gentype.RequestSubscriptionIosProps.fromJson(iosData);

            final payload = buildIosPurchasePayload(nativeType, iosProps);

            if (payload == null) {
              throw PurchaseError(
                code: gentype.ErrorCode.DeveloperError,
                message: 'Missing iOS purchase parameters',
              );
            }

            await _channel.invokeMethod('requestPurchase', payload);
            return null;
          }

          if (_platform.isAndroid) {
            // Extract props from the JSON representation
            final json = params.toJson();
            final requestKey =
                type == 'in-app' ? 'requestPurchase' : 'requestSubscription';
            final requestData = json[requestKey] as Map<String, dynamic>?;
            // Support both 'google' (new) and 'android' (deprecated) fields
            final androidData = (requestData?['google'] ??
                requestData?['android']) as Map<String, dynamic>?;

            if (androidData == null) {
              throw PurchaseError(
                code: gentype.ErrorCode.DeveloperError,
                message: 'Missing Android purchase parameters',
              );
            }

            // Parse Android props based on type
            final androidProps = type == 'inapp'
                ? gentype.RequestPurchaseAndroidProps.fromJson(androidData)
                : gentype.RequestSubscriptionAndroidProps.fromJson(androidData);

            // Handle both RequestPurchaseAndroidProps and RequestSubscriptionAndroidProps
            final List<String> skus;
            final bool? isOfferPersonalized;
            final String? obfuscatedAccount;
            final String? obfuscatedProfile;
            final String? purchaseToken;
            final int? replacementMode;
            final String? offerToken;
            final List<gentype.AndroidSubscriptionOfferInput>?
                subscriptionOffers;
            final gentype.DeveloperBillingOptionParamsAndroid?
                developerBillingOption;
            final gentype.SubscriptionProductReplacementParamsAndroid?
                subscriptionProductReplacementParams;

            if (androidProps is gentype.RequestPurchaseAndroidProps) {
              skus = androidProps.skus;
              isOfferPersonalized = androidProps.isOfferPersonalized;
              obfuscatedAccount = androidProps.obfuscatedAccountId;
              obfuscatedProfile = androidProps.obfuscatedProfileId;
              purchaseToken = null;
              replacementMode = null;
              offerToken = androidProps.offerToken;
              subscriptionOffers = null;
              developerBillingOption = androidProps.developerBillingOption;
              subscriptionProductReplacementParams = null;
            } else if (androidProps
                is gentype.RequestSubscriptionAndroidProps) {
              skus = androidProps.skus;
              isOfferPersonalized = androidProps.isOfferPersonalized;
              obfuscatedAccount = androidProps.obfuscatedAccountId;
              obfuscatedProfile = androidProps.obfuscatedProfileId;
              purchaseToken = androidProps.purchaseToken;
              replacementMode = androidProps.replacementMode;
              offerToken = null; // Subscriptions don't use offerToken
              subscriptionOffers = androidProps.subscriptionOffers;
              developerBillingOption = androidProps.developerBillingOption;
              subscriptionProductReplacementParams =
                  androidProps.subscriptionProductReplacementParams;
            } else {
              throw PurchaseError(
                code: gentype.ErrorCode.DeveloperError,
                message: 'Invalid Android purchase parameters type',
              );
            }

            if (skus.isEmpty) {
              throw PurchaseError(
                code: gentype.ErrorCode.EmptySkuList,
                message: 'Android purchase requires at least one SKU',
              );
            }

            final payload = <String, dynamic>{
              'type': nativeType,
              'skus': skus,
              'productId': skus.first,
              'isOfferPersonalized': isOfferPersonalized ?? false,
            };

            // Use simplified field names (without Android suffix) per OpenIAP 1.3.15+
            if (obfuscatedAccount != null) {
              payload['obfuscatedAccountId'] = obfuscatedAccount;
            }

            if (obfuscatedProfile != null) {
              payload['obfuscatedProfileId'] = obfuscatedProfile;
            }

            if (purchaseToken != null) {
              payload['purchaseToken'] = purchaseToken;
            }

            if (replacementMode != null) {
              payload['replacementMode'] = replacementMode;
            }

            // offerToken for one-time purchase discounts (Android 7.0+)
            if (offerToken != null) {
              payload['offerToken'] = offerToken;
            }

            if (subscriptionOffers != null && subscriptionOffers.isNotEmpty) {
              payload['subscriptionOffers'] =
                  subscriptionOffers.map((offer) => offer.toJson()).toList();
            }

            // Add useAlternativeBilling from the RequestPurchaseProps
            // Include it even if null or false to ensure proper mode switching
            final useAlternativeBilling =
                json['useAlternativeBilling'] as bool?;
            payload['useAlternativeBilling'] = useAlternativeBilling;

            // Add developerBillingOption for External Payments (8.3.0+)
            if (developerBillingOption != null) {
              payload['developerBillingOption'] =
                  developerBillingOption.toJson();
            }

            // Add subscriptionProductReplacementParams for item-level
            // replacement (Billing Library 8.1.0+)
            if (subscriptionProductReplacementParams != null) {
              payload['subscriptionProductReplacementParams'] =
                  subscriptionProductReplacementParams.toJson();
            }

            await _channel.invokeMethod('requestPurchase', payload);
            return null;
          }

          throw PurchaseError(
            code: gentype.ErrorCode.IapNotAvailable,
            message: 'requestPurchase is not supported on this platform',
          );
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'request purchase',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to request purchase: ${error.toString()}',
          );
        }
      };

  /// DSL-like request subscription method with builder pattern
  // requestSubscriptionWithBuilder removed in 6.6.0 (use requestPurchaseWithBuilder)

  /// List the user's unfinished purchases — non-consumables, active subscriptions, and
  /// any pending transactions not yet finished.
  ///
  /// Parameters:
  /// - `alsoPublishToEventListenerIOS`: iOS-only — also emit results to the
  ///   `purchaseUpdated` event listener.
  /// - `includeSuspendedAndroid`: Android-only — include suspended subscriptions in the
  ///   result.
  /// - `onlyIncludeActiveItemsIOS`: iOS-only — when `true` (default), excludes expired
  ///   subscriptions from the result.
  ///
  /// Returns a list of `Purchase` currently held by the store.
  /// Throws when the platform query fails.
  ///
  /// ```dart
  /// final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();
  /// for (final p in purchases) {
  ///   if (await verifyOnServer(p)) {
  ///     await FlutterInappPurchase.instance.finishTransaction(
  ///       purchase: p,
  ///       isConsumable: false,
  ///     );
  ///   }
  /// }
  /// ```
  ///
  /// See: https://www.openiap.dev/docs/apis/get-available-purchases
  gentype.QueryGetAvailablePurchasesHandler get getAvailablePurchases => ({
        bool? alsoPublishToEventListenerIOS,
        bool? includeSuspendedAndroid,
        bool? onlyIncludeActiveItemsIOS,
      }) async {
        if (!_isInitialized) {
          throw PurchaseError(
            code: gentype.ErrorCode.NotPrepared,
            message: 'IAP connection not initialized',
          );
        }

        try {
          final normalizedOptions = gentype.PurchaseOptions(
            alsoPublishToEventListenerIOS:
                alsoPublishToEventListenerIOS ?? false,
            includeSuspendedAndroid: includeSuspendedAndroid ?? false,
            onlyIncludeActiveItemsIOS: onlyIncludeActiveItemsIOS ?? true,
          );

          bool hasResolvableIdentifier(gentype.Purchase purchase) {
            final token = purchase.purchaseToken;
            if (token != null && token.isNotEmpty) {
              return true;
            }
            if (purchase is gentype.PurchaseIOS) {
              return purchase.transactionId.isNotEmpty;
            }
            if (purchase is gentype.PurchaseAndroid) {
              return purchase.transactionId?.isNotEmpty ?? false;
            }
            return purchase.id.isNotEmpty;
          }

          Future<List<gentype.Purchase>> resolvePurchases() async {
            List<gentype.Purchase> raw = const <gentype.Purchase>[];

            if (_platform.isIOS || _platform.isMacOS) {
              final args = <String, dynamic>{
                'alsoPublishToEventListenerIOS':
                    normalizedOptions.alsoPublishToEventListenerIOS ?? false,
                'onlyIncludeActiveItemsIOS':
                    normalizedOptions.onlyIncludeActiveItemsIOS ?? true,
              };
              final dynamic result = await _channel.invokeMethod(
                'getAvailableItems',
                args,
              );
              raw = extractPurchases(
                result,
                platformIsAndroid: false,
                platformIsIOS: true,
                acknowledgedAndroidPurchaseTokens:
                    _acknowledgedAndroidPurchaseTokens,
              );
            } else if (_platform.isAndroid) {
              final args = <String, dynamic>{
                'includeSuspendedAndroid':
                    normalizedOptions.includeSuspendedAndroid ?? false,
              };
              final dynamic result = await _channel.invokeMethod(
                'getAvailableItems',
                args,
              );
              raw = extractPurchases(
                result,
                platformIsAndroid: true,
                platformIsIOS: false,
                acknowledgedAndroidPurchaseTokens:
                    _acknowledgedAndroidPurchaseTokens,
              );
            }

            return raw
                .where((purchase) => purchase.productId.isNotEmpty)
                .where(hasResolvableIdentifier)
                .toList(growable: false);
          }

          return await resolvePurchases();
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'get available purchases',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to get available purchases: ${error.toString()}',
          );
        }
      };

  /// Return the user's storefront country code.
  ///
  /// See: https://www.openiap.dev/docs/apis/get-storefront
  gentype.QueryGetStorefrontHandler get getStorefront => () async {
        if (!isIOS && !_platform.isAndroid) {
          return '';
        }

        try {
          final String? storefront = await channel.invokeMethod<String>(
            'getStorefront',
          );
          return storefront ?? '';
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'get storefront',
          );
        } catch (error) {
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to get storefront: ${error.toString()}',
          );
        }
      };

  /// Deprecated. Use cross-platform `getStorefront` instead.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/get-storefront-ios
  gentype.QueryGetStorefrontIOSHandler get getStorefrontIOS => () async {
        if (!_platform.isIOS || _platform.isMacOS) {
          throw PurchaseError(
            code: gentype.ErrorCode.IapNotAvailable,
            message: 'Storefront is only available on iOS',
          );
        }

        try {
          final result = await channel.invokeMethod<Map<dynamic, dynamic>>(
            'getStorefrontIOS',
          );
          if (result != null && result['countryCode'] != null) {
            return result['countryCode'] as String;
          }
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to get storefront country code',
          );
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'get storefront',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to get storefront: ${error.toString()}',
          );
        }
      };

  /// Force sync transactions with the App Store.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/sync-ios
  gentype.MutationSyncIOSHandler get syncIOS => () async {
        if (!_platform.isIOS || _platform.isMacOS) {
          debugPrint('syncIOS is only supported on iOS');
          return false;
        }

        try {
          final result = await _channel.invokeMethod<bool>('syncIOS');
          return result ?? false;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
              error, 'sync iOS purchases');
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.SyncError,
            message: 'Failed to sync iOS purchases: ${error.toString()}',
          );
        }
      };

  /// Check intro-offer eligibility for a subscription group.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
  gentype.QueryIsEligibleForIntroOfferIOSHandler
      get isEligibleForIntroOfferIOS => (groupId) async {
            if (!_platform.isIOS || _platform.isMacOS) {
              return false;
            }

            try {
              final result = await _channel.invokeMethod<bool>(
                'isEligibleForIntroOfferIOS',
                {'productId': groupId},
              );
              return result ?? false;
            } catch (error) {
              debugPrint('Error checking intro offer eligibility: $error');
              return false;
            }
          };

  /// Get subscription status objects from StoreKit 2.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/subscription-status-ios
  gentype.QuerySubscriptionStatusIOSHandler get subscriptionStatusIOS =>
      (sku) async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return <gentype.SubscriptionStatusIOS>[];
        }

        try {
          final dynamic result = await _channel.invokeMethod(
            'getSubscriptionStatus',
            {'sku': sku},
          );

          if (result == null) {
            return <gentype.SubscriptionStatusIOS>[];
          }

          List<dynamic> asList;
          if (result is String) {
            asList = json.decode(result) as List<dynamic>;
          } else if (result is List) {
            asList = result;
          } else if (result is Map) {
            asList = [result];
          } else {
            return <gentype.SubscriptionStatusIOS>[];
          }

          final statuses = <gentype.SubscriptionStatusIOS>[];
          for (final entry in asList) {
            if (entry is Map) {
              final normalized = entry.map<String, dynamic>(
                (key, value) => MapEntry(key.toString(), value),
              );
              statuses.add(gentype.SubscriptionStatusIOS.fromJson(normalized));
            }
          }
          return statuses;
        } catch (error) {
          debugPrint('Error getting subscription status: $error');
          return <gentype.SubscriptionStatusIOS>[];
        }
      };

  /// Clear pending transactions in the queue (sandbox helper).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/clear-transaction-ios
  gentype.MutationClearTransactionIOSHandler get clearTransactionIOS =>
      () async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return false;
        }

        try {
          await _channel.invokeMethod('clearTransactionIOS');
          return true;
        } catch (error) {
          debugPrint('Error clearing pending transactions: $error');
          return false;
        }
      };

  /// Read the App Store-promoted product, if any.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/get-promoted-product-ios
  gentype.QueryGetPromotedProductIOSHandler get getPromotedProductIOS =>
      () async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return null;
        }

        try {
          final dynamic result = await _channel.invokeMethod(
            'getPromotedProductIOS',
          );
          if (result == null) {
            return null;
          }

          if (result is Map) {
            return gentype.ProductIOS.fromJson(
              result.map<String, dynamic>(
                (key, value) => MapEntry(key.toString(), value),
              ),
            );
          }

          if (result is String) {
            return null;
          }

          return null;
        } catch (error) {
          debugPrint('Error getting promoted product: $error');
          return null;
        }
      };

  /// Buy the currently promoted product.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/request-purchase-on-promoted-product-ios
  @Deprecated(
    'Use purchasePromoted stream + requestPurchase() instead. '
    'In StoreKit 2, promoted products are purchased via standard flow.',
  )
  gentype.MutationRequestPurchaseOnPromotedProductIOSHandler
      get requestPurchaseOnPromotedProductIOS => () async {
            if (!_platform.isIOS || _platform.isMacOS) {
              return false;
            }

            try {
              await _channel
                  .invokeMethod('requestPurchaseOnPromotedProductIOS');
              return true;
            } catch (error) {
              debugPrint('Error requesting promoted product purchase: $error');
              return false;
            }
          };

  /// Fetch the app transaction (iOS 16+).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/get-app-transaction-ios
  gentype.QueryGetAppTransactionIOSHandler get getAppTransactionIOS =>
      () async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return null;
        }

        try {
          final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
            'getAppTransaction',
          );
          if (result == null) {
            return null;
          }

          final map = result.map<String, dynamic>(
            (key, value) => MapEntry(key.toString(), value),
          );
          return gentype.AppTransaction.fromJson(map);
        } catch (error) {
          debugPrint('Error getting app transaction: $error');
          return null;
        }
      };

  /// Show the App Store offer code redemption sheet.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
  gentype.MutationPresentCodeRedemptionSheetIOSHandler
      get presentCodeRedemptionSheetIOS => () async {
            if (!_platform.isIOS || _platform.isMacOS) {
              throw PlatformException(
                code: 'platform',
                message:
                    'presentCodeRedemptionSheetIOS is only supported on iOS',
              );
            }

            try {
              await channel.invokeMethod('presentCodeRedemptionSheetIOS');
              return true;
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'present code redemption sheet',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message: 'Failed to present code redemption sheet: '
                    '${error.toString()}',
              );
            }
          };

  /// Present the refund request sheet (iOS 15+).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/begin-refund-request-ios
  gentype.MutationBeginRefundRequestIOSHandler get beginRefundRequestIOS =>
      (String sku) async {
        if (!_platform.isIOS || _platform.isMacOS) {
          throw PlatformException(
            code: 'platform',
            message: 'beginRefundRequestIOS is only supported on iOS',
          );
        }

        try {
          final status = await channel.invokeMethod<String>(
            'beginRefundRequestIOS',
            <String, dynamic>{'sku': sku},
          );
          return status;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'begin refund request',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to begin refund request: ${error.toString()}',
          );
        }
      };

  /// Present the manage-subscriptions sheet.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
  gentype.MutationShowManageSubscriptionsIOSHandler
      get showManageSubscriptionsIOS => () async {
            if (!_platform.isIOS || _platform.isMacOS) {
              throw PlatformException(
                code: 'platform',
                message: 'showManageSubscriptionsIOS is only supported on iOS',
              );
            }

            try {
              await channel.invokeMethod('showManageSubscriptionsIOS');
              return const <gentype.PurchaseIOS>[];
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'show manage subscriptions',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message: 'Failed to show manage subscriptions: '
                    '${error.toString()}',
              );
            }
          };

  // Original API methods (with deprecation annotations where needed)

  /// List unfinished StoreKit transactions.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/get-pending-transactions-ios
  gentype.QueryGetPendingTransactionsIOSHandler get getPendingTransactionsIOS =>
      () async {
        if (_platform.isIOS || _platform.isMacOS) {
          final dynamic result = await _channel.invokeMethod(
            'getPendingTransactionsIOS',
          );
          final purchases = extractPurchases(
            result,
            platformIsAndroid: _platform.isAndroid,
            platformIsIOS: _platform.isIOS || _platform.isMacOS,
            acknowledgedAndroidPurchaseTokens:
                _acknowledgedAndroidPurchaseTokens,
          );
          return purchases.whereType<gentype.PurchaseIOS>().toList(
                growable: false,
              );
        }
        return const <gentype.PurchaseIOS>[];
      };

  /// List every StoreKit transaction (finished + unfinished) for the current user.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/get-all-transactions-ios
  gentype.QueryGetAllTransactionsIOSHandler get getAllTransactionsIOS =>
      () async {
        if (_platform.isIOS || _platform.isMacOS) {
          final dynamic result = await _channel.invokeMethod(
            'getAllTransactionsIOS',
          );
          final purchases = extractPurchases(
            result,
            platformIsAndroid: _platform.isAndroid,
            platformIsIOS: _platform.isIOS || _platform.isMacOS,
            acknowledgedAndroidPurchaseTokens:
                _acknowledgedAndroidPurchaseTokens,
          );
          return purchases.whereType<gentype.PurchaseIOS>().toList(
                growable: false,
              );
        }
        return const <gentype.PurchaseIOS>[];
      };

  /// Get the user's current entitlement for a product.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/current-entitlement-ios
  gentype.QueryCurrentEntitlementIOSHandler get currentEntitlementIOS =>
      (String sku) async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return null;
        }
        try {
          final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
            'currentEntitlementIOS',
            <String, dynamic>{'sku': sku},
          );
          if (result == null) return null;
          final purchases = extractPurchases(
            <dynamic>[result],
            platformIsAndroid: _platform.isAndroid,
            platformIsIOS: _platform.isIOS || _platform.isMacOS,
            acknowledgedAndroidPurchaseTokens:
                _acknowledgedAndroidPurchaseTokens,
          );
          return purchases.whereType<gentype.PurchaseIOS>().firstOrNull;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'fetch current entitlement',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to fetch current entitlement: ${error.toString()}',
          );
        }
      };

  /// Get the latest verified transaction for a product.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/latest-transaction-ios
  gentype.QueryLatestTransactionIOSHandler get latestTransactionIOS =>
      (String sku) async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return null;
        }
        try {
          final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
            'latestTransactionIOS',
            <String, dynamic>{'sku': sku},
          );
          if (result == null) return null;
          final purchases = extractPurchases(
            <dynamic>[result],
            platformIsAndroid: _platform.isAndroid,
            platformIsIOS: _platform.isIOS || _platform.isMacOS,
            acknowledgedAndroidPurchaseTokens:
                _acknowledgedAndroidPurchaseTokens,
          );
          return purchases.whereType<gentype.PurchaseIOS>().firstOrNull;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'fetch latest transaction',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to fetch latest transaction: ${error.toString()}',
          );
        }
      };

  /// Check whether a transaction's JWS verification passed.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/is-transaction-verified-ios
  gentype.QueryIsTransactionVerifiedIOSHandler get isTransactionVerifiedIOS =>
      (String sku) async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return false;
        }
        try {
          final verified = await _channel.invokeMethod<bool>(
            'isTransactionVerifiedIOS',
            <String, dynamic>{'sku': sku},
          );
          return verified ?? false;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'verify transaction',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to verify transaction: ${error.toString()}',
          );
        }
      };

  /// Return the JWS string for a transaction.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/get-transaction-jws-ios
  gentype.QueryGetTransactionJwsIOSHandler get getTransactionJwsIOS =>
      (String sku) async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return null;
        }
        try {
          return await _channel.invokeMethod<String>(
            'getTransactionJwsIOS',
            <String, dynamic>{'sku': sku},
          );
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'fetch transaction jws',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to fetch transaction jws: ${error.toString()}',
          );
        }
      };

  /// Get base64 receipt data (legacy validation).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/get-receipt-data-ios
  gentype.QueryGetReceiptDataIOSHandler get getReceiptDataIOS => () async {
        if (!_platform.isIOS || _platform.isMacOS) {
          return null;
        }
        try {
          return await _channel.invokeMethod<String>('getReceiptDataIOS');
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'fetch receipt data',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to fetch receipt data: ${error.toString()}',
          );
        }
      };

  /// Check eligibility for the external purchase notice sheet (iOS 17.4+).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
  gentype.QueryCanPresentExternalPurchaseNoticeIOSHandler
      get canPresentExternalPurchaseNoticeIOS => () async {
            if (!_platform.isIOS || _platform.isMacOS) {
              return false;
            }
            try {
              final result = await _channel.invokeMethod<bool>(
                'canPresentExternalPurchaseNoticeIOS',
              );
              return result ?? false;
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'check external purchase notice eligibility',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message:
                    'Failed to check external purchase notice eligibility: ${error.toString()}',
              );
            }
          };

  /// Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds.
  ///
  /// See: https://www.openiap.dev/docs/apis/android/acknowledge-purchase-android
  gentype.MutationAcknowledgePurchaseAndroidHandler
      get acknowledgePurchaseAndroid => (purchaseToken) async {
            if (!_platform.isAndroid) {
              throw PurchaseError(
                code: gentype.ErrorCode.IapNotAvailable,
                message:
                    'acknowledgePurchaseAndroid is only available on Android',
              );
            }

            try {
              final dynamic response = await _channel.invokeMethod(
                'acknowledgePurchaseAndroid',
                {'purchaseToken': purchaseToken},
              );

              parseAndLogAndroidResponse(
                response,
                successLog:
                    '[FlutterInappPurchase] Android: Purchase acknowledged successfully',
                failureLog:
                    '[FlutterInappPurchase] Android: Failed to parse acknowledge response',
              );

              if (response is bool) {
                return response;
              }

              if (response is String) {
                final parsed = json.decode(response) as Map<String, dynamic>;
                final code = parsed['responseCode'] as int? ?? 0;
                final success = parsed['success'] as bool? ?? false;
                return code == 0 || success;
              }

              if (response is Map) {
                final parsed = response.map<String, dynamic>(
                  (key, value) => MapEntry(key.toString(), value),
                );
                final code = parsed['responseCode'] as int? ?? 0;
                final success = parsed['success'] as bool? ?? false;
                return code == 0 || success;
              }

              return true;
            } catch (error) {
              debugPrint('Error acknowledging purchase: $error');
              return false;
            }
          };

  /// Consume a consumable purchase so it can be re-bought.
  ///
  /// See: https://www.openiap.dev/docs/apis/android/consume-purchase-android
  gentype.MutationConsumePurchaseAndroidHandler get consumePurchaseAndroid =>
      (purchaseToken) async {
        if (!_platform.isAndroid) {
          throw PurchaseError(
            code: gentype.ErrorCode.IapNotAvailable,
            message: 'consumePurchaseAndroid is only available on Android',
          );
        }

        try {
          final dynamic response = await _channel.invokeMethod(
            'consumePurchaseAndroid',
            {'purchaseToken': purchaseToken},
          );

          if (response is Map) {
            final map = response.map<String, dynamic>(
              (key, value) => MapEntry(key.toString(), value),
            );
            return map['success'] as bool? ?? true;
          }

          if (response is bool) {
            return response;
          }

          return true;
        } catch (error) {
          debugPrint('Error consuming purchase: $error');
          return false;
        }
      };

  /// Open the platform's subscription management UI.
  ///
  /// See: https://www.openiap.dev/docs/apis/deep-link-to-subscriptions
  gentype.MutationDeepLinkToSubscriptionsHandler get deepLinkToSubscriptions =>
      ({String? packageNameAndroid, String? skuAndroid}) async {
        if (!_platform.isAndroid) {
          throw PurchaseError(
            code: gentype.ErrorCode.IapNotAvailable,
            message:
                'deepLinkToSubscriptionsAndroid is only available on Android',
          );
        }

        final args = <String, dynamic>{};
        if (packageNameAndroid != null && packageNameAndroid.isNotEmpty) {
          args['packageNameAndroid'] = packageNameAndroid;
          args['packageName'] = packageNameAndroid;
        }
        if (skuAndroid != null && skuAndroid.isNotEmpty) {
          args['skuAndroid'] = skuAndroid;
          args['sku'] = skuAndroid;
        }

        await _channel.invokeMethod('deepLinkToSubscriptionsAndroid', args);
      };

  /// Complete a purchase transaction. Call after server-side verification to remove
  /// it from the queue.
  ///
  /// Parameters:
  /// - `purchase` (required): the `Purchase` to finalize.
  /// - `isConsumable`: `true` for consumables (re-buyable like coins); `false` (default)
  ///   for non-consumables and subscriptions.
  ///
  /// Throws when the platform finalize call fails.
  ///
  /// ```dart
  /// await FlutterInappPurchase.instance.finishTransaction(
  ///   purchase: purchase,
  ///   isConsumable: false,
  /// );
  /// ```
  ///
  /// **Critical:** Android purchases must be finalized within 3 days or Google
  /// auto-refunds. iOS unfinished transactions replay on every app launch.
  ///
  /// See: https://www.openiap.dev/docs/apis/finish-transaction
  gentype.MutationFinishTransactionHandler get finishTransaction =>
      ({required gentype.Purchase purchase, bool? isConsumable}) async {
        final bool consumable = isConsumable ?? false;
        final transactionId = purchase.id;

        if (_platform.isAndroid) {
          if (purchase.purchaseToken == null ||
              purchase.purchaseToken!.isEmpty) {
            throw PurchaseError(
              code: gentype.ErrorCode.PurchaseError,
              message:
                  'Purchase token is required to finish Android transactions.',
            );
          }

          if (consumable) {
            debugPrint(
              '[FlutterInappPurchase] Android: Consuming product with token: ${purchase.purchaseToken}',
            );
            final result = await _channel.invokeMethod(
              'consumePurchaseAndroid',
              <String, dynamic>{'purchaseToken': purchase.purchaseToken},
            );
            parseAndLogAndroidResponse(
              result,
              successLog:
                  '[FlutterInappPurchase] Android: Product consumed successfully',
              failureLog:
                  '[FlutterInappPurchase] Android: Failed to parse consume response',
            );
            _acknowledgedAndroidPurchaseTokens.remove(purchase.purchaseToken!);
            return;
          }

          final alreadyAcknowledged =
              _acknowledgedAndroidPurchaseTokens[purchase.purchaseToken!] ??
                  false;
          if (alreadyAcknowledged) {
            if (kDebugMode) {
              debugPrint(
                '[FlutterInappPurchase] Android: Purchase already acknowledged (cached)',
              );
            }
            return;
          }

          final maskedToken = purchase.purchaseToken!.replaceAllMapped(
            RegExp(r'.(?=.{4})'),
            (m) => '*',
          );

          if (kDebugMode) {
            debugPrint(
              '[FlutterInappPurchase] Android: Acknowledging purchase with token: $maskedToken',
            );
          }

          // Subscriptions require acknowledgePurchase for compatibility
          final methodName = purchase.isAutoRenewing
              ? 'acknowledgePurchase'
              : 'acknowledgePurchaseAndroid';

          final result =
              await _channel.invokeMethod(methodName, <String, dynamic>{
            'purchaseToken': purchase.purchaseToken,
          });
          bool didAcknowledgeSucceed(dynamic response) {
            if (response == null) {
              return false;
            }

            if (response is bool) {
              return response;
            }

            Map<String, dynamic>? parsed;

            if (response is String) {
              try {
                final dynamic decoded = jsonDecode(response);
                if (decoded is Map<String, dynamic>) {
                  parsed = decoded;
                } else {
                  return false;
                }
              } catch (_) {
                return false;
              }
            } else if (response is Map<dynamic, dynamic>) {
              parsed = response.map<String, dynamic>(
                (key, value) => MapEntry(key.toString(), value),
              );
            }

            if (parsed != null) {
              final dynamic code = parsed['responseCode'];
              if (code is num && code == 0) {
                return true;
              }
              if (code is String && int.tryParse(code) == 0) {
                return true;
              }

              final bool? success = parsed['success'] as bool?;
              if (success != null) {
                return success;
              }
            }

            return false;
          }

          final didAcknowledge = didAcknowledgeSucceed(result);
          parseAndLogAndroidResponse(
            result,
            successLog:
                '[FlutterInappPurchase] Android: Purchase acknowledged successfully',
            failureLog:
                '[FlutterInappPurchase] Android: Failed to parse acknowledge response',
          );
          if (didAcknowledge) {
            _acknowledgedAndroidPurchaseTokens[purchase.purchaseToken!] = true;
          } else if (kDebugMode) {
            debugPrint(
              '[FlutterInappPurchase] Android: Acknowledge response indicated failure; will retry later ($maskedToken)',
            );
          }
          return;
        }

        if (_platform.isIOS || _platform.isMacOS) {
          debugPrint(
            '[FlutterInappPurchase] iOS: Finishing transaction with ID: $transactionId',
          );
          final payload = <String, dynamic>{
            'transactionId': transactionId,
            'purchase': purchase.toJson(),
            'isConsumable': consumable,
          };
          await _channel.invokeMethod('finishTransaction', payload);
          return;
        }

        throw PlatformException(
          code: _platform.operatingSystem,
          message: 'platform not supported',
        );
      };

  /// Deprecated. Legacy App Store receipt validation. Use `verifyPurchase` instead.
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/validate-receipt-ios
  gentype.QueryValidateReceiptIOSHandler get validateReceiptIOS => ({
        gentype.VerifyPurchaseAppleOptions? apple,
        gentype.VerifyPurchaseGoogleOptions? google,
        gentype.VerifyPurchaseHorizonOptions? horizon,
      }) async {
        if (!_platform.isIOS && !_platform.isMacOS) {
          throw errors.PurchaseError(
            code: errors.ErrorCode.IapNotAvailable,
            message: 'Receipt validation is only available on iOS/macOS',
          );
        }

        if (!_isInitialized) {
          throw errors.PurchaseError(
            code: errors.ErrorCode.NotPrepared,
            message: 'IAP connection not initialized',
          );
        }

        if (apple == null) {
          throw PurchaseError(
            code: gentype.ErrorCode.DeveloperError,
            message: 'Apple options required for iOS receipt validation',
          );
        }

        final skuTrimmed = apple.sku.trim();
        if (skuTrimmed.isEmpty) {
          throw PurchaseError(
            code: gentype.ErrorCode.DeveloperError,
            message: 'sku cannot be empty',
          );
        }

        try {
          final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
            'validateReceiptIOS',
            {
              'apple': {'sku': skuTrimmed},
            },
          );

          if (result == null) {
            throw PurchaseError(
              code: gentype.ErrorCode.ServiceError,
              message: 'No validation result received from native platform',
            );
          }

          final validationResult = result.map<String, dynamic>(
            (key, value) => MapEntry(key.toString(), value),
          );
          final latestTransactionMap = validationResult['latestTransaction'];
          final latestTransaction = latestTransactionMap is Map
              ? gentype.Purchase.fromJson(
                  latestTransactionMap.map<String, dynamic>(
                    (key, value) => MapEntry(key.toString(), value),
                  ),
                )
              : null;

          return gentype.VerifyPurchaseResultIOS(
            isValid: validationResult['isValid'] as bool? ?? false,
            jwsRepresentation:
                validationResult['jwsRepresentation']?.toString() ?? '',
            receiptData: validationResult['receiptData']?.toString() ?? '',
            latestTransaction: latestTransaction,
          );
        } on PlatformException catch (error) {
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message:
                'Failed to validate receipt [${error.code}]: ${error.message ?? error.details}',
          );
        } catch (error) {
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to validate receipt: ${error.toString()}',
          );
        }
      };

  /// Deprecated. Use verifyPurchase instead — same input/output shape.
  ///
  /// See: https://www.openiap.dev/docs/apis/validate-receipt
  gentype.MutationValidateReceiptHandler get validateReceipt => ({
        gentype.VerifyPurchaseAppleOptions? apple,
        gentype.VerifyPurchaseGoogleOptions? google,
        gentype.VerifyPurchaseHorizonOptions? horizon,
      }) async {
        if (_platform.isIOS || _platform.isMacOS) {
          if (apple == null) {
            throw PurchaseError(
              code: gentype.ErrorCode.DeveloperError,
              message:
                  'Apple options required for iOS/macOS receipt validation',
            );
          }
          return await validateReceiptIOS(apple: apple);
        }
        if (_platform.isAndroid) {
          throw PurchaseError(
            code: gentype.ErrorCode.IapNotAvailable,
            message: 'Android receipt validation is not supported',
          );
        }
        throw PurchaseError(
          code: gentype.ErrorCode.IapNotAvailable,
          message: 'Platform not supported for receipt validation',
        );
      };

  /// Verify via a managed provider (currently IAPKit; the PurchaseVerificationProvider enum exposes only Iapkit today).
  ///
  /// See: https://www.openiap.dev/docs/features/validation#verify-purchase-with-provider
  gentype.MutationVerifyPurchaseWithProviderHandler
      get verifyPurchaseWithProvider => ({
            required gentype.PurchaseVerificationProvider provider,
            gentype.RequestVerifyPurchaseWithIapkitProps? iapkit,
          }) async {
            if (!_isInitialized) {
              throw PurchaseError(
                code: gentype.ErrorCode.NotPrepared,
                message: 'IAP connection not initialized',
              );
            }

            try {
              final Map<String, dynamic> args = {'provider': provider.value};

              if (iapkit != null) {
                args['iapkit'] = {
                  if (iapkit.apiKey != null) 'apiKey': iapkit.apiKey,
                  if (iapkit.apple != null) 'apple': {'jws': iapkit.apple!.jws},
                  if (iapkit.google != null)
                    'google': {'purchaseToken': iapkit.google!.purchaseToken},
                };
              }

              final result = await _channel.invokeMethod<dynamic>(
                'verifyPurchaseWithProvider',
                args,
              );

              if (result == null) {
                throw PurchaseError(
                  code: gentype.ErrorCode.PurchaseVerificationFailed,
                  message:
                      'No verification result received from native platform',
                );
              }

              // Parse result (can be Map or String)
              final Map<String, dynamic> resultMap;
              if (result is String) {
                resultMap = jsonDecode(result) as Map<String, dynamic>;
              } else if (result is Map) {
                resultMap = result.map<String, dynamic>(
                  (key, value) => MapEntry(key.toString(), value),
                );
              } else {
                throw PurchaseError(
                  code: gentype.ErrorCode.PurchaseVerificationFailed,
                  message: 'Unexpected result type: ${result.runtimeType}',
                );
              }

              // Parse iapkit result (single object, not array)
              gentype.RequestVerifyPurchaseWithIapkitResult? iapkitResult;
              final iapkitData = resultMap['iapkit'];
              if (iapkitData != null) {
                final itemMap = iapkitData is Map
                    ? iapkitData.map<String, dynamic>(
                        (k, v) => MapEntry(k.toString(), v),
                      )
                    : <String, dynamic>{};
                iapkitResult = gentype.RequestVerifyPurchaseWithIapkitResult(
                  isValid: itemMap['isValid'] as bool? ?? false,
                  state: gentype.IapkitPurchaseState.fromJson(
                    itemMap['state']?.toString() ?? 'unknown',
                  ),
                  store: gentype.IapStore.fromJson(
                    itemMap['store']?.toString() ?? 'apple',
                  ),
                );
              }

              // Parse errors if present
              final errorsData = resultMap['errors'] as List<dynamic>?;
              final errors = errorsData?.map((e) {
                final errorMap = e is Map
                    ? e.map<String, dynamic>(
                        (k, v) => MapEntry(k.toString(), v))
                    : <String, dynamic>{};
                return gentype.VerifyPurchaseWithProviderError(
                  code: errorMap['code'] as String?,
                  message: errorMap['message'] as String? ?? '',
                );
              }).toList();

              return gentype.VerifyPurchaseWithProviderResult(
                iapkit: iapkitResult,
                errors: errors,
                provider: gentype.PurchaseVerificationProvider.fromJson(
                  resultMap['provider']?.toString() ?? 'iapkit',
                ),
              );
            } on PlatformException catch (error) {
              throw PurchaseError(
                code: gentype.ErrorCode.PurchaseVerificationFailed,
                message:
                    'Failed to verify purchase [${error.code}]: ${error.message ?? error.details}',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.PurchaseVerificationFailed,
                message: 'Failed to verify purchase: ${error.toString()}',
              );
            }
          };

  /// Verify a purchase against your own backend (returns isValid + raw store metadata).
  ///
  /// See: https://www.openiap.dev/docs/features/validation#verify-purchase
  gentype.MutationVerifyPurchaseHandler get verifyPurchase => ({
        gentype.VerifyPurchaseAppleOptions? apple,
        gentype.VerifyPurchaseGoogleOptions? google,
        gentype.VerifyPurchaseHorizonOptions? horizon,
      }) async {
        if (!_isInitialized) {
          throw PurchaseError(
            code: gentype.ErrorCode.NotPrepared,
            message: 'IAP connection not initialized',
          );
        }

        try {
          final Map<String, dynamic> args = {};

          if (apple != null) {
            args['apple'] = apple.toJson();
          }
          if (google != null) {
            args['google'] = google.toJson();
          }
          if (horizon != null) {
            args['horizon'] = horizon.toJson();
          }

          final result = await _channel.invokeMethod<dynamic>(
            'verifyPurchase',
            args,
          );

          if (result == null) {
            throw PurchaseError(
              code: gentype.ErrorCode.PurchaseVerificationFailed,
              message: 'No verification result received from native platform',
            );
          }

          final Map<String, dynamic> resultMap;
          if (result is String) {
            resultMap = jsonDecode(result) as Map<String, dynamic>;
          } else if (result is Map) {
            resultMap = result.map<String, dynamic>(
              (k, v) => MapEntry(k.toString(), v),
            );
          } else {
            throw PurchaseError(
              code: gentype.ErrorCode.PurchaseVerificationFailed,
              message: 'Unexpected result type: ${result.runtimeType}',
            );
          }

          return gentype.VerifyPurchaseResult.fromJson(resultMap);
        } on PlatformException catch (error) {
          throw PurchaseError(
            code: gentype.ErrorCode.PurchaseVerificationFailed,
            message:
                'Failed to verify purchase [${error.code}]: ${error.message ?? error.details}',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.PurchaseVerificationFailed,
            message: 'Failed to verify purchase: ${error.toString()}',
          );
        }
      };

  // flutter IAP compatible methods

  /// Internal implementation for fetching products
  Future<List<gentype.ProductCommon>> _fetchProductsInternal({
    required List<String> skus,
    required gentype.ProductQueryType queryType,
  }) async {
    if (!_isInitialized) {
      throw PurchaseError(
        code: gentype.ErrorCode.NotPrepared,
        message: 'IAP connection not initialized',
      );
    }

    try {
      final resolvedType = resolveProductType(queryType);
      debugPrint(
        '[flutter_inapp_purchase] fetchProducts called with skus: $skus, type: $resolvedType',
      );

      final List<dynamic> merged = [];
      final raw = await _channel.invokeMethod('fetchProducts', {
        'skus': skus,
        'type': resolvedType,
      });

      if (raw is String) {
        merged.addAll(jsonDecode(raw) as List<dynamic>? ?? []);
      } else if (raw is List) {
        merged.addAll(raw);
      }

      debugPrint(
        '[flutter_inapp_purchase] Received ${merged.length} items from native',
      );

      final products = <gentype.ProductCommon>[];

      for (final item in merged) {
        try {
          final Map<String, dynamic> itemMap;
          if (item is Map) {
            final normalized = normalizeDynamicMap(item);
            if (normalized == null) {
              debugPrint(
                '[flutter_inapp_purchase] Skipping product with null map after normalization: ${item.runtimeType}',
              );
              continue;
            }
            itemMap = normalized;
          } else {
            debugPrint(
              '[flutter_inapp_purchase] Skipping unexpected item type: ${item.runtimeType}',
            );
            continue;
          }

          final detectedType = resolvedType == 'all'
              ? (itemMap['type']?.toString() ?? 'in-app')
              : resolvedType;
          final parsed = parseProductFromNative(
            itemMap,
            detectedType,
            fallbackIsIOS: _platform.isIOS || _platform.isMacOS,
          );

          products.add(parsed);
        } catch (error) {
          debugPrint(
            '[flutter_inapp_purchase] Skipping product due to parse error: $error',
          );
          debugPrint(
            '[flutter_inapp_purchase] Item runtimeType: ${item.runtimeType}',
          );
          debugPrint(
            '[flutter_inapp_purchase] Item values: ${jsonEncode(item)}',
          );
        }
      }

      debugPrint(
        '[flutter_inapp_purchase] Processed ${products.length} products',
      );

      // Return list directly based on query type
      if (queryType == gentype.ProductQueryType.All) {
        // For 'All' type, return all products
        debugPrint(
          '[flutter_inapp_purchase] Type All: returning ${products.length} total products',
        );
        return products;
      } else if (queryType == gentype.ProductQueryType.Subs) {
        // For subscription queries, return only subscriptions
        final subscriptions = products
            .whereType<gentype.ProductSubscription>()
            .toList(growable: false);
        debugPrint(
          '[flutter_inapp_purchase] Type Subs: returning ${subscriptions.length} subscriptions',
        );
        return subscriptions;
      } else {
        // Default to in-app products
        final inApps = products.whereType<gentype.Product>().toList(
              growable: false,
            );
        debugPrint(
          '[flutter_inapp_purchase] Type InApp: returning ${inApps.length} products',
        );
        return inApps;
      }
    } on PlatformException catch (error) {
      throw _purchaseErrorFromPlatformException(
        error,
        'fetch products',
      );
    } catch (error) {
      if (error is PurchaseError) rethrow;
      throw PurchaseError(
        code: gentype.ErrorCode.ServiceError,
        message: 'Failed to fetch products: ${error.toString()}',
      );
    }
  }

  /// Retrieve products or subscriptions from the store by SKU.
  ///
  /// Parameters:
  /// - `skus` (required): list of product identifiers to fetch.
  /// - `type`: `ProductQueryType.InApp`, `Subs`, or `All`. Defaults to `InApp`.
  ///
  /// Returns a `List<T>` cast to the generic type — pass `<Product>` for one-time
  /// items, `<ProductSubscription>` for subs, or `<ProductCommon>` for mixed `All`
  /// queries.
  /// Throws when the store rejects the request.
  ///
  /// ```dart
  /// final products = await FlutterInappPurchase.instance.fetchProducts<Product>(
  ///   skus: ['com.app.premium'],
  ///   type: ProductQueryType.InApp,
  /// );
  /// for (final product in products) {
  ///   print('${product.title}: ${product.displayPrice}');
  /// }
  /// ```
  ///
  /// **Note:** This is a regular promise-based call. Don't confuse with `request*`
  /// APIs (e.g. `requestPurchase`), which are event-based.
  ///
  /// See: https://www.openiap.dev/docs/apis/fetch-products
  Future<List<T>> fetchProducts<T extends gentype.ProductCommon>({
    required List<String> skus,
    gentype.ProductQueryType type = gentype.ProductQueryType.InApp,
  }) async {
    final result = await _fetchProductsInternal(skus: skus, queryType: type);
    return result.cast<T>();
  }

  // MARK: - StoreKit 2 specific methods

  /// Restore non-consumable and active subscription purchases.
  ///
  /// See: https://www.openiap.dev/docs/apis/restore-purchases
  gentype.MutationRestorePurchasesHandler get restorePurchases => () async {
        try {
          if (_platform.isIOS || _platform.isMacOS) {
            try {
              await syncIOS();
            } catch (error) {
              // Soft-fail on sync error; apps can handle via logs
              debugPrint(
                '[flutter_inapp_purchase] Error restoring purchases (iOS sync): $error',
              );
            }
          }
          // Fetch available purchases using the public API
          await getAvailablePurchases();
        } catch (error) {
          debugPrint(
            '[flutter_inapp_purchase] Failed to restore purchases: $error',
          );
        }
      };

  /// Convert a PlatformException to a PurchaseError with proper error code
  PurchaseError _purchaseErrorFromPlatformException(
    PlatformException error,
    String operation,
  ) {
    final platform = _platform.isIOS || _platform.isMacOS
        ? gentype.IapPlatform.IOS
        : gentype.IapPlatform.Android;
    final errorCode = errors.ErrorCodeUtils.fromPlatformCode(
      error.code,
      platform,
    );
    return PurchaseError(
      code: errorCode,
      platform: platform,
      message: 'Failed to $operation [${error.code}]: '
          '${error.message ?? error.details}',
    );
  }

  /// Recursively convert platform channel Map/List to proper Dart types
  dynamic _deepConvertMap(dynamic value) {
    if (value is Map) {
      final Map<String, dynamic> result = {};
      value.forEach((key, val) {
        result[key.toString()] = _deepConvertMap(val);
      });
      return result;
    } else if (value is List) {
      return value.map((item) => _deepConvertMap(item)).toList();
    } else {
      return value;
    }
  }

  /// Parse active subscriptions from native method result
  List<gentype.ActiveSubscription> _parseActiveSubscriptions(dynamic result) {
    List<dynamic> list;
    if (result is String) {
      list = json.decode(result) as List<dynamic>;
    } else if (result is List) {
      list = result;
    } else if (result is Map) {
      // Some platforms/libs may return a single map; normalize to list
      list = [result];
    } else {
      try {
        list = json.decode(result.toString()) as List<dynamic>;
      } catch (_) {
        debugPrint(
          '[flutter_inapp_purchase] Unexpected getActiveSubscriptions result type: ${result.runtimeType}',
        );
        list = const <dynamic>[];
      }
    }

    final subscriptions = <gentype.ActiveSubscription>[];
    for (final dynamic item in list) {
      try {
        if (item is! Map) {
          debugPrint(
            '[flutter_inapp_purchase] Skipping subscription with unexpected type: ${item.runtimeType}',
          );
          continue;
        }
        // Recursively convert map to Map<String, dynamic>
        final map = _deepConvertMap(item) as Map<String, dynamic>;
        subscriptions.add(gentype.ActiveSubscription.fromJson(map));
      } catch (error) {
        debugPrint(
          '[flutter_inapp_purchase] Skipping subscription due to parse error: $error',
        );
      }
    }

    return subscriptions;
  }

  /// Get details of all currently active subscriptions.
  ///
  /// See: https://www.openiap.dev/docs/apis/get-active-subscriptions
  gentype.QueryGetActiveSubscriptionsHandler get getActiveSubscriptions =>
      ([subscriptionIds]) async {
        if (!_isInitialized) {
          throw PurchaseError(
            code: gentype.ErrorCode.NotPrepared,
            message: 'IAP connection not initialized',
          );
        }

        try {
          // Use native getActiveSubscriptions for both iOS and Android
          // This ensures we get complete ActiveSubscription objects including:
          // - renewalInfoIOS on iOS (with upgrade/downgrade/cancellation status)
          // - autoRenewingAndroid on Android
          final result = await _channel.invokeMethod(
            'getActiveSubscriptions',
            subscriptionIds,
          );

          if (result == null) {
            return <gentype.ActiveSubscription>[];
          }

          return _parseActiveSubscriptions(result);
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'get active subscriptions',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to get active subscriptions: '
                '${error.toString()}',
          );
        }
      };

  /// Check whether the user has any active subscription.
  ///
  /// See: https://www.openiap.dev/docs/apis/has-active-subscriptions
  gentype.QueryHasActiveSubscriptionsHandler get hasActiveSubscriptions =>
      ([subscriptionIds]) async {
        try {
          final activeSubscriptions = await getActiveSubscriptions(
            subscriptionIds,
          );
          // For Android, also call native with explicit type for parity/logging
          if (_platform.isAndroid) {
            try {
              await _channel.invokeMethod(
                'getAvailableItems',
                <String, dynamic>{'type': TypeInApp.subs.name},
              );
            } catch (_) {
              // Ignore; this is for logging/compatibility only
            }
          }
          return activeSubscriptions.isNotEmpty;
        } catch (error) {
          // If there's an error getting subscriptions, return false
          debugPrint('Error checking active subscriptions: $error');
          return false;
        }
      };

  // MARK: - Alternative Billing APIs

  /// Check whether alternative billing is available for the user.
  ///
  /// See: https://www.openiap.dev/docs/apis/android/check-alternative-billing-availability-android
  gentype.MutationCheckAlternativeBillingAvailabilityAndroidHandler
      get checkAlternativeBillingAvailabilityAndroid => () async {
            if (!_platform.isAndroid) {
              return false;
            }
            try {
              final result = await _channel.invokeMethod<bool>(
                'checkAlternativeBillingAvailabilityAndroid',
              );
              return result ?? false;
            } catch (error) {
              debugPrint(
                  'checkAlternativeBillingAvailabilityAndroid error: $error');
              return false;
            }
          };

  /// Display Google's alternative billing information dialog.
  ///
  /// See: https://www.openiap.dev/docs/apis/android/show-alternative-billing-dialog-android
  gentype.MutationShowAlternativeBillingDialogAndroidHandler
      get showAlternativeBillingDialogAndroid => () async {
            if (!_platform.isAndroid) {
              return false;
            }
            try {
              final result = await _channel.invokeMethod<bool>(
                'showAlternativeBillingDialogAndroid',
              );
              return result ?? false;
            } catch (error) {
              debugPrint('showAlternativeBillingDialogAndroid error: $error');
              return false;
            }
          };

  /// Create a reporting token for an alternative billing flow.
  ///
  /// See: https://www.openiap.dev/docs/apis/android/create-alternative-billing-token-android
  gentype.MutationCreateAlternativeBillingTokenAndroidHandler
      get createAlternativeBillingTokenAndroid => () async {
            if (!_platform.isAndroid) {
              return null;
            }
            try {
              final result = await _channel.invokeMethod<String>(
                'createAlternativeBillingTokenAndroid',
              );
              return result;
            } catch (error) {
              debugPrint('createAlternativeBillingTokenAndroid error: $error');
              return null;
            }
          };

  // MARK: - Billing Programs API (Android 8.2.0+)

  /// Check whether a billing program (e.g., External Payments) is available.
  ///
  /// See: https://www.openiap.dev/docs/apis/android/is-billing-program-available-android
  Future<gentype.BillingProgramAvailabilityResultAndroid>
      isBillingProgramAvailableAndroid(
    gentype.BillingProgramAndroid program,
  ) async {
    if (!_platform.isAndroid) {
      return gentype.BillingProgramAvailabilityResultAndroid(
        billingProgram: program,
        isAvailable: false,
      );
    }
    try {
      final result = await _channel.invokeMethod<String>(
        'isBillingProgramAvailableAndroid',
        {'program': program.toJson()},
      );
      if (result != null) {
        final json = jsonDecode(result) as Map<String, dynamic>;
        return gentype.BillingProgramAvailabilityResultAndroid.fromJson(json);
      }
      return gentype.BillingProgramAvailabilityResultAndroid(
        billingProgram: program,
        isAvailable: false,
      );
    } catch (error) {
      debugPrint('isBillingProgramAvailableAndroid error: $error');
      return gentype.BillingProgramAvailabilityResultAndroid(
        billingProgram: program,
        isAvailable: false,
      );
    }
  }

  /// Create the reporting payload Google requires after a Developer-Provided Billing transaction (Play Billing 8.3.0+).
  ///
  /// See: https://www.openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
  Future<gentype.BillingProgramReportingDetailsAndroid>
      createBillingProgramReportingDetailsAndroid(
    gentype.BillingProgramAndroid program,
  ) async {
    if (!_platform.isAndroid) {
      throw PurchaseError(
        code: gentype.ErrorCode.IapNotAvailable,
        message:
            'createBillingProgramReportingDetailsAndroid only available on Android',
      );
    }
    try {
      final result = await _channel.invokeMethod<String>(
        'createBillingProgramReportingDetailsAndroid',
        {'program': program.toJson()},
      );
      if (result != null) {
        final json = jsonDecode(result) as Map<String, dynamic>;
        return gentype.BillingProgramReportingDetailsAndroid.fromJson(json);
      }
      throw PurchaseError(
        code: gentype.ErrorCode.Unknown,
        message: 'Failed to create billing program reporting details',
      );
    } catch (error) {
      debugPrint('createBillingProgramReportingDetailsAndroid error: $error');
      rethrow;
    }
  }

  /// Launch an external content/offer link from inside the Billing Programs flow (Play Billing 8.2.0+).
  ///
  /// See: https://www.openiap.dev/docs/apis/android/launch-external-link-android
  Future<bool> launchExternalLinkAndroid(
    gentype.LaunchExternalLinkParamsAndroid params,
  ) async {
    if (!_platform.isAndroid) {
      throw PurchaseError(
        code: gentype.ErrorCode.IapNotAvailable,
        message: 'launchExternalLinkAndroid only available on Android',
      );
    }
    try {
      final result =
          await _channel.invokeMethod<bool>('launchExternalLinkAndroid', {
        'billingProgram': params.billingProgram.toJson(),
        'launchMode': params.launchMode.toJson(),
        'linkType': params.linkType.toJson(),
        'linkUri': params.linkUri,
      });
      return result ?? false;
    } catch (error) {
      debugPrint('launchExternalLinkAndroid error: $error');
      rethrow;
    }
  }

  /// Present the external purchase notice sheet (iOS 17.4+).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
  gentype.MutationPresentExternalPurchaseNoticeSheetIOSHandler
      get presentExternalPurchaseNoticeSheetIOS => () async {
            if (!_platform.isIOS || _platform.isMacOS) {
              return const gentype.ExternalPurchaseNoticeResultIOS(
                result: gentype.ExternalPurchaseNoticeAction.Dismissed,
              );
            }
            try {
              final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
                'presentExternalPurchaseNoticeSheetIOS',
              );
              if (result != null) {
                return gentype.ExternalPurchaseNoticeResultIOS.fromJson(
                  Map<String, dynamic>.from(result),
                );
              }
              return const gentype.ExternalPurchaseNoticeResultIOS(
                result: gentype.ExternalPurchaseNoticeAction.Dismissed,
              );
            } catch (error) {
              debugPrint('presentExternalPurchaseNoticeSheetIOS error: $error');
              return gentype.ExternalPurchaseNoticeResultIOS(
                result: gentype.ExternalPurchaseNoticeAction.Dismissed,
                error: error.toString(),
              );
            }
          };

  /// Present an external purchase link, StoreKit External (iOS 16+).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/present-external-purchase-link-ios
  gentype.MutationPresentExternalPurchaseLinkIOSHandler
      get presentExternalPurchaseLinkIOS => (String url) async {
            if (!_platform.isIOS || _platform.isMacOS) {
              return const gentype.ExternalPurchaseLinkResultIOS(
                  success: false);
            }
            try {
              final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
                'presentExternalPurchaseLinkIOS',
                url,
              );
              if (result != null) {
                return gentype.ExternalPurchaseLinkResultIOS.fromJson(
                  Map<String, dynamic>.from(result),
                );
              }
              return const gentype.ExternalPurchaseLinkResultIOS(
                  success: false);
            } catch (error) {
              debugPrint('presentExternalPurchaseLinkIOS error: $error');
              return gentype.ExternalPurchaseLinkResultIOS(
                success: false,
                error: error.toString(),
              );
            }
          };

  // MARK: - ExternalPurchaseCustomLink (iOS 18.1+)

  /// Check eligibility for the custom-link variant of external purchase (iOS 18.1+).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
  gentype.QueryIsEligibleForExternalPurchaseCustomLinkIOSHandler
      get isEligibleForExternalPurchaseCustomLinkIOS => () async {
            if (!_platform.isIOS && !_platform.isMacOS) {
              return false;
            }
            try {
              final result = await _channel.invokeMethod<bool>(
                'isEligibleForExternalPurchaseCustomLinkIOS',
              );
              return result ?? false;
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'check eligibility for ExternalPurchaseCustomLink',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message: 'Failed to check eligibility for '
                    'ExternalPurchaseCustomLink: $error',
              );
            }
          };

  /// Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
  gentype.QueryGetExternalPurchaseCustomLinkTokenIOSHandler
      get getExternalPurchaseCustomLinkTokenIOS =>
          (gentype.ExternalPurchaseCustomLinkTokenTypeIOS tokenType) async {
            if (!_platform.isIOS && !_platform.isMacOS) {
              return const gentype.ExternalPurchaseCustomLinkTokenResultIOS(
                error:
                    'ExternalPurchaseCustomLink is only available on iOS/macOS',
              );
            }
            try {
              final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
                'getExternalPurchaseCustomLinkTokenIOS',
                {'tokenType': tokenType.value},
              );
              if (result != null) {
                return gentype.ExternalPurchaseCustomLinkTokenResultIOS
                    .fromJson(
                  Map<String, dynamic>.from(result),
                );
              }
              return const gentype.ExternalPurchaseCustomLinkTokenResultIOS(
                error: 'Failed to get token',
              );
            } catch (error) {
              debugPrint('getExternalPurchaseCustomLinkTokenIOS error: $error');
              return gentype.ExternalPurchaseCustomLinkTokenResultIOS(
                error: error.toString(),
              );
            }
          };

  /// Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).
  ///
  /// See: https://www.openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
  gentype.MutationShowExternalPurchaseCustomLinkNoticeIOSHandler
      get showExternalPurchaseCustomLinkNoticeIOS =>
          (gentype.ExternalPurchaseCustomLinkNoticeTypeIOS noticeType) async {
            if (!_platform.isIOS && !_platform.isMacOS) {
              return const gentype.ExternalPurchaseCustomLinkNoticeResultIOS(
                continued: false,
                error:
                    'ExternalPurchaseCustomLink is only available on iOS/macOS',
              );
            }
            try {
              final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
                'showExternalPurchaseCustomLinkNoticeIOS',
                {'noticeType': noticeType.value},
              );
              if (result != null) {
                return gentype.ExternalPurchaseCustomLinkNoticeResultIOS
                    .fromJson(
                  Map<String, dynamic>.from(result),
                );
              }
              return const gentype.ExternalPurchaseCustomLinkNoticeResultIOS(
                continued: false,
              );
            } catch (error) {
              debugPrint(
                  'showExternalPurchaseCustomLinkNoticeIOS error: $error');
              return gentype.ExternalPurchaseCustomLinkNoticeResultIOS(
                continued: false,
                error: error.toString(),
              );
            }
          };

  // Internal wrapper for queryHandlers compatibility
  gentype.QueryFetchProductsHandler get _fetchProductsHandler =>
      ({required List<String> skus, gentype.ProductQueryType? type}) async {
        final queryType = type ?? gentype.ProductQueryType.InApp;
        final products = await _fetchProductsInternal(
          skus: skus,
          queryType: queryType,
        );

        // Wrap list in appropriate union type for OpenIAP compatibility
        if (queryType == gentype.ProductQueryType.Subs) {
          return gentype.FetchProductsResultSubscriptions(
            products.whereType<gentype.ProductSubscription>().toList(),
          );
        } else {
          return gentype.FetchProductsResultProducts(
            products.whereType<gentype.Product>().toList(),
          );
        }
      };

  gentype.QueryHandlers get queryHandlers => gentype.QueryHandlers(
        canPresentExternalPurchaseNoticeIOS:
            canPresentExternalPurchaseNoticeIOS,
        currentEntitlementIOS: currentEntitlementIOS,
        fetchProducts: _fetchProductsHandler,
        getActiveSubscriptions: getActiveSubscriptions,
        getAppTransactionIOS: getAppTransactionIOS,
        getAvailablePurchases: getAvailablePurchases,
        getExternalPurchaseCustomLinkTokenIOS:
            getExternalPurchaseCustomLinkTokenIOS,
        getAllTransactionsIOS: getAllTransactionsIOS,
        getPendingTransactionsIOS: getPendingTransactionsIOS,
        getPromotedProductIOS: getPromotedProductIOS,
        getReceiptDataIOS: getReceiptDataIOS,
        getStorefront: getStorefront,
        getStorefrontIOS: getStorefrontIOS,
        getTransactionJwsIOS: getTransactionJwsIOS,
        hasActiveSubscriptions: hasActiveSubscriptions,
        isEligibleForExternalPurchaseCustomLinkIOS:
            isEligibleForExternalPurchaseCustomLinkIOS,
        isEligibleForIntroOfferIOS: isEligibleForIntroOfferIOS,
        isTransactionVerifiedIOS: isTransactionVerifiedIOS,
        latestTransactionIOS: latestTransactionIOS,
        subscriptionStatusIOS: subscriptionStatusIOS,
        validateReceiptIOS: validateReceiptIOS,
      );

  gentype.MutationLaunchExternalLinkAndroidHandler
      get _launchExternalLinkAndroidHandler => ({
            required gentype.BillingProgramAndroid billingProgram,
            required gentype.ExternalLinkLaunchModeAndroid launchMode,
            required gentype.ExternalLinkTypeAndroid linkType,
            required String linkUri,
          }) =>
              launchExternalLinkAndroid(
                gentype.LaunchExternalLinkParamsAndroid(
                  billingProgram: billingProgram,
                  launchMode: launchMode,
                  linkType: linkType,
                  linkUri: linkUri,
                ),
              );

  // ignore: deprecated_member_use_from_same_package
  gentype.MutationHandlers get mutationHandlers => gentype.MutationHandlers(
        acknowledgePurchaseAndroid: acknowledgePurchaseAndroid,
        beginRefundRequestIOS: beginRefundRequestIOS,
        consumePurchaseAndroid: consumePurchaseAndroid,
        createBillingProgramReportingDetailsAndroid:
            createBillingProgramReportingDetailsAndroid,
        deepLinkToSubscriptions: deepLinkToSubscriptions,
        endConnection: endConnection,
        finishTransaction: finishTransaction,
        initConnection: initConnection,
        isBillingProgramAvailableAndroid: isBillingProgramAvailableAndroid,
        launchExternalLinkAndroid: _launchExternalLinkAndroidHandler,
        presentCodeRedemptionSheetIOS: presentCodeRedemptionSheetIOS,
        requestPurchase: requestPurchase,
        requestPurchaseOnPromotedProductIOS:
            // ignore: deprecated_member_use_from_same_package
            requestPurchaseOnPromotedProductIOS,
        restorePurchases: restorePurchases,
        showManageSubscriptionsIOS: showManageSubscriptionsIOS,
        syncIOS: syncIOS,
        validateReceipt: validateReceipt,
        verifyPurchase: verifyPurchase,
        clearTransactionIOS: clearTransactionIOS,
        // Alternative Billing APIs
        checkAlternativeBillingAvailabilityAndroid:
            checkAlternativeBillingAvailabilityAndroid,
        showAlternativeBillingDialogAndroid:
            showAlternativeBillingDialogAndroid,
        createAlternativeBillingTokenAndroid:
            createAlternativeBillingTokenAndroid,
        presentExternalPurchaseNoticeSheetIOS:
            presentExternalPurchaseNoticeSheetIOS,
        presentExternalPurchaseLinkIOS: presentExternalPurchaseLinkIOS,
        showExternalPurchaseCustomLinkNoticeIOS:
            showExternalPurchaseCustomLinkNoticeIOS,
        verifyPurchaseWithProvider: verifyPurchaseWithProvider,
      );

  gentype.SubscriptionHandlers get subscriptionHandlers =>
      gentype.SubscriptionHandlers(
        promotedProductIOS: () async {
          final value = await purchasePromoted.firstWhere(
            (element) => element != null,
          );
          return value ?? '';
        },
        purchaseError: () async =>
            await purchaseErrorListener.first as gentype.PurchaseError,
        purchaseUpdated: () async => await purchaseUpdatedListener.first,
        subscriptionBillingIssue: () async =>
            await subscriptionBillingIssueListener.first,
        userChoiceBillingAndroid: () async =>
            await _userChoiceBillingAndroidListener.stream.first,
        developerProvidedBillingAndroid: () async =>
            await _developerProvidedBillingAndroidListener.stream.first,
      );
}
