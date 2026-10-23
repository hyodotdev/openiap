import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import '../app_purchase_flow.dart';
import '../widgets/product_detail_modal.dart';
import '../widgets/app_ownership_card.dart';
import '../widgets/purchase_detail_view.dart';
import '../constants.dart';

class PurchaseFlowScreen extends StatefulWidget {
  const PurchaseFlowScreen({super.key, this.purchases});

  final AppPurchaseFlow? purchases;

  @override
  State<PurchaseFlowScreen> createState() => _PurchaseFlowScreenState();
}

class _PurchaseFlowScreenState extends State<PurchaseFlowScreen> {
  late final AppPurchaseFlow _purchases =
      widget.purchases ?? AppPurchaseFlow.instance;
  FlutterInappPurchase get _iap => _purchases.iap;

  // Use product IDs from constants
  final List<String> productIds = IapConstants.inAppProductIds;

  List<ProductCommon> _products = [];
  final Map<String, ProductCommon> _originalProducts =
      {}; // Store original products for detail view
  bool _isProcessing = false;
  bool _connected = false;
  bool _loading = false;
  String? _purchaseResult;
  Purchase? _currentPurchase;
  late final StreamSubscription<PurchaseFlowOutcome> _outcomeSubscription;
  late final StreamSubscription<PurchaseError> _purchaseErrorSubscription;

  @override
  void initState() {
    super.initState();
    _outcomeSubscription = _purchases.flow.outcomes.listen(_showOutcome);
    _purchaseErrorSubscription =
        _iap.purchaseErrorListener.listen(_handlePurchaseError);
    _awaitConnection(_purchases.connected);
  }

  @override
  void dispose() {
    _outcomeSubscription.cancel();
    _purchaseErrorSubscription.cancel();
    super.dispose();
  }

  // The app owns the connection; this screen only loads its products.
  Future<void> _awaitConnection(Future<bool> connecting) async {
    if (!mounted) return;
    setState(() {
      _loading = true;
    });

    try {
      final connected = await connecting;
      if (!mounted) return;
      setState(() {
        _connected = connected;
      });
      if (connected) await _loadProducts();
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  // Outcomes arrive through _showOutcome.
  Future<void> _recoverPurchases() async {
    try {
      await _purchases.flow.recoverPurchases();
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

  void _showOutcome(PurchaseFlowOutcome outcome) {
    if (!IapConstants.isInAppPurchase(outcome.purchase.productId)) return;
    debugPrint(
      'Purchase outcome for ${outcome.purchase.productId}: '
      '${describePurchaseFlowStatus(outcome.status).key.value}',
    );
    setState(() {
      _isProcessing = false;
      _currentPurchase = outcome.purchase;
      _purchaseResult = describeOutcome(outcome);
    });
  }

  void _handlePurchaseError(PurchaseError error) {
    setState(() {
      _isProcessing = false;

      _purchaseResult = '''
❌ Purchase Error
Code: ${error.code}
Message: ${error.message}
      '''
          .trim();
    });
  }

  Future<void> _pickVerificationMethod() async {
    final picked = await pickVerificationMethod(
      context,
      _purchases,
      VerificationMethod.values,
    );
    if (picked == null || !mounted) return;
    setState(() {});
    if (picked != VerificationMethod.ignore) unawaited(_recoverPurchases());
  }

  Future<void> _loadProducts() async {
    if (!_connected) return;

    try {
      debugPrint('🔍 Loading products for IDs: ${productIds.join(", ")}');
      // Use explicit type parameter for proper type inference
      final inAppProducts = await _iap.fetchProducts<Product>(
        skus: productIds,
        type: ProductQueryType.InApp,
      );

      debugPrint(
        '📦 Received ${inAppProducts.length} products from fetchProducts',
      );

      // Clear and store original products
      _originalProducts.clear();

      // Store original products
      for (final product in inAppProducts) {
        final productKey = product.id;
        _originalProducts[productKey] = product;

        debugPrint('Product: ${product.id} - ${product.title}');
        debugPrint('  Price: ${product.price ?? 'No price'}');
        debugPrint('  Currency: ${product.currency}');
        debugPrint('  Description: ${product.description}');
      }

      if (!mounted) return;
      setState(() {
        _products = List<ProductCommon>.from(inAppProducts);
      });
    } catch (e) {
      debugPrint('Error loading products: $e');
    }
  }

  Future<void> _handlePurchase(String productId) async {
    debugPrint('🛒 Starting purchase for: $productId');
    debugPrint('📱 Platform: ${defaultTargetPlatform.name}');
    debugPrint('🔗 Connection status: $_connected');

    if (!mounted) return;
    setState(() {
      _isProcessing = true;
      _purchaseResult = null; // Clear previous results
    });

    try {
      // Build platform-specific request and call unified requestPurchase
      final requestProps = RequestPurchaseProps.inApp((
        apple: RequestPurchaseIosProps(sku: productId, quantity: 1),
        google: RequestPurchaseAndroidProps(skus: [productId]),
      ));

      await _iap.requestPurchase(requestProps);

      debugPrint('✅ Purchase request sent successfully');
      // The purchase arrives through the flow's outcomes.
    } catch (error) {
      setState(() {
        _isProcessing = false;
      });

      final code = error is PurchaseError ? error.code : null;
      if (code == ErrorCode.UserCancelled) {
        debugPrint('ℹ️ Purchase cancelled by user - suppressing alert');
        return;
      }

      // Play reports a launch-time code 6 as PurchaseFailed, so check both.
      final transient = code == ErrorCode.ServiceError ||
          (error is PurchaseError && error.responseCode == 6);

      // The user taps Buy again to retry.
      if (mounted) {
        showDialog<void>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Purchase Failed'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Error: $error'),
                  if (transient) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'This is a store service error. Please try:',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text('• Wait a few minutes and try again'),
                    const Text('• Check your internet connection'),
                    const Text('• Restart your device'),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    }
  }

  Future<void> _showPurchaseDetails(Purchase purchase) async {
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom,
            ),
            child: DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.85,
              minChildSize: 0.4,
              maxChildSize: 0.95,
              builder: (context, controller) {
                return SingleChildScrollView(
                  controller: controller,
                  padding: const EdgeInsets.all(16),
                  child: PurchaseDataView(
                    purchase: purchase,
                    statusLabel: 'Latest Purchase',
                    statusColor: Colors.blue.shade600,
                  ),
                );
              },
            ),
          ),
        );
      },
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
          'Purchase Flow',
          style: TextStyle(color: Colors.black),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Connection Status
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _connected ? Colors.green[50] : Colors.red[50],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _connected ? Icons.check_circle : Icons.error,
                        color: _connected ? Colors.green : Colors.red,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _connected ? 'Connected to Store' : 'Not Connected',
                        style: TextStyle(
                          color: _connected ? Colors.green : Colors.red,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Verification Method Selector
                if (_connected) ...[
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
                          'Purchase Verification:',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        OutlinedButton(
                          onPressed: _pickVerificationMethod,
                          child:
                              Text(_purchases.verificationMethod.value.label),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Debug/Test Section
                if (_connected) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Debug Tools',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton.icon(
                              onPressed: _isProcessing
                                  ? null
                                  : () async {
                                      if (!mounted) return;
                                      setState(() {
                                        _isProcessing = true;
                                        _purchaseResult = null;
                                      });
                                      try {
                                        debugPrint(
                                          'Checking available purchases...',
                                        );
                                        final purchases =
                                            await _iap.getAvailablePurchases();
                                        if (!mounted) return;
                                        setState(() {
                                          _purchaseResult = '''
📊 Available Purchases: ${purchases.length}
${purchases.map((p) => '- ${p.productId}: credential ${p.purchaseToken?.isNotEmpty == true ? 'present' : 'missing'}').join('\n')}
                                          '''
                                              .trim();
                                          _isProcessing = false;
                                        });
                                      } catch (e) {
                                        if (!mounted) return;
                                        setState(() {
                                          _purchaseResult =
                                              '❌ Error checking purchases: $e';
                                          _isProcessing = false;
                                        });
                                      }
                                    },
                              icon: const Icon(Icons.history, size: 16),
                              label: const Text('Check Purchases'),
                            ),
                            OutlinedButton.icon(
                              onPressed: _isProcessing
                                  ? null
                                  : () async {
                                      if (!mounted) return;
                                      setState(() {
                                        _isProcessing = true;
                                      });
                                      await _loadProducts();
                                      if (!mounted) return;
                                      setState(() {
                                        _isProcessing = false;
                                      });
                                    },
                              icon: const Icon(Icons.refresh, size: 16),
                              label: const Text('Reload Products'),
                            ),
                            OutlinedButton.icon(
                              onPressed: _isProcessing
                                  ? null
                                  : () async {
                                      if (!mounted) return;
                                      setState(() {
                                        _isProcessing = true;
                                        _purchaseResult = null;
                                      });
                                      try {
                                        await _iap.endConnection();
                                        await _awaitConnection(
                                          _purchases.start(),
                                        );
                                        if (!mounted) return;
                                        setState(() {
                                          _purchaseResult =
                                              '✅ Connection reinitialized';
                                          _isProcessing = false;
                                        });
                                      } catch (e) {
                                        if (!mounted) return;
                                        setState(() {
                                          _purchaseResult = '❌ Error: $e';
                                          _isProcessing = false;
                                        });
                                      }
                                    },
                              icon: const Icon(
                                Icons.power_settings_new,
                                size: 16,
                              ),
                              label: const Text('Re-init Connection'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Purchase Result Card (like KMP-IAP)
                if (_purchaseResult != null) ...[
                  Card(
                    color: _purchaseResult!.contains('✅')
                        ? Colors.green.shade50
                        : _purchaseResult!.contains('❌')
                            ? Colors.red.shade50
                            : _purchaseResult!.contains('⚠️')
                                ? Colors.orange.shade50
                                : Colors.white,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Purchase Result',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close, size: 20),
                                onPressed: () {
                                  setState(() {
                                    _purchaseResult = null;
                                    _currentPurchase = null;
                                  });
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            child: SelectableText(
                              _purchaseResult!,
                              style: const TextStyle(
                                fontSize: 12,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                          if (_currentPurchase != null) ...[
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                onPressed: () =>
                                    _showPurchaseDetails(_currentPurchase!),
                                icon: const Icon(Icons.receipt_long, size: 18),
                                label: const Text('View Purchase Data'),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Products
                if (_products.isEmpty)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text('No products available'),
                    ),
                  )
                else
                  ..._products.map(
                    (product) => GestureDetector(
                      onTap: () => ProductDetailModal.show(
                        context: context,
                        item: product,
                        product: _originalProducts[product.id],
                      ),
                      child: Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: Colors.grey.shade200),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                product.title,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                product.description,
                                style: TextStyle(color: Colors.grey[600]),
                              ),
                              const SizedBox(height: 16),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    product.displayPrice,
                                    style: const TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF007AFF),
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: _isProcessing || !_connected
                                        ? null
                                        : () => _handlePurchase(product.id),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.blue,
                                      foregroundColor: Colors.white,
                                    ),
                                    child: Text(
                                      _isProcessing ? 'Processing...' : 'Buy',
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                AppOwnershipCard(iap: _iap, connected: _connected),
              ],
            ),
    );
  }
}
