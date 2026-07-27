import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:platform/platform.dart';

import 'types.dart' as gentype;
import 'builders.dart';
import 'helpers.dart';
import 'utils.dart';
import 'errors.dart' as errors;

export 'types.dart' hide PurchaseError;
export 'builders.dart';
export 'utils.dart';
export 'helpers.dart';
export 'extensions/purchase_helpers.dart';
export 'enums.dart' hide IapPlatform, PurchaseState;
export 'errors.dart'
    show
        getCurrentPlatform,
        PurchaseError,
        ErrorCodeUtils,
        getUserFriendlyErrorMessage;

typedef PurchaseError = errors.PurchaseError;
typedef SubscriptionOfferAndroid = gentype.AndroidSubscriptionOfferInput;

class _PurchaseUpdatedDedupeHistoryIOS {
  static const int limit = 512;

  final Set<String> ids;
  final Queue<String> order;

  _PurchaseUpdatedDedupeHistoryIOS()
      : ids = <String>{},
        order = Queue<String>();

  _PurchaseUpdatedDedupeHistoryIOS.copy(
    _PurchaseUpdatedDedupeHistoryIOS source,
  )   : ids = Set<String>.of(source.ids),
        order = Queue<String>.of(source.order);

  bool contains(String id) => ids.contains(id);

  void record(String id) {
    if (!ids.add(id)) return;
    order.addLast(id);
    if (order.length > limit) {
      ids.remove(order.removeFirst());
    }
  }

  void clear() {
    ids.clear();
    order.clear();
  }
}

class FlutterInappPurchase with RequestPurchaseBuilderApi {
  // Singleton instance
  static FlutterInappPurchase? _instance;

  /// Get the singleton instance
  static FlutterInappPurchase get instance {
    _instance ??= FlutterInappPurchase();
    return _instance!;
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
  final _purchaseUpdatedDedupeHistoryIOS = _PurchaseUpdatedDedupeHistoryIOS();
  int _purchaseUpdatedDedupeGenerationIOS = 0;
  int _nonDedupingPurchaseUpdatedListenerCountIOS = 0;

  /// Purchase updated event stream
  Stream<gentype.Purchase> get purchaseUpdatedListener => isIOS
      ? _purchaseUpdatedListenerStreamIOS(dedupeTransactionIOS: true)
      : _purchaseUpdatedListener.stream;

  /// Purchase updated event stream with listener options.
  ///
  /// On iOS, set [PurchaseUpdatedListenerOptions.dedupeTransactionIOS]
  /// to false to also receive StoreKit replay events for transaction IDs
  /// already delivered during the current connection session. Android ignores
  /// this flag. On iOS this configures shared native listener state for this
  /// plugin instance; default streams still filter replayed IDs unless they
  /// opt out with `dedupeTransactionIOS: false`.
  Stream<gentype.Purchase> purchaseUpdatedListenerWithOptions(
    gentype.PurchaseUpdatedListenerOptions? options,
  ) {
    if (!isIOS) {
      return purchaseUpdatedListener;
    }

    final dedupeTransactionIOS = options?.dedupeTransactionIOS != false;
    StreamSubscription<gentype.Purchase>? subscription;
    late StreamController<gentype.Purchase> controller;
    var retainedNonDedupingListener = false;
    controller = StreamController<gentype.Purchase>.broadcast(
      onListen: () async {
        try {
          if (dedupeTransactionIOS) {
            await _setDedupingPurchaseUpdatedListenerOptionsIOS(options);
          } else {
            retainedNonDedupingListener = true;
            await _retainNonDedupingPurchaseUpdatedListenerIOS();
          }
          if (!controller.hasListener) return;
          subscription = _purchaseUpdatedListenerStreamIOS(
            dedupeTransactionIOS: dedupeTransactionIOS,
          ).listen(
            controller.add,
            onError: controller.addError,
            onDone: controller.close,
          );
        } catch (error, stackTrace) {
          controller.addError(error, stackTrace);
        }
      },
      onCancel: () async {
        final activeSubscription = subscription;
        subscription = null;
        try {
          await activeSubscription?.cancel();
        } finally {
          if (retainedNonDedupingListener) {
            retainedNonDedupingListener = false;
            await _releaseNonDedupingPurchaseUpdatedListenerIOS();
          }
        }
      },
    );
    return controller.stream;
  }

  Stream<gentype.Purchase> _purchaseUpdatedListenerStreamIOS({
    required bool dedupeTransactionIOS,
  }) {
    return Stream<gentype.Purchase>.multi((controller) {
      final listenerHistory = _PurchaseUpdatedDedupeHistoryIOS.copy(
        _purchaseUpdatedDedupeHistoryIOS,
      );
      var listenerGeneration = _purchaseUpdatedDedupeGenerationIOS;
      late StreamSubscription<gentype.Purchase> subscription;
      subscription = _purchaseUpdatedListener.stream.listen(
        (purchase) {
          if (listenerGeneration != _purchaseUpdatedDedupeGenerationIOS) {
            listenerHistory.clear();
            listenerGeneration = _purchaseUpdatedDedupeGenerationIOS;
          }

          final transactionId = _purchaseUpdatedTransactionIdIOS(purchase);
          if (transactionId != null) {
            final isDuplicateForListener =
                listenerHistory.contains(transactionId);
            listenerHistory.record(transactionId);
            _purchaseUpdatedDedupeHistoryIOS.record(transactionId);
            if (dedupeTransactionIOS && isDuplicateForListener) {
              return;
            }
          }

          controller.add(purchase);
        },
        onError: controller.addError,
        onDone: controller.close,
      );
      controller.onCancel = () => subscription.cancel();
    }, isBroadcast: true);
  }

  String? _purchaseUpdatedTransactionIdIOS(gentype.Purchase purchase) {
    final id = purchase.id;
    return id.isEmpty ? null : id;
  }

  void _resetPurchaseUpdatedDedupeHistoryIOS() {
    _purchaseUpdatedDedupeHistoryIOS.clear();
    _purchaseUpdatedDedupeGenerationIOS += 1;
  }

  Future<void> _setPurchaseUpdatedListenerOptions(
    gentype.PurchaseUpdatedListenerOptions? options,
  ) =>
      _configurePurchaseListener(() async {
        await _setPurchaseListener();
        await _channel.invokeMethod<void>(
          'setPurchaseUpdatedListenerOptions',
          options?.toJson(),
        );
      });

  Future<void> _setDedupingPurchaseUpdatedListenerOptionsIOS(
    gentype.PurchaseUpdatedListenerOptions? options,
  ) async {
    if (_nonDedupingPurchaseUpdatedListenerCountIOS > 0) return;
    await _setPurchaseUpdatedListenerOptions(options);
  }

  Future<void> _retainNonDedupingPurchaseUpdatedListenerIOS() async {
    _nonDedupingPurchaseUpdatedListenerCountIOS += 1;
    if (_nonDedupingPurchaseUpdatedListenerCountIOS == 1) {
      await _setPurchaseUpdatedListenerOptions(
        const gentype.PurchaseUpdatedListenerOptions(
          dedupeTransactionIOS: false,
        ),
      );
    }
  }

  Future<void> _releaseNonDedupingPurchaseUpdatedListenerIOS() async {
    if (_nonDedupingPurchaseUpdatedListenerCountIOS == 0) return;
    _nonDedupingPurchaseUpdatedListenerCountIOS -= 1;
    if (_nonDedupingPurchaseUpdatedListenerCountIOS == 0) {
      await _setPurchaseUpdatedListenerOptions(
        const gentype.PurchaseUpdatedListenerOptions(
          dedupeTransactionIOS: true,
        ),
      );
    }
  }

  /// Purchase error event stream
  Stream<PurchaseError> get purchaseErrorListener =>
      _purchaseErrorListener.stream;

  /// User choice billing Android event stream
  Stream<gentype.UserChoiceBillingDetails> get userChoiceBillingAndroid =>
      _userChoiceBillingAndroidListener.stream;

  /// Developer provided billing Android event stream (8.3.0+).
  /// Fires for External Payments and Google-rendered Billing Choice selections.
  Stream<gentype.DeveloperProvidedBillingDetailsAndroid>
      get developerProvidedBillingAndroid =>
          _developerProvidedBillingAndroidListener.stream;

  /// Subscription billing-issue event stream (cross-platform).
  ///
  /// Emits when an active subscription needs user attention for a payment
  /// problem. Unifies StoreKit 2 `Message.Reason.billingIssue` (iOS / Mac Catalyst 16.4+, visionOS 1.0+) and
  /// Google Play Billing `Purchase.isSuspended` (Play Billing 8.1+). NOT
  /// emitted on the Meta Horizon flavor (Billing 7.0 compat lacks the signal).
  Stream<gentype.Purchase> get subscriptionBillingIssueListener =>
      _subscriptionBillingIssueListener.stream;

  bool _isInitialized = false;
  Future<void> _purchaseListenerConfiguration = Future<void>.value();

  Future<void> _configurePurchaseListener(
    Future<void> Function() configure,
  ) {
    final previous = _purchaseListenerConfiguration;
    final current = previous.catchError((Object _) {}).then((_) => configure());
    _purchaseListenerConfiguration = current.catchError((Object _) {});
    return current;
  }

  Future<void> _setPurchaseListener() async {
    _purchasePromotedController ??= StreamController.broadcast();

    _channel.setMethodCallHandler((MethodCall call) async {
      switch (call.method) {
        case 'purchase-updated':
          _handlePurchaseUpdatedCall(
            call,
            _purchaseUpdatedListener,
          );
          break;
        case 'purchase-error':
          debugPrint(
            '[flutter_inapp_purchase] Processing purchase-error event',
          );
          Map<String, dynamic> result =
              jsonDecode(call.arguments as String) as Map<String, dynamic>;
          final error = PurchaseError.fromPlatformError(
            result,
            _platform.isIOS || _platform.isMacOS
                ? gentype.IapPlatform.IOS
                : gentype.IapPlatform.Android,
          );
          debugPrint(
            '[flutter_inapp_purchase] Emitting error to purchaseErrorListener: $error',
          );
          _purchaseErrorListener.add(error);
          break;
        case 'connection-updated':
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

  void _handlePurchaseUpdatedCall(
    MethodCall call,
    StreamController<gentype.Purchase> controller,
  ) {
    try {
      final result =
          jsonDecode(call.arguments as String) as Map<String, dynamic>;

      final purchase = convertToPurchase(
        result,
        originalJson: result,
        platformIsAndroid: _platform.isAndroid,
        platformIsIOS: _platform.isIOS || _platform.isMacOS,
        acknowledgedAndroidPurchaseTokens: _acknowledgedAndroidPurchaseTokens,
      );

      controller.add(purchase);
    } catch (e, stackTrace) {
      debugPrint(
        '[flutter_inapp_purchase] ERROR in ${call.method}: $e',
      );
      debugPrint('[flutter_inapp_purchase] Stack trace: $stackTrace');
    }
  }

  /// Initialize the store connection. Must be called before any other IAP API.
  ///
  /// Parameters:
  /// - `enableBillingProgramAndroid`: Android-only — Play Billing 8.2.0+ billing program
  ///   (e.g. External Payments). iOS ignores this field.
  ///
  /// Returns `true` once the platform billing client is connected.
  /// Throws when the billing client fails to initialize.
  ///
  /// ```dart
  /// await FlutterInappPurchase.instance.initConnection();
  /// ```
  ///
  /// See: https://openiap.dev/docs/apis/init-connection
  gentype.MutationInitConnectionHandler get initConnection => ({
        gentype.BillingChoiceScreenTypeAndroid? billingChoiceScreenTypeAndroid,
        gentype.BillingProgramAndroid? enableBillingProgramAndroid,
      }) async {
        if (_isInitialized) {
          return true;
        }

        try {
          await _configurePurchaseListener(_setPurchaseListener);

          // Build config map for the selected billing program.
          Map<String, dynamic>? config;
          if (billingChoiceScreenTypeAndroid != null ||
              enableBillingProgramAndroid != null) {
            config = {};
            if (enableBillingProgramAndroid != null) {
              config['enableBillingProgramAndroid'] =
                  enableBillingProgramAndroid.toJson();
            }
            if (billingChoiceScreenTypeAndroid != null) {
              config['billingChoiceScreenTypeAndroid'] =
                  billingChoiceScreenTypeAndroid.toJson();
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
  /// See: https://openiap.dev/docs/apis/end-connection
  gentype.MutationEndConnectionHandler get endConnection => () async {
        if (!_isInitialized) {
          return false;
        }

        try {
          // For flutter IAP compatibility, call endConnection directly
          await _channel.invokeMethod('endConnection');

          _isInitialized = false;
          if (isIOS) {
            _resetPurchaseUpdatedDedupeHistoryIOS();
          }
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
  ///   RequestPurchaseProps.inApp((
  ///     apple: RequestPurchaseIosProps(sku: 'com.app.premium'),
  ///     google: RequestPurchaseAndroidProps(skus: ['com.app.premium']),
  ///   )),
  /// );
  /// ```
  ///
  /// **Warning:** Event-based. Subscribe to `purchaseUpdated` / `purchaseError` for
  /// the actual outcome.
  ///
  /// See: https://openiap.dev/docs/apis/request-purchase
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

            final iosData = requestData['apple'] as Map<String, dynamic>?;

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
            final androidData = requestData?['google'] as Map<String, dynamic>?;

            if (androidData == null) {
              throw PurchaseError(
                code: gentype.ErrorCode.DeveloperError,
                message: 'Missing Android purchase parameters',
              );
            }

            // Parse Android props based on type
            final androidProps = productType == gentype.ProductQueryType.InApp
                ? gentype.RequestPurchaseAndroidProps.fromJson(androidData)
                : gentype.RequestSubscriptionAndroidProps.fromJson(androidData);

            // Handle both RequestPurchaseAndroidProps and RequestSubscriptionAndroidProps
            final List<String> skus;
            final bool? isOfferPersonalized;
            final String? obfuscatedAccount;
            final String? obfuscatedProfile;
            final String? purchaseToken;
            final String? originalExternalTransactionId;
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
              originalExternalTransactionId = null;
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
              originalExternalTransactionId =
                  androidProps.originalExternalTransactionId;
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

            if (originalExternalTransactionId != null) {
              payload['originalExternalTransactionId'] =
                  originalExternalTransactionId;
            }

            // offerToken for one-time purchase discounts (Android 8.0+)
            if (offerToken != null) {
              payload['offerToken'] = offerToken;
            }

            if (subscriptionOffers != null && subscriptionOffers.isNotEmpty) {
              payload['subscriptionOffers'] =
                  subscriptionOffers.map((offer) => offer.toJson()).toList();
            }

            // Add developerBillingOption for External Payments (8.3.0+) or Billing Choice (9.1.0+)
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
  /// See: https://openiap.dev/docs/apis/get-available-purchases
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
  /// See: https://openiap.dev/docs/apis/get-storefront
  gentype.QueryGetStorefrontHandler get getStorefront => () async {
        if (!isIOS && !_platform.isAndroid) {
          throw PurchaseError(
            code: gentype.ErrorCode.IapNotAvailable,
            message: 'Storefront lookup is not supported on this platform',
          );
        }

        try {
          final String? storefront = await channel.invokeMethod<String>(
            'getStorefront',
          );
          if (storefront == null || storefront.trim().isEmpty) {
            throw PurchaseError(
              code: gentype.ErrorCode.ServiceError,
              message: 'Storefront lookup returned no country code',
            );
          }
          return storefront;
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
  /// See: https://openiap.dev/docs/apis/ios/sync-ios
  gentype.MutationSyncIOSHandler get syncIOS => () async {
        if (!isIOS) {
          debugPrint('syncIOS is only supported on Apple platforms');
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
  /// See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
  gentype.QueryIsEligibleForIntroOfferIOSHandler
      get isEligibleForIntroOfferIOS => (groupId) async {
            if (!isIOS) {
              return false;
            }

            try {
              final result = await _channel.invokeMethod<bool>(
                'isEligibleForIntroOfferIOS',
                {'productId': groupId},
              );
              return result ?? false;
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'check introductory-offer eligibility',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message:
                    'Failed to check introductory-offer eligibility: $error',
              );
            }
          };

  /// Get subscription status objects from StoreKit 2.
  ///
  /// See: https://openiap.dev/docs/apis/ios/subscription-status-ios
  gentype.QuerySubscriptionStatusIOSHandler get subscriptionStatusIOS =>
      (sku) async {
        if (!isIOS) {
          return <gentype.SubscriptionStatusIOS>[];
        }

        try {
          final dynamic result = await _channel.invokeMethod(
            'subscriptionStatusIOS',
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
              final normalized = normalizeDynamicMap(entry);
              if (normalized != null) {
                statuses.add(
                  gentype.SubscriptionStatusIOS.fromJson(normalized),
                );
              }
            }
          }
          return statuses;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'fetch subscription status',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to fetch subscription status: $error',
          );
        }
      };

  /// Clear pending transactions in the queue (sandbox helper).
  ///
  /// See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
  gentype.MutationClearTransactionIOSHandler get clearTransactionIOS =>
      () async {
        if (!isIOS) {
          return false;
        }

        try {
          final result =
              await _channel.invokeMethod<bool>('clearTransactionIOS');
          return result ?? false;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'clear pending transactions',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to clear pending transactions: $error',
          );
        }
      };

  /// Read the App Store-promoted product, if any.
  ///
  /// See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
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
            final normalized = normalizeDynamicMap(result);
            return normalized == null
                ? null
                : gentype.ProductIOS.fromJson(normalized);
          }

          if (result is String) {
            return null;
          }

          return null;
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'fetch promoted product',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to fetch promoted product: $error',
          );
        }
      };

  /// Fetch the app transaction (iOS 16+, macOS 14+).
  ///
  /// See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
  gentype.QueryGetAppTransactionIOSHandler get getAppTransactionIOS =>
      () async {
        if (!isIOS) {
          return null;
        }

        try {
          final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
            'getAppTransactionIOS',
          );
          if (result == null) {
            return null;
          }

          final map = result.map<String, dynamic>(
            (key, value) => MapEntry(key.toString(), value),
          );
          return gentype.AppTransaction.fromJson(map);
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'fetch app transaction',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to fetch app transaction: $error',
          );
        }
      };

  /// Show the App Store offer code redemption sheet.
  ///
  /// See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
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
              final result = await channel.invokeMethod<bool>(
                'presentCodeRedemptionSheetIOS',
              );
              return result ?? false;
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
  /// See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
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
  /// See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
  gentype.MutationShowManageSubscriptionsIOSHandler
      get showManageSubscriptionsIOS => () async {
            if (!_platform.isIOS || _platform.isMacOS) {
              throw PlatformException(
                code: 'platform',
                message: 'showManageSubscriptionsIOS is only supported on iOS',
              );
            }

            try {
              final dynamic result = await channel.invokeMethod(
                'showManageSubscriptionsIOS',
              );
              final purchases = extractPurchases(
                result,
                platformIsAndroid: false,
                platformIsIOS: true,
                acknowledgedAndroidPurchaseTokens:
                    _acknowledgedAndroidPurchaseTokens,
              );
              return purchases.whereType<gentype.PurchaseIOS>().toList(
                    growable: false,
                  );
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
  /// See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
  gentype.QueryGetPendingTransactionsIOSHandler get getPendingTransactionsIOS =>
      () async {
        if (_platform.isIOS || _platform.isMacOS) {
          try {
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
          } on PlatformException catch (error) {
            throw _purchaseErrorFromPlatformException(
              error,
              'fetch pending transactions',
            );
          } catch (error) {
            if (error is PurchaseError) rethrow;
            throw PurchaseError(
              code: gentype.ErrorCode.ServiceError,
              message: 'Failed to fetch pending transactions: $error',
            );
          }
        }
        return const <gentype.PurchaseIOS>[];
      };

  /// List every StoreKit transaction (finished + unfinished) for the current user.
  ///
  /// See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
  gentype.QueryGetAllTransactionsIOSHandler get getAllTransactionsIOS =>
      () async {
        if (_platform.isIOS || _platform.isMacOS) {
          try {
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
          } on PlatformException catch (error) {
            throw _purchaseErrorFromPlatformException(
              error,
              'fetch all transactions',
            );
          } catch (error) {
            if (error is PurchaseError) rethrow;
            throw PurchaseError(
              code: gentype.ErrorCode.ServiceError,
              message: 'Failed to fetch all transactions: $error',
            );
          }
        }
        return const <gentype.PurchaseIOS>[];
      };

  /// Get the user's current entitlement for a product.
  ///
  /// See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
  gentype.QueryCurrentEntitlementIOSHandler get currentEntitlementIOS =>
      (String sku) async {
        if (!isIOS) {
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
  /// See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
  gentype.QueryLatestTransactionIOSHandler get latestTransactionIOS =>
      (String sku) async {
        if (!isIOS) {
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
  /// See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
  gentype.QueryIsTransactionVerifiedIOSHandler get isTransactionVerifiedIOS =>
      (String sku) async {
        if (!isIOS) {
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
  /// See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
  gentype.QueryGetTransactionJwsIOSHandler get getTransactionJwsIOS =>
      (String sku) async {
        if (!isIOS) {
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
  /// See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
  gentype.QueryGetReceiptDataIOSHandler get getReceiptDataIOS => () async {
        if (!isIOS) {
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

  /// Check eligibility for the external purchase notice sheet (iOS 17.4+, macOS 14.4+).
  ///
  /// See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
  gentype.QueryCanPresentExternalPurchaseNoticeIOSHandler
      get canPresentExternalPurchaseNoticeIOS => () async {
            if (!isIOS) {
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
  /// See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android
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
  /// See: https://openiap.dev/docs/apis/android/consume-purchase-android
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
  /// See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
  gentype.MutationDeepLinkToSubscriptionsHandler get deepLinkToSubscriptions =>
      ({String? packageNameAndroid, String? skuAndroid}) async {
        try {
          if (_platform.isAndroid) {
            final args = <String, dynamic>{};
            if (packageNameAndroid != null && packageNameAndroid.isNotEmpty) {
              args['packageNameAndroid'] = packageNameAndroid;
            }
            if (skuAndroid != null && skuAndroid.isNotEmpty) {
              args['skuAndroid'] = skuAndroid;
            }

            await _channel.invokeMethod(
              'deepLinkToSubscriptionsAndroid',
              args,
            );
            return;
          }

          if (_platform.isIOS && !_platform.isMacOS) {
            await _channel.invokeMethod('deepLinkToSubscriptions');
            return;
          }

          throw PurchaseError(
            code: _platform.isMacOS
                ? gentype.ErrorCode.FeatureNotSupported
                : gentype.ErrorCode.IapNotAvailable,
            message: _platform.isMacOS
                ? 'Subscription-management window integration is not '
                    'supported on macOS'
                : 'deepLinkToSubscriptions is only available on iOS and '
                    'Android',
          );
        } on PlatformException catch (error) {
          throw _purchaseErrorFromPlatformException(
            error,
            'open subscription management',
          );
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.ServiceError,
            message: 'Failed to open subscription management: '
                '${error.toString()}',
          );
        }
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
  /// See: https://openiap.dev/docs/apis/finish-transaction
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

          if (kDebugMode) {
            debugPrint(
              '[FlutterInappPurchase] Android: Acknowledging purchase with token: ${purchase.purchaseToken}',
            );
          }

          final result = await _channel.invokeMethod(
            'acknowledgePurchaseAndroid',
            <String, dynamic>{
              'purchaseToken': purchase.purchaseToken,
            },
          );
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
              '[FlutterInappPurchase] Android: Acknowledge response indicated failure; will retry later (${purchase.purchaseToken})',
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

  /// Verify via a managed provider (currently IAPKit; the PurchaseVerificationProvider enum exposes only Iapkit today).
  ///
  /// See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
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
                  if (iapkit.baseUrl != null) 'baseUrl': iapkit.baseUrl,
                  if (iapkit.google != null)
                    'google': {'purchaseToken': iapkit.google!.purchaseToken},
                  if (iapkit.includeClientPayload != null)
                    'includeClientPayload': iapkit.includeClientPayload,
                  if (iapkit.amazon != null)
                    'amazon': {
                      'receiptId': iapkit.amazon!.receiptId,
                      if (iapkit.amazon!.sandbox != null)
                        'sandbox': iapkit.amazon!.sandbox,
                      if (iapkit.amazon!.userId != null)
                        'userId': iapkit.amazon!.userId,
                    },
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
              gentype.RequestVerifyPurchaseWithIapkitResult parseIapkitResult(
                  dynamic value) {
                if (value is! Map) {
                  throw PurchaseError(
                    code: gentype.ErrorCode.PurchaseVerificationFailed,
                    message:
                        'Malformed IAPKit verification result: iapkit must be an object',
                  );
                }

                final itemMap = value.map<String, dynamic>(
                  (key, value) => MapEntry(key.toString(), value),
                );
                final isValid = itemMap['isValid'];
                final state = itemMap['state'];
                final store = itemMap['store'];
                if (isValid is! bool || state == null || store == null) {
                  throw PurchaseError(
                    code: gentype.ErrorCode.PurchaseVerificationFailed,
                    message:
                        'Malformed IAPKit verification result: missing isValid, state, or store',
                  );
                }

                final productIdValue = itemMap['productId'];
                if (productIdValue != null && productIdValue is! String) {
                  throw PurchaseError(
                    code: gentype.ErrorCode.PurchaseVerificationFailed,
                    message:
                        'Malformed IAPKit verification result: productId must be a string',
                  );
                }

                gentype.IapkitProductClientPayload? clientPayload;
                final clientPayloadValue = itemMap['clientPayload'];
                if (clientPayloadValue != null) {
                  if (clientPayloadValue is! Map) {
                    throw PurchaseError(
                      code: gentype.ErrorCode.PurchaseVerificationFailed,
                      message:
                          'Malformed IAPKit verification result: clientPayload must be an object',
                    );
                  }
                  final payloadMap = clientPayloadValue.map<String, dynamic>(
                    (key, value) => MapEntry(key.toString(), value),
                  );
                  final format = payloadMap['format'];
                  final body = payloadMap['body'];
                  final versionValue = payloadMap['version'];
                  final updatedAtValue = payloadMap['updatedAt'];
                  final version = versionValue is num
                      ? versionValue.toDouble()
                      : double.nan;
                  final updatedAt = updatedAtValue is num
                      ? updatedAtValue.toDouble()
                      : double.nan;
                  if (format is! String ||
                      (format != 'toml' &&
                          format != 'json' &&
                          format != 'text') ||
                      body is! String ||
                      !version.isFinite ||
                      version <= 0 ||
                      version.truncateToDouble() != version ||
                      !updatedAt.isFinite ||
                      updatedAt < 0) {
                    throw PurchaseError(
                      code: gentype.ErrorCode.PurchaseVerificationFailed,
                      message:
                          'Malformed IAPKit verification result: invalid clientPayload',
                    );
                  }
                  try {
                    clientPayload = gentype.IapkitProductClientPayload(
                      body: body,
                      format:
                          gentype.IapkitClientPayloadFormat.fromJson(format),
                      updatedAt: updatedAt,
                      version: version,
                    );
                  } on ArgumentError {
                    throw PurchaseError(
                      code: gentype.ErrorCode.PurchaseVerificationFailed,
                      message:
                          'Malformed IAPKit verification result: invalid clientPayload format',
                    );
                  }
                }

                return gentype.RequestVerifyPurchaseWithIapkitResult(
                  clientPayload: clientPayload,
                  isValid: isValid,
                  productId: productIdValue as String?,
                  state: gentype.IapkitPurchaseState.fromJson(
                    state.toString(),
                  ),
                  store: gentype.IapStore.fromJson(store.toString()),
                );
              }

              gentype.RequestVerifyPurchaseWithIapkitResult? iapkitResult;
              final iapkitData = resultMap['iapkit'];
              if (iapkitData != null) {
                iapkitResult = parseIapkitResult(iapkitData);
              }

              final providerValue = resultMap['provider'];
              if (providerValue == null) {
                throw PurchaseError(
                  code: gentype.ErrorCode.PurchaseVerificationFailed,
                  message:
                      'Malformed IAPKit verification result: missing provider',
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
                  providerValue.toString(),
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
  /// See: https://openiap.dev/docs/features/validation#verify-purchase
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

          final Map<String, dynamic>? resultMap;
          if (result is String) {
            resultMap = normalizeDynamicMap(jsonDecode(result));
          } else if (result is Map) {
            resultMap = normalizeDynamicMap(result);
          } else {
            throw PurchaseError(
              code: gentype.ErrorCode.PurchaseVerificationFailed,
              message: 'Unexpected result type: ${result.runtimeType}',
            );
          }

          if (resultMap == null) {
            throw PurchaseError(
              code: gentype.ErrorCode.PurchaseVerificationFailed,
              message:
                  'Invalid verification result received from native platform',
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
  /// See: https://openiap.dev/docs/apis/fetch-products
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
  /// See: https://openiap.dev/docs/apis/restore-purchases
  gentype.MutationRestorePurchasesHandler get restorePurchases => () async {
        try {
          if (_platform.isIOS || _platform.isMacOS) {
            final synced = await syncIOS();
            if (!synced) {
              throw PurchaseError(
                code: gentype.ErrorCode.SyncError,
                message: 'App Store sync did not complete',
              );
            }
          }
          // Fetch available purchases using the public API
          await getAvailablePurchases();
        } catch (error) {
          if (error is PurchaseError) rethrow;
          throw PurchaseError(
            code: gentype.ErrorCode.SyncError,
            message: 'Failed to restore purchases: ${error.toString()}',
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
    final convertedDetails = _deepConvertMap(error.details);
    final details = convertedDetails is Map<String, dynamic>
        ? convertedDetails
        : <String, dynamic>{};
    return PurchaseError.fromPlatformError(
      <String, dynamic>{
        ...details,
        'code': error.code,
        'message': 'Failed to $operation [${error.code}]: '
            '${error.message ?? error.details}',
        if (details['debugMessage'] == null && convertedDetails is String)
          'debugMessage': convertedDetails,
      },
      platform,
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
  /// See: https://openiap.dev/docs/apis/get-active-subscriptions
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
  /// See: https://openiap.dev/docs/apis/has-active-subscriptions
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
                <String, dynamic>{'type': 'subs'},
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

  // MARK: - Billing Programs API (Android 8.2.0+)

  /// Check whether a billing program (e.g., External Payments) is available.
  ///
  /// See: https://openiap.dev/docs/apis/android/is-billing-program-available-android
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
  /// See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
  Future<gentype.BillingProgramReportingDetailsAndroid>
      createBillingProgramReportingDetailsAndroid(
    gentype.BillingProgramAndroid program, {
    gentype.DeveloperBillingTypeAndroid? developerBillingType,
  }) async {
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
        {
          'program': program.toJson(),
          'developerBillingType': developerBillingType?.toJson(),
        },
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

  /// Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens (Play Billing 9.1.0+).
  ///
  /// See: https://openiap.dev/docs/apis/android/get-billing-choice-info-android
  Future<gentype.BillingChoiceInfoAndroid> getBillingChoiceInfoAndroid(
    gentype.GetBillingChoiceInfoParamsAndroid params,
  ) async {
    if (!_platform.isAndroid) {
      throw PurchaseError(
        code: gentype.ErrorCode.IapNotAvailable,
        message: 'getBillingChoiceInfoAndroid only available on Android',
      );
    }
    try {
      final result = await _channel.invokeMethod<String>(
        'getBillingChoiceInfoAndroid',
        params.toJson(),
      );
      if (result != null) {
        final json = jsonDecode(result) as Map<String, dynamic>;
        return gentype.BillingChoiceInfoAndroid.fromJson(json);
      }
      throw PurchaseError(
        code: gentype.ErrorCode.Unknown,
        message: 'Failed to get Billing Choice info',
      );
    } catch (error) {
      debugPrint('getBillingChoiceInfoAndroid error: $error');
      rethrow;
    }
  }

  /// Show Google's mandatory information dialog before a developer-rendered,
  /// in-app Billing Choice screen (Play Billing 9.1.0+).
  ///
  /// See: https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android
  Future<gentype.BillingResultAndroid>
      showBillingProgramInformationDialogAndroid(
    gentype.BillingProgramInformationDialogParamsAndroid params,
  ) async {
    if (!_platform.isAndroid) {
      throw PurchaseError(
        code: gentype.ErrorCode.IapNotAvailable,
        message:
            'showBillingProgramInformationDialogAndroid only available on Android',
      );
    }
    try {
      final result = await _channel.invokeMethod<String>(
        'showBillingProgramInformationDialogAndroid',
        params.toJson(),
      );
      if (result != null) {
        final json = jsonDecode(result) as Map<String, dynamic>;
        return gentype.BillingResultAndroid.fromJson(json);
      }
      throw PurchaseError(
        code: gentype.ErrorCode.Unknown,
        message: 'Failed to show Billing Choice information dialog',
      );
    } catch (error) {
      debugPrint('showBillingProgramInformationDialogAndroid error: $error');
      rethrow;
    }
  }

  /// Show Play Billing in-app messages such as transactional subscription updates.
  ///
  /// See: https://openiap.dev/docs/apis/android/show-in-app-messages-android
  Future<gentype.InAppMessageResultAndroid> showInAppMessagesAndroid([
    gentype.InAppMessageParamsAndroid? params,
  ]) async {
    if (!_platform.isAndroid) {
      throw PurchaseError(
        code: gentype.ErrorCode.IapNotAvailable,
        message: 'showInAppMessagesAndroid only available on Android',
      );
    }
    try {
      final result = await _channel.invokeMethod<String>(
        'showInAppMessagesAndroid',
        params?.toJson(),
      );
      if (result != null) {
        final json = jsonDecode(result) as Map<String, dynamic>;
        return gentype.InAppMessageResultAndroid.fromJson(json);
      }
      return const gentype.InAppMessageResultAndroid(
        responseCode: gentype.InAppMessageResponseCodeAndroid.NoActionNeeded,
      );
    } catch (error) {
      debugPrint('showInAppMessagesAndroid error: $error');
      rethrow;
    }
  }

  /// Launch an external content/offer link from inside the Billing Programs flow (Play Billing 8.2.0+).
  ///
  /// See: https://openiap.dev/docs/apis/android/launch-external-link-android
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
        'externalTransactionToken': params.externalTransactionToken,
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

  /// Open the Google Play offer/promo code redemption flow so the user can
  /// enter a code.
  ///
  /// On Play builds, launches the Play Store redeem page. A listener can
  /// receive the purchase while the app has an active billing connection;
  /// reconcile available purchases when the app resumes. Unsupported store
  /// flavors return false. Android counterpart of `presentCodeRedemptionSheetIOS`.
  ///
  /// See: https://openiap.dev/docs/apis/android/open-redeem-offer-code-android
  Future<bool> openRedeemOfferCodeAndroid() async {
    if (!_platform.isAndroid) {
      throw PurchaseError(
        code: gentype.ErrorCode.IapNotAvailable,
        message: 'openRedeemOfferCodeAndroid only available on Android',
      );
    }
    try {
      final result = await _channel.invokeMethod<bool>(
        'openRedeemOfferCodeAndroid',
      );
      return result ?? false;
    } catch (error) {
      debugPrint('openRedeemOfferCodeAndroid error: $error');
      rethrow;
    }
  }

  /// Present the external purchase notice sheet (iOS 17.4+, macOS 14.4+).
  ///
  /// See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
  gentype.MutationPresentExternalPurchaseNoticeSheetIOSHandler
      get presentExternalPurchaseNoticeSheetIOS => () async {
            if (!isIOS) {
              return const gentype.ExternalPurchaseNoticeResultIOS(
                error:
                    'External purchase notice is only available on Apple platforms',
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
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'present external purchase notice',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message: 'Failed to present external purchase notice: $error',
              );
            }
          };

  /// Present an external purchase link (iOS 16+; unsupported on macOS).
  ///
  /// See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
  gentype.MutationPresentExternalPurchaseLinkIOSHandler
      get presentExternalPurchaseLinkIOS => (String url) async {
            if (!_platform.isIOS || _platform.isMacOS) {
              return gentype.ExternalPurchaseLinkResultIOS(
                success: false,
                error: _platform.isMacOS
                    ? 'External purchase links are not supported on macOS'
                    : 'External purchase links are only supported on iOS',
              );
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
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'present external purchase link',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message: 'Failed to present external purchase link: $error',
              );
            }
          };

  // MARK: - ExternalPurchaseCustomLink (iOS 18.1+, macOS 15.1+)

  /// Check eligibility for ExternalPurchaseCustomLink (iOS 18.1+, macOS 15.1+).
  ///
  /// See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
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

  /// Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+, macOS 15.1+).
  ///
  /// See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
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
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'get ExternalPurchaseCustomLink token',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message:
                    'Failed to get ExternalPurchaseCustomLink token: $error',
              );
            }
          };

  /// Present the ExternalPurchaseCustomLink disclosure (iOS 18.1+, macOS 15.1+).
  ///
  /// See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
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
            } on PlatformException catch (error) {
              throw _purchaseErrorFromPlatformException(
                error,
                'show ExternalPurchaseCustomLink notice',
              );
            } catch (error) {
              if (error is PurchaseError) rethrow;
              throw PurchaseError(
                code: gentype.ErrorCode.ServiceError,
                message:
                    'Failed to show ExternalPurchaseCustomLink notice: $error',
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

        // Wrap list in the generated result union for OpenIAP compatibility.
        // `All` must preserve product and subscription variants instead of
        // flattening the mixed result into the product-only branch.
        if (queryType == gentype.ProductQueryType.All) {
          final wrapped = products
              .map<gentype.ProductOrSubscription?>((product) {
                if (product is gentype.ProductSubscription) {
                  return gentype.ProductOrSubscriptionProductSubscription(
                    product,
                  );
                }
                if (product is gentype.Product) {
                  return gentype.ProductOrSubscriptionProduct(product);
                }
                return null;
              })
              .whereType<gentype.ProductOrSubscription>()
              .toList(growable: false);
          return gentype.FetchProductsResultAll(wrapped);
        }
        if (queryType == gentype.ProductQueryType.Subs) {
          return gentype.FetchProductsResultSubscriptions(
            products.whereType<gentype.ProductSubscription>().toList(),
          );
        }
        return gentype.FetchProductsResultProducts(
          products.whereType<gentype.Product>().toList(),
        );
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
        getTransactionJwsIOS: getTransactionJwsIOS,
        getBillingChoiceInfoAndroid: _getBillingChoiceInfoAndroidHandler,
        hasActiveSubscriptions: hasActiveSubscriptions,
        isEligibleForExternalPurchaseCustomLinkIOS:
            isEligibleForExternalPurchaseCustomLinkIOS,
        isEligibleForIntroOfferIOS: isEligibleForIntroOfferIOS,
        isTransactionVerifiedIOS: isTransactionVerifiedIOS,
        latestTransactionIOS: latestTransactionIOS,
        subscriptionStatusIOS: subscriptionStatusIOS,
      );

  gentype.MutationLaunchExternalLinkAndroidHandler
      get _launchExternalLinkAndroidHandler => ({
            required gentype.BillingProgramAndroid billingProgram,
            required gentype.ExternalLinkLaunchModeAndroid launchMode,
            required gentype.ExternalLinkTypeAndroid linkType,
            required String linkUri,
            String? externalTransactionToken,
          }) =>
              launchExternalLinkAndroid(
                gentype.LaunchExternalLinkParamsAndroid(
                  billingProgram: billingProgram,
                  externalTransactionToken: externalTransactionToken,
                  launchMode: launchMode,
                  linkType: linkType,
                  linkUri: linkUri,
                ),
              );

  gentype.QueryGetBillingChoiceInfoAndroidHandler
      get _getBillingChoiceInfoAndroidHandler => ({
            required gentype.BillingProgramAndroid billingProgram,
            required gentype.BillingChoiceImageLayoutAndroid
                playBillingChoiceImageLayout,
            String? userLocale,
          }) =>
              getBillingChoiceInfoAndroid(
                gentype.GetBillingChoiceInfoParamsAndroid(
                  billingProgram: billingProgram,
                  playBillingChoiceImageLayout: playBillingChoiceImageLayout,
                  userLocale: userLocale,
                ),
              );

  gentype.MutationCreateBillingProgramReportingDetailsAndroidHandler
      get _createBillingProgramReportingDetailsAndroidHandler => ({
            required gentype.BillingProgramAndroid program,
            gentype.DeveloperBillingTypeAndroid? developerBillingType,
          }) =>
              createBillingProgramReportingDetailsAndroid(
                program,
                developerBillingType: developerBillingType,
              );

  gentype.MutationShowBillingProgramInformationDialogAndroidHandler
      get _showBillingProgramInformationDialogAndroidHandler => ({
            required gentype.BillingProgramAndroid billingProgram,
            required String externalTransactionToken,
          }) =>
              showBillingProgramInformationDialogAndroid(
                gentype.BillingProgramInformationDialogParamsAndroid(
                  billingProgram: billingProgram,
                  externalTransactionToken: externalTransactionToken,
                ),
              );

  gentype.MutationShowInAppMessagesAndroidHandler
      get _showInAppMessagesAndroidHandler => ({
            List<gentype.InAppMessageCategoryAndroid>? categories,
          }) =>
              showInAppMessagesAndroid(
                gentype.InAppMessageParamsAndroid(categories: categories),
              );

  gentype.MutationHandlers get mutationHandlers => gentype.MutationHandlers(
        acknowledgePurchaseAndroid: acknowledgePurchaseAndroid,
        beginRefundRequestIOS: beginRefundRequestIOS,
        consumePurchaseAndroid: consumePurchaseAndroid,
        createBillingProgramReportingDetailsAndroid:
            _createBillingProgramReportingDetailsAndroidHandler,
        deepLinkToSubscriptions: deepLinkToSubscriptions,
        endConnection: endConnection,
        finishTransaction: finishTransaction,
        initConnection: initConnection,
        isBillingProgramAvailableAndroid: isBillingProgramAvailableAndroid,
        launchExternalLinkAndroid: _launchExternalLinkAndroidHandler,
        openRedeemOfferCodeAndroid: openRedeemOfferCodeAndroid,
        presentCodeRedemptionSheetIOS: presentCodeRedemptionSheetIOS,
        requestPurchase: requestPurchase,
        restorePurchases: restorePurchases,
        showBillingProgramInformationDialogAndroid:
            _showBillingProgramInformationDialogAndroidHandler,
        showInAppMessagesAndroid: _showInAppMessagesAndroidHandler,
        showManageSubscriptionsIOS: showManageSubscriptionsIOS,
        syncIOS: syncIOS,
        verifyPurchase: verifyPurchase,
        clearTransactionIOS: clearTransactionIOS,
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
        purchaseUpdated: ({bool? dedupeTransactionIOS}) async {
          final options = gentype.PurchaseUpdatedListenerOptions(
            dedupeTransactionIOS: dedupeTransactionIOS,
          );
          if (isIOS) {
            final shouldDedupe = dedupeTransactionIOS != false;
            if (shouldDedupe) {
              await _setDedupingPurchaseUpdatedListenerOptionsIOS(options);
            } else {
              await _retainNonDedupingPurchaseUpdatedListenerIOS();
            }
            try {
              return await _purchaseUpdatedListenerStreamIOS(
                dedupeTransactionIOS: shouldDedupe,
              ).first;
            } finally {
              if (!shouldDedupe) {
                await _releaseNonDedupingPurchaseUpdatedListenerIOS();
              }
            }
          }
          return purchaseUpdatedListener.first;
        },
        subscriptionBillingIssue: () async =>
            await subscriptionBillingIssueListener.first,
        userChoiceBillingAndroid: () async =>
            await _userChoiceBillingAndroidListener.stream.first,
        developerProvidedBillingAndroid: () async =>
            await _developerProvidedBillingAndroidListener.stream.first,
      );
}
