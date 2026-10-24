import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

import '../app_purchase_flow.dart';
import '../widgets/product_detail_modal.dart';
import '../constants.dart';

class SubscriptionFlowScreen extends StatefulWidget {
  const SubscriptionFlowScreen({super.key, this.purchases});

  final AppPurchaseFlow? purchases;

  @override
  State<SubscriptionFlowScreen> createState() => _SubscriptionFlowScreenState();
}

class _SubscriptionFlowScreenState extends State<SubscriptionFlowScreen> {
  late final AppPurchaseFlow _purchases =
      widget.purchases ?? AppPurchaseFlow.instance;
  FlutterInappPurchase get _iap => _purchases.iap;

  // Use subscription IDs from constants
  final List<String> subscriptionIds = IapConstants.subscriptionProductIds;

  List<ProductCommon> _subscriptions = [];
  final Map<String, ProductCommon> _originalProducts = {};
  // Keyed by catalog product id; Amazon reports a term under its base SKU.
  final Map<String, ActiveSubscription> _activeSubscriptionInfo = {};
  String? _currentProductId;
  // Only Google Play replaces a plan in place; Amazon rejects the request.
  bool _currentPlanOnPlay = false;
  bool _isProcessing = false;
  bool _connected = false;
  bool _isConnecting = true;
  bool _isLoadingProducts = false;
  String? _purchaseResult;

  late final StreamSubscription<PurchaseFlowOutcome> _outcomeSubscription;
  late final StreamSubscription<PurchaseError> _purchaseErrorSubscription;

  // Google Play replaces the current plan with this mode on an upgrade.
  SubscriptionReplacementModeAndroid? _replacementMode =
      SubscriptionReplacementModeAndroid.WithTimeProration;
  final Map<String, SubscriptionReplacementModeAndroid> _replacementModes = {
    'Immediate with Time Proration':
        SubscriptionReplacementModeAndroid.WithTimeProration,
    'Immediate and Charge Prorated Price':
        SubscriptionReplacementModeAndroid.ChargeProratedPrice,
    'Immediate without Proration':
        SubscriptionReplacementModeAndroid.WithoutProration,
    'Deferred': SubscriptionReplacementModeAndroid.Deferred,
    'Immediate and Charge Full Price':
        SubscriptionReplacementModeAndroid.ChargeFullPrice,
  };

  ActiveSubscription? get _currentActiveSubscription =>
      _activeSubscriptionInfo[_currentProductId];
  bool get _hasActiveSubscription => _activeSubscriptionInfo.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _outcomeSubscription = _purchases.flow.outcomes.listen(_showOutcome);
    _purchaseErrorSubscription = _iap.purchaseErrorListener.listen((error) {
      debugPrint('Purchase error: ${error.code} - ${error.message}');
      setState(() {
        _isProcessing = false;
        _purchaseResult = error.code == ErrorCode.UserCancelled
            ? '⚠️ Purchase cancelled'
            : '❌ Error: ${error.message}';
      });
    });
    _awaitConnection(_purchases.connected);
  }

  @override
  void dispose() {
    _outcomeSubscription.cancel();
    _purchaseErrorSubscription.cancel();
    super.dispose();
  }

  // Outcomes arrive through _showOutcome.
  Future<void> _recoverPurchases({bool includeFinished = false}) async {
    try {
      await _purchases.flow.recoverPurchases(includeFinished: includeFinished);
    } catch (error) {
      if (error is PurchaseError &&
          error.code == ErrorCode.FeatureNotSupported) {
        return;
      }
      if (mounted) {
        setState(() {
          _purchaseResult =
              'Purchase recovery failed; receipts retained: $error';
        });
      }
    }
  }

  Future<void> _showOutcome(PurchaseFlowOutcome outcome) async {
    final purchase = outcome.purchase;
    if (IapConstants.subscriptionProductId(
          purchase.productId,
          purchase.currentPlanId,
        ) ==
        null) {
      return;
    }
    debugPrint(
      'Subscription outcome for ${purchase.productId}: '
      '${describePurchaseFlowStatus(outcome.status).key.value}',
    );
    // A finished purchase changes what the store reports as active.
    await _checkActiveSubscriptions();
    if (!mounted) return;
    setState(() {
      _isProcessing = false;
      _purchaseResult = describeOutcome(outcome);
    });
  }

  Future<void> _pickVerificationMethod() async {
    // Renewal state comes from the server, not the device.
    final picked = await pickVerificationMethod(context, _purchases, const [
      VerificationMethod.ignore,
      VerificationMethod.iapkitLocalhost,
      VerificationMethod.iapkit,
    ]);
    if (picked == null || !mounted) return;
    setState(() {});
    if (picked != VerificationMethod.ignore) unawaited(_recoverPurchases());
  }

  // The app owns the connection; this screen only loads its products.
  Future<void> _awaitConnection(Future<bool> connecting) async {
    final connected = await connecting;
    if (!mounted) return;

    setState(() {
      _connected = connected;
      _isConnecting = false;
    });

    if (connected) {
      await _loadSubscriptions();
      await _checkActiveSubscriptions();
    }
  }

  Future<void> _loadSubscriptions() async {
    if (!_connected) return;

    setState(() => _isLoadingProducts = true);

    try {
      debugPrint('🔄 Loading subscriptions with SKUs: $subscriptionIds');

      // Use explicit type annotation for proper type inference
      final subscriptions = await _iap.fetchProducts<ProductSubscription>(
        skus: subscriptionIds,
        type: ProductQueryType.Subs,
      );

      debugPrint('✅ Loaded ${subscriptions.length} subscriptions');
      for (final sub in subscriptions) {
        debugPrint('  - ${sub.id}: ${sub.title} (${sub.runtimeType})');
      }

      if (!mounted) return;

      setState(() {
        // Store original products
        _originalProducts.clear();
        for (final product in subscriptions) {
          final productKey = product.id;
          _originalProducts[productKey] = product;
        }

        _subscriptions = List.of(subscriptions, growable: false);
        _isLoadingProducts = false;
      });
    } catch (error, stackTrace) {
      debugPrint('💥 Failed to load subscriptions: $error');
      debugPrint('📍 Stack trace: $stackTrace');
      if (!mounted) return;
      setState(() {
        _subscriptions = [];
        _isLoadingProducts = false;
        _purchaseResult = '❌ Failed to load subscriptions: $error';
      });
    }
  }

  Future<void> _checkActiveSubscriptions() async {
    if (!_connected) return;

    try {
      final subscriptions = await _iap.getActiveSubscriptions(
        IapConstants.subscriptionQueryIds,
      );
      final active = {
        for (final subscription in subscriptions)
          if (subscription.isActive)
            if (IapConstants.subscriptionProductId(
              subscription.productId,
              subscription.currentPlanId,
            )
                case final productId?)
              productId: subscription,
      };
      // The most recent purchase is the current plan.
      final current =
          active.entries.fold<MapEntry<String, ActiveSubscription>?>(
        null,
        (latest, entry) => latest == null ||
                entry.value.transactionDate > latest.value.transactionDate
            ? entry
            : latest,
      );
      final token = current?.value.purchaseToken;
      final owned = token == null
          ? const <Purchase>[]
          : await _iap.getAvailablePurchases();
      final currentStore = owned
          .where((purchase) => purchase.purchaseToken == token)
          .firstOrNull
          ?.store;

      if (!mounted) return;

      setState(() {
        _activeSubscriptionInfo
          ..clear()
          ..addAll(active);
        _currentProductId = current?.key;
        _currentPlanOnPlay = currentStore == IapStore.Google;

        final summary = current?.value;
        if (summary != null) {
          final buffer = StringBuffer('Active: ${current!.key}');
          if (summary.expirationDateIOS != null) {
            buffer.write(
              '\nExpires: ${_formatReadableDate(summary.expirationDateIOS!)}',
            );
          }
          if (summary.autoRenewingAndroid != null) {
            buffer.write(
              '\nAuto renew: ${summary.autoRenewingAndroid == true}',
            );
          }
          if (summary.renewalInfoIOS?.willAutoRenew != null) {
            buffer.write(
              '\nWill auto renew (iOS): ${summary.renewalInfoIOS!.willAutoRenew}',
            );
          }
          _purchaseResult = buffer.toString();
        } else {
          _purchaseResult = 'No active subscriptions found';
        }
      });
    } catch (error) {
      debugPrint('Failed to check active subscriptions: $error');
      if (!mounted) return;
      setState(() {
        _purchaseResult = '❌ Error checking subscriptions: $error';
      });
    }
  }

  Future<void> _purchaseSubscription(
    ProductCommon item, {
    bool isUpgrade = false,
  }) async {
    if (_isProcessing) {
      debugPrint('⚠️ Already processing a purchase, ignoring');
      return;
    }

    setState(() {
      _isProcessing = true;
      _purchaseResult = null;
    });

    try {
      final current = _currentActiveSubscription;
      final mode = _replacementMode;
      // iOS upgrades within the subscription group on its own.
      final replacing =
          isUpgrade && _currentPlanOnPlay && current != null && mode != null;
      await _iap.requestPurchase(
        RequestPurchaseProps.subs((
          apple: RequestSubscriptionIosProps(sku: item.id),
          google: RequestSubscriptionAndroidProps(
            skus: [item.id],
            purchaseToken: replacing ? current.purchaseToken : null,
            subscriptionProductReplacementParams: replacing
                ? SubscriptionProductReplacementParamsAndroid(
                    oldProductId: current.productId,
                    replacementMode: mode,
                  )
                : null,
          ),
        )),
      );

      // The purchase arrives through the flow's outcomes.
      debugPrint('Purchase request sent, waiting for response...');
    } catch (error) {
      debugPrint('Failed to request subscription: $error');
      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _purchaseResult = '❌ Failed to request: $error';
      });
    }
  }

  // Tests a replacement request with a bad purchase token (Issue #529).
  Future<void> _requestWithTestToken(ProductCommon item, String token) async {
    if (_isProcessing) return;

    setState(() {
      _isProcessing = true;
      _purchaseResult = null;
    });

    try {
      await _iap.requestPurchase(
        RequestPurchaseProps.subs((
          apple: null,
          google: RequestSubscriptionAndroidProps(
            purchaseToken: token,
            skus: [item.id],
          ),
        )),
      );
      debugPrint('Purchase request sent with a test token');
    } catch (error) {
      debugPrint('Error with test token: $error');
      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _purchaseResult = '❌ Error with test token:\n$error';
      });
    }
  }

  Future<void> _restorePurchases() async {
    setState(() {
      _isProcessing = true;
      _purchaseResult = null;
    });

    try {
      await _iap.restorePurchases();
      await _recoverPurchases(includeFinished: true);
      await _checkActiveSubscriptions();

      if (!mounted) return;

      setState(() {
        _isProcessing = false;
        _purchaseResult =
            '✅ Restored ${_activeSubscriptionInfo.length} subscription(s)';
      });
    } catch (error) {
      debugPrint('Failed to restore purchases: $error');
      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _purchaseResult = '❌ Failed to restore: $error';
      });
    }
  }

  Widget _buildActiveSubscriptionCard(
    String productId,
    ActiveSubscription subscription,
  ) {
    final isCurrent = _currentProductId == productId;
    final chips = <Widget>[
      _infoChip('Status: ${subscription.isActive ? 'Active' : 'Inactive'}'),
      if (subscription.basePlanIdAndroid != null)
        _infoChip('Plan: ${subscription.basePlanIdAndroid}'),
    ];

    final bool? autoRenew = subscription.autoRenewingAndroid ??
        subscription.renewalInfoIOS?.willAutoRenew;
    if (autoRenew != null) {
      chips.add(_infoChip('Auto renew: $autoRenew'));
    }

    final expiration = subscription.expirationDateIOS;
    if (expiration != null) {
      chips.add(_infoChip('Expires: ${_formatReadableDate(expiration)}'));
    }
    final daysUntilExpiration = subscription.daysUntilExpirationIOS;
    if (daysUntilExpiration != null &&
        daysUntilExpiration > 0 &&
        daysUntilExpiration < 7) {
      chips.add(_infoChip('Expiring soon'));
    }
    final environment = subscription.environmentIOS;
    if (environment != null && environment.isNotEmpty) {
      chips.add(_infoChip('Env: $environment'));
    }

    final renewal = subscription.renewalInfoIOS;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    productId,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: (isCurrent
                            ? Colors.green.shade600
                            : Colors.blueGrey.shade600)
                        .withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isCurrent
                          ? Colors.green.shade600
                          : Colors.blueGrey.shade600,
                    ),
                  ),
                  child: Text(
                    isCurrent ? 'Current' : 'Active',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isCurrent
                          ? Colors.green.shade700
                          : Colors.blueGrey.shade700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: chips),

            // renewalInfoIOS showcase
            if (renewal != null) ...[
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 8),
              const Text(
                'Renewal Info (iOS)',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              _buildRenewalInfoRow(
                'Auto-Renew',
                renewal.willAutoRenew ? '✅ Enabled' : '⚠️ Disabled',
                renewal.willAutoRenew ? Colors.green : Colors.orange,
              ),
              if (renewal.pendingUpgradeProductId != null)
                _buildRenewalInfoRow(
                  'Pending Upgrade',
                  renewal.pendingUpgradeProductId!,
                  Colors.blue,
                ),
              if (renewal.renewalDate != null)
                _buildRenewalInfoRow(
                  'Next Renewal',
                  _formatReadableDate(renewal.renewalDate!),
                  Colors.blue,
                ),
              if (renewal.expirationReason != null)
                _buildRenewalInfoRow(
                  'Expiration Reason',
                  renewal.expirationReason!,
                  Colors.red,
                ),
              if (renewal.isInBillingRetry == true)
                _buildRenewalInfoRow(
                  'Billing Status',
                  '⚠️ In Billing Retry',
                  Colors.orange,
                ),
              if (renewal.gracePeriodExpirationDate != null)
                _buildRenewalInfoRow(
                  'Grace Period Ends',
                  _formatReadableDate(renewal.gracePeriodExpirationDate!),
                  Colors.orange,
                ),
              if (renewal.priceIncreaseStatus != null)
                _buildRenewalInfoRow(
                  'Price Increase',
                  renewal.priceIncreaseStatus!,
                  Colors.purple,
                ),
              if (renewal.autoRenewPreference != null &&
                  renewal.autoRenewPreference != subscription.productId)
                _buildRenewalInfoRow(
                  'Auto-Renew Preference',
                  renewal.autoRenewPreference!,
                  Colors.purple,
                ),
            ],

            const SizedBox(height: 12),
            Text(
              'Transaction ID: ${subscription.transactionId}',
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade600,
                fontFamily: 'monospace',
              ),
            ),
            if (subscription.purchaseToken?.isNotEmpty == true) ...[
              const SizedBox(height: 4),
              Text(
                'Purchase credential: Present',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey.shade600,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRenewalInfoRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 12,
                color: color,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }

  String _formatReadableDate(double timestamp) {
    if (timestamp == 0) {
      return 'Unknown';
    }
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp.round());
    return date.toLocal().toString().split('.').first;
  }

  /// Build widgets showing standardized SubscriptionOffer data (cross-platform)
  List<Widget> _buildStandardizedOffers(ProductCommon subscription) {
    List<SubscriptionOffer>? offers;

    // Get standardized offers from the product
    if (subscription is ProductSubscriptionAndroid) {
      offers = subscription.subscriptionOffers;
    } else if (subscription is ProductSubscriptionIOS) {
      offers = subscription.subscriptionOffers;
    }

    if (offers == null || offers.isEmpty) {
      return [];
    }

    return [
      const SizedBox(height: 8),
      const Text(
        'Available Offers:',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: Colors.deepPurple,
        ),
      ),
      const SizedBox(height: 4),
      ...offers.map((offer) => _buildOfferChip(offer)),
    ];
  }

  Widget _buildOfferChip(SubscriptionOffer offer) {
    final typeLabel = switch (offer.type) {
      DiscountOfferType.Introductory => 'Intro',
      DiscountOfferType.Promotional => 'Promo',
      DiscountOfferType.OneTime => 'One-time',
    };

    final paymentModeLabel = switch (offer.paymentMode) {
      PaymentMode.FreeTrial => 'Free Trial',
      PaymentMode.PayAsYouGo => 'Pay As You Go',
      PaymentMode.PayUpFront => 'Pay Up Front',
      PaymentMode.Unknown => '',
      null => '',
    };

    final periodLabel = offer.period != null
        ? '${offer.period!.value} ${offer.period!.unit.toJson()}'
        : '';

    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.deepPurple.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.deepPurple.shade200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.deepPurple,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              typeLabel,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            offer.displayPrice,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          if (paymentModeLabel.isNotEmpty) ...[
            const SizedBox(width: 8),
            Text(
              paymentModeLabel,
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
            ),
          ],
          if (periodLabel.isNotEmpty) ...[
            const SizedBox(width: 8),
            Text(
              periodLabel,
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSubscriptionTier(ProductCommon subscription) {
    final isCurrentSubscription = _currentProductId == subscription.id;

    return GestureDetector(
      onTap: () => ProductDetailModal.show(
        context: context,
        item: subscription,
        product: _originalProducts[subscription.id],
      ),
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        color: isCurrentSubscription ? Colors.blue.shade50 : null,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.star, color: Colors.amber),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          subscription.title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (isCurrentSubscription)
                          Container(
                            margin: const EdgeInsets.only(top: 4),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.blue,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'CURRENT',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    subscription.displayPrice,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                subscription.description,
                style: TextStyle(color: Colors.grey[600]),
              ),

              // Show standardized subscription offers (new cross-platform API)
              ..._buildStandardizedOffers(subscription),

              const SizedBox(height: 12),

              // Action buttons - Always show for testing
              // Show current status if this is the current subscription
              if (isCurrentSubscription) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    vertical: 4,
                    horizontal: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    '✓ Currently Active',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.green,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
              ],

              if (_currentPlanOnPlay) ...[
                const Text(
                  'Proration Mode (Test):',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _replacementModes.entries.map((entry) {
                      final isSelected = _replacementMode == entry.value;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(
                            entry.key,
                            style: const TextStyle(fontSize: 10),
                          ),
                          selected: isSelected,
                          onSelected: (selected) {
                            setState(() {
                              _replacementMode = selected ? entry.value : null;
                            });
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 8),
              ],

              // Purchase/Upgrade buttons
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isProcessing || isCurrentSubscription
                          ? null
                          : () => _purchaseSubscription(
                                subscription,
                                isUpgrade: _hasActiveSubscription,
                              ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _hasActiveSubscription
                            ? Colors.orange.shade600
                            : const Color(0xFF007AFF),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: Text(
                        _isProcessing
                            ? 'Processing...'
                            : isCurrentSubscription
                                ? 'Active'
                                : _hasActiveSubscription
                                    ? 'Upgrade/Downgrade'
                                    : 'Subscribe',
                      ),
                    ),
                  ),
                  if (!kIsWeb &&
                      defaultTargetPlatform == TargetPlatform.android) ...[
                    const SizedBox(width: 4),
                    // Test wrong usage button
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _isProcessing || isCurrentSubscription
                            ? null
                            : () => _requestWithTestToken(
                                  subscription,
                                  'invalid_purchase_token_for_testing',
                                ),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red.shade600,
                          side: BorderSide(color: Colors.red.shade300),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Tooltip(
                          message: 'Test proration without token',
                          child: Text(
                            'No Token',
                            style: TextStyle(fontSize: 11),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    // Test with empty token button
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _isProcessing
                            ? null
                            : () => _requestWithTestToken(subscription, ''),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.orange.shade600,
                          side: BorderSide(color: Colors.orange.shade300),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Tooltip(
                          message: 'Test proration with empty token',
                          child: Text(
                            'Empty Token',
                            style: TextStyle(fontSize: 11),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(CupertinoIcons.back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Subscription Flow',
          style: TextStyle(color: Colors.black),
        ),
        actions: [
          if (_currentActiveSubscription != null &&
              _currentActiveSubscription!.purchaseToken?.isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Chip(
                label: Text(
                  'Purchase credential: Present',
                  style: const TextStyle(fontSize: 10),
                ),
                backgroundColor: Colors.green,
              ),
            ),
        ],
      ),
      body: _isConnecting
          ? const Center(child: CircularProgressIndicator())
          : !_connected
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error, size: 64, color: Colors.red),
                      const SizedBox(height: 16),
                      const Text('Failed to connect to store'),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => _awaitConnection(_purchases.start()),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF007AFF),
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    await _loadSubscriptions();
                    await _checkActiveSubscriptions();
                  },
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Verification Method Selector
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.blue.shade200),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Subscription Verification:',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              OutlinedButton(
                                onPressed: _pickVerificationMethod,
                                child: Text(
                                  _purchases.verificationMethod.value.label,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Active Subscription Status Card
                        Card(
                          color: _hasActiveSubscription
                              ? Colors.green.shade50
                              : Colors.orange.shade50,
                          child: ListTile(
                            leading: Icon(
                              _hasActiveSubscription
                                  ? Icons.check_circle
                                  : Icons.info,
                              color: _hasActiveSubscription
                                  ? Colors.green
                                  : Colors.orange,
                            ),
                            title: Text(
                              _hasActiveSubscription
                                  ? 'Store ownership: $_currentProductId'
                                  : 'No store-reported subscription',
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            subtitle: Text(
                              _hasActiveSubscription
                                  ? 'You can upgrade/downgrade with proration mode'
                                  : 'Subscribe to any tier to get started',
                            ),
                          ),
                        ),

                        const SizedBox(height: 24),

                        // Upgrade Detection Section
                        if (_activeSubscriptionInfo.values.any(
                          (sub) =>
                              sub.renewalInfoIOS?.pendingUpgradeProductId !=
                              null,
                        )) ...[
                          Card(
                            color: Colors.blue.shade50,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(
                                        Icons.upgrade,
                                        color: Colors.blue.shade700,
                                      ),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Pending Upgrade Detected',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  ..._activeSubscriptionInfo.values
                                      .where(
                                    (sub) =>
                                        sub.renewalInfoIOS
                                            ?.pendingUpgradeProductId !=
                                        null,
                                  )
                                      .map((sub) {
                                    final renewal = sub.renewalInfoIOS!;
                                    return Padding(
                                      padding: const EdgeInsets.only(top: 8),
                                      child: RichText(
                                        text: TextSpan(
                                          style: TextStyle(
                                            color: Colors.grey.shade800,
                                            fontSize: 14,
                                          ),
                                          children: [
                                            TextSpan(
                                              text: sub.productId,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            const TextSpan(text: ' → '),
                                            TextSpan(
                                              text: renewal
                                                  .pendingUpgradeProductId!,
                                              style: TextStyle(
                                                fontWeight: FontWeight.w600,
                                                color: Colors.blue.shade700,
                                              ),
                                            ),
                                            if (renewal.renewalDate != null)
                                              TextSpan(
                                                text:
                                                    '\nUpgrade takes effect: ${_formatReadableDate(renewal.renewalDate!)}',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey.shade600,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Cancellation Detection Section
                        if (_activeSubscriptionInfo.values.any(
                          (sub) =>
                              sub.renewalInfoIOS?.willAutoRenew == false &&
                              sub.renewalInfoIOS?.pendingUpgradeProductId ==
                                  null,
                        )) ...[
                          Card(
                            color: Colors.orange.shade50,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(
                                        Icons.warning,
                                        color: Colors.orange.shade700,
                                      ),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Subscription Cancelled',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  ..._activeSubscriptionInfo.values
                                      .where(
                                    (sub) =>
                                        sub.renewalInfoIOS?.willAutoRenew ==
                                            false &&
                                        sub.renewalInfoIOS
                                                ?.pendingUpgradeProductId ==
                                            null,
                                  )
                                      .map((sub) {
                                    return Padding(
                                      padding: const EdgeInsets.only(top: 8),
                                      child: RichText(
                                        text: TextSpan(
                                          style: TextStyle(
                                            color: Colors.grey.shade800,
                                            fontSize: 14,
                                          ),
                                          children: [
                                            TextSpan(
                                              text: sub.productId,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            const TextSpan(
                                              text:
                                                  ' is active but will not renew',
                                            ),
                                            if (sub.expirationDateIOS != null)
                                              TextSpan(
                                                text:
                                                    '\nExpires: ${_formatReadableDate(sub.expirationDateIOS!)}',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey.shade600,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        if (_activeSubscriptionInfo.isNotEmpty) ...[
                          const Text(
                            'Store-reported Subscriptions',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          for (final MapEntry(:key, :value)
                              in _activeSubscriptionInfo.entries)
                            _buildActiveSubscriptionCard(key, value),
                          const SizedBox(height: 24),
                        ],

                        // Available Subscriptions
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Available Subscription Tiers',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            if (_isLoadingProducts)
                              const SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        if (_subscriptions.isEmpty && !_isLoadingProducts)
                          const Card(
                            child: Padding(
                              padding: EdgeInsets.all(32),
                              child: Center(
                                child: Text(
                                  'No subscriptions available',
                                  style: TextStyle(color: Colors.grey),
                                ),
                              ),
                            ),
                          )
                        else
                          ..._subscriptions.map(_buildSubscriptionTier),

                        const SizedBox(height: 24),

                        // Test Instructions
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.blue.shade200),
                          ),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'How to Test Proration Mode:',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              SizedBox(height: 8),
                              Text(
                                '1. Subscribe to Basic tier first',
                                style: TextStyle(fontSize: 12),
                              ),
                              Text(
                                '2. Wait for purchase to complete',
                                style: TextStyle(fontSize: 12),
                              ),
                              Text(
                                '3. Tap "Restore Purchases" to load your subscription',
                                style: TextStyle(fontSize: 12),
                              ),
                              Text(
                                '4. Select a proration mode (e.g., "Immediate with Time Proration")',
                                style: TextStyle(fontSize: 12),
                              ),
                              Text(
                                '5. Upgrade to Premium or Pro tier',
                                style: TextStyle(fontSize: 12),
                              ),
                              SizedBox(height: 8),
                              Text(
                                'Test Buttons: "No Token" = without token, "Empty Token" = with empty string',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontStyle: FontStyle.italic,
                                  color: Colors.grey,
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Restore Purchases Button
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: _isProcessing ? null : _restorePurchases,
                            icon: const Icon(Icons.restore),
                            label: const Text('Restore Purchases'),
                          ),
                        ),

                        // Purchase Result
                        if (_purchaseResult != null) ...[
                          const SizedBox(height: 16),
                          Card(
                            color: _purchaseResult!.contains('✅')
                                ? Colors.green.shade50
                                : _purchaseResult!.contains('❌')
                                    ? Colors.red.shade50
                                    : Colors.orange.shade50,
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          _purchaseResult!,
                                          style: TextStyle(
                                            color: _purchaseResult!
                                                    .contains('✅')
                                                ? Colors.green
                                                : _purchaseResult!.contains('❌')
                                                    ? Colors.red
                                                    : Colors.orange,
                                          ),
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.close, size: 18),
                                        onPressed: () {
                                          setState(() {
                                            _purchaseResult = null;
                                          });
                                        },
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(),
                                      ),
                                    ],
                                  ),
                                  if (_currentActiveSubscription != null) ...[
                                    const SizedBox(height: 12),
                                    Text(
                                      'View subscription details above in the Active Subscriptions section',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontStyle: FontStyle.italic,
                                        color: Colors.grey.shade600,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
    );
  }
}
