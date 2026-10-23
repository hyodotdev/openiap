import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {useActionSheet} from '@expo/react-native-action-sheet';
import {
  requestPurchase,
  useIAP,
  getStorefront,
  type Product,
  type Purchase,
  ErrorCode,
  type ExpoPurchaseError as PurchaseError,
} from 'expo-iap';
import Loading from '../src/components/Loading';
import AppOwnershipCard from '../src/components/AppOwnershipCard';
import PurchaseConfirmationScreen from '../src/components/PurchaseConfirmationScreen';
import usePurchaseFlowScroll from '../src/components/usePurchaseFlowScroll';
import ExampleButton from '../src/components/ExampleButton';
import StoreProductCard from '../src/components/StoreProductCard';
import PurchaseFlowDiagram, {
  receiptOutcome,
  usePurchaseFlowActivity,
} from '../src/components/PurchaseFlowDiagram';
import {
  CONSUMABLE_PRODUCT_IDS,
  NON_CONSUMABLE_PRODUCT_IDS,
  PRODUCT_IDS,
} from '../src/utils/constants';
import PurchaseDetails from '../src/components/PurchaseDetails';
import PurchaseSummaryRow from '../src/components/PurchaseSummaryRow';
import {formatErrorForDisplay} from '../src/utils/errorUtils';
import {useVegaTvSelection} from '../src/hooks/useVegaTvSelection';
import {
  alertPurchaseOutcome,
  describePurchaseOutcome,
  getReceiptPurchaseFlow,
  getVerificationMethod,
  setVerificationMethod,
} from '../src/utils/purchaseFlow';
import type {VerificationMethod} from '../src/utils/vegaRuntime';

const CONSUMABLE_PRODUCT_ID_SET = new Set(CONSUMABLE_PRODUCT_IDS);
const NON_CONSUMABLE_PRODUCT_ID_SET = new Set(NON_CONSUMABLE_PRODUCT_IDS);

const deduplicatePurchases = (purchases: Purchase[]): Purchase[] => {
  const uniquePurchases = new Map<string, Purchase>();

  for (const purchase of purchases) {
    const productId = purchase.productId;
    if (!productId) {
      continue;
    }

    const existingPurchase = uniquePurchases.get(productId);
    if (!existingPurchase) {
      uniquePurchases.set(productId, purchase);
      continue;
    }

    const existingTimestamp = existingPurchase.transactionDate ?? 0;
    const newTimestamp = purchase.transactionDate ?? 0;

    if (newTimestamp > existingTimestamp) {
      uniquePurchases.set(productId, purchase);
    }
  }

  return Array.from(uniquePurchases.values());
};

type PurchaseFlowProps = {
  connected: boolean;
  products: Product[];
  availablePurchases: Purchase[];
  purchaseResult: string;
  isProcessing: boolean;
  lastPurchase: Purchase | null;
  refreshingAvailablePurchases: boolean;
  onPurchase: (productId: string) => void;
  onRefreshAvailablePurchases: () => Promise<void>;
  storefront: string;
  storefrontError: string | null;
  storefrontLoading: boolean;
  onRefreshStorefront: () => Promise<void>;
  verificationMethod: VerificationMethod;
  onChangeVerificationMethod: () => void;
  activity: ReturnType<typeof usePurchaseFlowActivity>['activity'];
};

/**
 * Purchase Flow example: one-time in-app products. Each purchase's result
 * arrives as an outcome of the app's purchase flow.
 */

function PurchaseFlow({
  connected,
  products,
  availablePurchases,
  purchaseResult,
  isProcessing,
  lastPurchase,
  refreshingAvailablePurchases,
  onPurchase,
  onRefreshAvailablePurchases,
  storefront,
  storefrontError,
  storefrontLoading,
  onRefreshStorefront,
  verificationMethod,
  onChangeVerificationMethod,
  activity,
}: PurchaseFlowProps) {
  const {
    setScrollView,
    expanded,
    changeExpanded,
    beginPurchase,
    onScroll,
    onScrollBeginDrag,
    onContentLayout,
    onDiagramLayout,
    onDiagramBodyLayout,
    onStepLayout,
  } = usePurchaseFlowScroll(activity);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [purchaseDetailsVisible, setPurchaseDetailsVisible] = useState(false);
  const [purchaseDetailsTarget, setPurchaseDetailsTarget] =
    useState<Purchase | null>(null);

  const availablePurchaseRows = React.useMemo(
    () => deduplicatePurchases(availablePurchases),
    [availablePurchases],
  );

  const ownedNonConsumableIds = React.useMemo(() => {
    const ids = new Set<string>();

    for (const purchase of availablePurchaseRows) {
      if (
        purchase.productId &&
        NON_CONSUMABLE_PRODUCT_ID_SET.has(purchase.productId)
      ) {
        ids.add(purchase.productId);
      }
    }

    return ids;
  }, [availablePurchaseRows]);

  const visibleProducts = React.useMemo(() => {
    if (ownedNonConsumableIds.size === 0) {
      return products;
    }

    return products.filter((product) => {
      if (!product.id) {
        return true;
      }

      return !(
        NON_CONSUMABLE_PRODUCT_ID_SET.has(product.id) &&
        ownedNonConsumableIds.has(product.id)
      );
    });
  }, [ownedNonConsumableIds, products]);

  const hasHiddenNonConsumables = products.length > visibleProducts.length;

  const handlePurchase = useCallback(
    (itemId: string) => {
      beginPurchase(itemId);
      onPurchase(itemId);
    },
    [onPurchase, beginPurchase],
  );

  const {
    selectedIndex: tvSelectedProductIndex,
    setSelectedIndex: setTvSelectedProductIndex,
  } = useVegaTvSelection({
    itemCount: visibleProducts.length,
  });

  const handleCopyResult = async () => {
    if (purchaseResult) {
      await Clipboard.setStringAsync(purchaseResult);
      Alert.alert('Copied', 'Purchase result copied to clipboard');
    }
  };

  const handleShowDetails = (product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const handleRefreshAvailablePurchases = useCallback(() => {
    return onRefreshAvailablePurchases();
  }, [onRefreshAvailablePurchases]);

  // Show loading screen while disconnected
  if (!connected) {
    return <Loading message="Connecting to Store..." />;
  }

  return (
    <ScrollView
      ref={setScrollView}
      style={styles.container}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onScrollBeginDrag={onScrollBeginDrag}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Pay, verify, finish</Text>
        <Text style={styles.subtitle}>
          Buy a one-time product, verify the payment, then finish the
          transaction.
        </Text>
      </View>

      <View style={styles.content} onLayout={onContentLayout}>
        <PurchaseFlowDiagram
          activity={activity}
          expanded={expanded}
          onExpandedChange={changeExpanded}
          onLayout={onDiagramLayout}
          onBodyLayout={onDiagramBodyLayout}
          onStepLayout={onStepLayout}
        />
        {/* Connection Status */}
        <View style={styles.statusContainer}>
          <Text
            style={[
              styles.statusValue,
              {color: connected ? '#4CAF50' : '#F44336'},
            ]}
          >
            {connected ? '✅ Connected' : '❌ Disconnected'}
          </Text>
        </View>

        {/* Verification Method Selector */}
        <View style={styles.verificationContainer}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.verificationButton}
            onPress={onChangeVerificationMethod}
          >
            <View>
              <Text style={styles.verificationButtonHint}>
                Receipt verification
              </Text>
              <Text style={styles.verificationButtonText}>
                {verificationMethod === 'ignore'
                  ? 'None (Skip)'
                  : verificationMethod === 'local'
                  ? 'Local (Device)'
                  : verificationMethod === 'iapkit-localhost'
                  ? 'Local (IAPKit)'
                  : 'IAPKit'}
              </Text>
            </View>
            <Text style={styles.changeLabel}>Change ›</Text>
          </TouchableOpacity>
        </View>

        {/* Products List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Products</Text>
          <Text style={styles.sectionSubtitle}>
            {visibleProducts.length > 0
              ? `${visibleProducts.length} product(s) available`
              : hasHiddenNonConsumables
              ? 'All non-consumable products already purchased'
              : 'Loading products...'}
          </Text>

          {visibleProducts.map((product, index) => (
            <StoreProductCard
              key={product.id}
              product={product}
              kind={
                CONSUMABLE_PRODUCT_ID_SET.has(product.id)
                  ? 'Consumable product'
                  : NON_CONSUMABLE_PRODUCT_ID_SET.has(product.id)
                  ? 'Non-consumable product'
                  : 'In-app product'
              }
            >
              <ExampleButton
                title={isProcessing ? 'Processing...' : 'Purchase'}
                accessibilityLabel={`Purchase ${
                  product.displayName || product.title
                }`}
                focusable={true}
                hasTVPreferredFocus={
                  (Platform.isTV || String(Platform.OS) === 'kepler') &&
                  index === tvSelectedProductIndex
                }
                style={[
                  styles.productAction,
                  (Platform.isTV || String(Platform.OS) === 'kepler') &&
                    index === tvSelectedProductIndex &&
                    styles.tvFocusedButton,
                  isProcessing && {opacity: 0.5},
                ]}
                onPress={() => handlePurchase(product.id)}
                onFocus={() => setTvSelectedProductIndex(index)}
                disabled={isProcessing}
              />
              <ExampleButton
                title="Details"
                variant="secondary"
                accessibilityLabel={`Details for ${
                  product.displayName || product.title
                }`}
                focusable={true}
                onPress={() => handleShowDetails(product)}
              />
            </StoreProductCard>
          ))}

          {visibleProducts.length === 0 && connected && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {hasHiddenNonConsumables
                  ? 'All available non-consumable products have already been purchased.'
                  : 'No products available. Please check your app store configuration.'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.storefrontContainer}>
          <View style={styles.storefrontRow}>
            <Text style={styles.statusLabel}>Storefront:</Text>
            <Text
              style={[
                styles.storefrontValue,
                storefrontError ? styles.storefrontErrorValue : null,
              ]}
            >
              {storefrontLoading
                ? 'Fetching…'
                : storefront
                ? storefront
                : storefrontError
                ? 'Unavailable'
                : 'Not available'}
            </Text>
          </View>
          {storefrontError ? (
            <Text style={styles.storefrontErrorText}>{storefrontError}</Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.storefrontRefreshButton,
              storefrontLoading && {opacity: 0.6},
            ]}
            onPress={() => {
              void onRefreshStorefront();
            }}
            disabled={storefrontLoading}
          >
            <Text style={styles.storefrontRefreshButtonText}>
              {storefrontLoading
                ? 'Refreshing storefront…'
                : 'Refresh storefront'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Available Purchases */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Purchases</Text>
          <Text style={styles.sectionSubtitle}>
            {availablePurchaseRows.length > 0
              ? `${availablePurchaseRows.length} stored purchase(s)`
              : 'Purchase a non-consumable to view it here'}
          </Text>

          {availablePurchaseRows.length > 0 ? (
            availablePurchaseRows.map((purchase) => (
              <PurchaseSummaryRow
                key={`${purchase.productId ?? 'unknown'}-${
                  purchase.transactionDate ?? purchase.id ?? 'na'
                }`}
                purchase={purchase}
                onPress={() => {
                  setPurchaseDetailsTarget(purchase);
                  setPurchaseDetailsVisible(true);
                }}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No saved purchases yet. Complete a non-consumable purchase to
                see it listed here.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.refreshButton,
              refreshingAvailablePurchases && {opacity: 0.6},
            ]}
            onPress={handleRefreshAvailablePurchases}
            disabled={refreshingAvailablePurchases}
          >
            <Text style={styles.refreshButtonText}>
              {refreshingAvailablePurchases
                ? 'Refreshing purchases...'
                : 'Refresh available purchases'}
            </Text>
          </TouchableOpacity>
        </View>

        {purchaseResult || lastPurchase ? (
          <View style={styles.resultContainer}>
            {purchaseResult ? (
              <>
                <Text style={styles.resultTitle}>Latest Status</Text>
                <Text style={styles.resultText}>{purchaseResult}</Text>
              </>
            ) : null}
            {lastPurchase ? (
              <View style={{marginTop: 8}}>
                <Text style={styles.resultSubtitle}>Latest Purchase</Text>
                <PurchaseSummaryRow
                  purchase={lastPurchase}
                  onPress={() => {
                    setPurchaseDetailsTarget(lastPurchase);
                    setPurchaseDetailsVisible(true);
                  }}
                />
              </View>
            ) : null}
            {purchaseResult ? (
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyResult}
              >
                <Text style={styles.copyButtonText}>📋 Copy Message</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <AppOwnershipCard />

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to test:</Text>
          <Text style={styles.instructionsText}>
            1. Make sure you are signed in with a Sandbox account
          </Text>
          <Text style={styles.instructionsText}>
            2. Configure products in the selected store console
          </Text>
          <Text style={styles.instructionsText}>
            3. Tap Purchase to initiate the transaction
          </Text>
          <Text style={styles.instructionsText}>
            4. The purchase flow verifies and finishes the transaction
          </Text>
          <Text style={styles.instructionsText}>
            5. Server-side receipt validation is recommended for production
          </Text>
        </View>
      </View>

      {/* Product Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollContent}>
            <View style={styles.modalInnerContent}>
              <Text style={styles.modalTitle}>Product Details</Text>
              {selectedProduct ? (
                <>
                  <Text style={styles.modalLabel}>Product ID:</Text>
                  <Text style={styles.modalValue}>{selectedProduct.id}</Text>

                  <Text style={styles.modalLabel}>Title:</Text>
                  <Text style={styles.modalValue}>{selectedProduct.title}</Text>

                  <Text style={styles.modalLabel}>Description:</Text>
                  <Text style={styles.modalValue}>
                    {selectedProduct.description}
                  </Text>

                  <Text style={styles.modalLabel}>Price:</Text>
                  <Text style={styles.modalValue}>
                    {selectedProduct.displayPrice}
                  </Text>

                  <Text style={styles.modalLabel}>Currency:</Text>
                  <Text style={styles.modalValue}>
                    {selectedProduct.currency || 'N/A'}
                  </Text>

                  <Text style={styles.modalLabel}>Type:</Text>
                  <Text style={styles.modalValue}>
                    {selectedProduct.type || 'N/A'}
                  </Text>

                  {'isFamilyShareableIOS' in selectedProduct && (
                    <>
                      <Text style={styles.modalLabel}>
                        Is Family Shareable:
                      </Text>
                      <Text style={styles.modalValue}>
                        {selectedProduct.isFamilyShareableIOS ? 'Yes' : 'No'}
                      </Text>
                    </>
                  )}

                  {/* Discount Offers (Cross-platform) */}
                  {'discountOffers' in selectedProduct &&
                    selectedProduct.discountOffers &&
                    Array.isArray(selectedProduct.discountOffers) &&
                    selectedProduct.discountOffers.length > 0 && (
                      <View style={styles.offersSection}>
                        <Text style={styles.offersSectionTitle}>
                          Discount Offers (
                          {selectedProduct.discountOffers.length})
                        </Text>
                        {selectedProduct.discountOffers.map((offer, idx) => (
                          <View key={offer.id || idx} style={styles.offerCard}>
                            <Text style={styles.offerTitle}>
                              {offer.id || `Offer ${idx + 1}`}
                            </Text>
                            <Text style={styles.offerDetail}>
                              Price: {offer.displayPrice}
                            </Text>
                            {offer.fullPriceMicrosAndroid != null && (
                              <Text style={styles.offerDetail}>
                                Full Price (micros):{' '}
                                {offer.fullPriceMicrosAndroid}
                              </Text>
                            )}
                            {(offer.percentageDiscountAndroid ?? 0) > 0 && (
                              <Text style={styles.offerDetail}>
                                {offer.percentageDiscountAndroid}% off
                              </Text>
                            )}
                            {offer.formattedDiscountAmountAndroid && (
                              <Text style={styles.offerDetail}>
                                Discount: {offer.formattedDiscountAmountAndroid}
                              </Text>
                            )}
                            {offer.validTimeWindowAndroid && (
                              <Text style={styles.offerDetail}>
                                Valid:{' '}
                                {new Date(
                                  Number(
                                    offer.validTimeWindowAndroid
                                      .startTimeMillis,
                                  ),
                                ).toLocaleDateString()}{' '}
                                -{' '}
                                {new Date(
                                  Number(
                                    offer.validTimeWindowAndroid.endTimeMillis,
                                  ),
                                ).toLocaleDateString()}
                              </Text>
                            )}
                            {offer.limitedQuantityInfoAndroid && (
                              <Text style={styles.offerDetail}>
                                Remaining:{' '}
                                {
                                  offer.limitedQuantityInfoAndroid
                                    .remainingQuantity
                                }{' '}
                                /{' '}
                                {
                                  offer.limitedQuantityInfoAndroid
                                    .maximumQuantity
                                }
                              </Text>
                            )}
                            {offer.preorderDetailsAndroid && (
                              <Text style={styles.offerDetail}>
                                Release:{' '}
                                {new Date(
                                  Number(
                                    offer.preorderDetailsAndroid
                                      .preorderReleaseTimeMillis,
                                  ),
                                ).toLocaleDateString()}
                              </Text>
                            )}
                            {offer.rentalDetailsAndroid && (
                              <Text style={styles.offerDetail}>
                                Rental Period:{' '}
                                {
                                  offer.rentalDetailsAndroid
                                    .rentalExpirationPeriod
                                }
                              </Text>
                            )}
                            {Array.isArray(offer.offerTagsAndroid) &&
                              offer.offerTagsAndroid.length > 0 && (
                                <Text style={styles.offerDetail}>
                                  Tags: {offer.offerTagsAndroid.join(', ')}
                                </Text>
                              )}
                          </View>
                        ))}
                      </View>
                    )}
                </>
              ) : null}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Purchase Details Modal */}
      <Modal
        visible={purchaseDetailsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setPurchaseDetailsVisible(false);
          setPurchaseDetailsTarget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Purchase Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setPurchaseDetailsVisible(false);
                  setPurchaseDetailsTarget(null);
                }}
                style={styles.modalCloseIconButton}
              >
                <Text style={styles.modalCloseIconText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {purchaseDetailsTarget ? (
                <PurchaseDetails
                  purchase={purchaseDetailsTarget}
                  containerStyle={styles.purchaseDetailsContainer}
                  rowStyle={styles.purchaseDetailRow}
                  labelStyle={styles.modalLabel}
                  valueStyle={styles.modalValue}
                />
              ) : (
                <Text style={styles.modalValue}>No purchase selected.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/**
 * PurchaseFlowContainer: one-time products through the app's receipt-check
 * flow (src/utils/purchaseFlow.ts).
 * 1. useIAP connects. Given `purchaseFlow`, it also recovers unfinished
 *    purchases, reports each outcome, and refreshes ownership afterwards.
 * 2. requestPurchase opens the store sheet; the purchase arrives as an outcome.
 * 3. The flow checks the receipt with the selected method, credits a
 *    consumable in `grant`, then finishes the transaction.
 */
function PurchaseFlowContainer() {
  const {activity, startStore, observeOutcome, storeError} =
    usePurchaseFlowActivity();
  const purchaseRequestTrace = useRef('');
  const purchaseRequestPendingRef = useRef(false);
  const [purchaseResult, setPurchaseResult] = useState<string>('');
  // From requestPurchase until that product's outcome or a purchase error.
  const [processingProductId, setProcessingProductId] = useState<string | null>(
    null,
  );
  const [lastPurchase, setLastPurchase] = useState<Purchase | null>(null);
  const [refreshingAvailablePurchases, setRefreshingAvailablePurchases] =
    useState(false);
  const [storefront, setStorefront] = useState('');
  const [storefrontError, setStorefrontError] = useState<string | null>(null);
  const [storefrontLoading, setStorefrontLoading] = useState(true);
  const [verificationMethod, setMethod] = useState(getVerificationMethod);
  const {showActionSheetWithOptions} = useActionSheet();

  const showPurchaseError = useCallback(
    (error: PurchaseError, requestTrace: string): void => {
      storeError(requestTrace, error.code);
      setProcessingProductId(null);
      setPurchaseResult(
        error.code === ErrorCode.UserCancelled
          ? 'Purchase cancelled by user'
          : error.code === ErrorCode.DeferredPayment
          ? 'Payment is pending at the store.'
          : `Purchase failed: ${formatErrorForDisplay(
              error,
              ErrorCode.PurchaseError,
            )}`,
      );
    },
    [storeError],
  );

  const {
    connected,
    products,
    availablePurchases,
    fetchProducts,
    getAvailablePurchases,
  } = useIAP({
    purchaseFlow: getReceiptPurchaseFlow(),
    onPurchaseFlowOutcome: ({purchase, status}) => {
      if (!PRODUCT_IDS.includes(purchase.productId)) return;
      observeOutcome(purchase, receiptOutcome(status));
      setLastPurchase(purchase);
      setProcessingProductId((current) =>
        current === purchase.productId ? null : current,
      );
      setPurchaseResult(describePurchaseOutcome(status));
      alertPurchaseOutcome(status);
    },
    onPurchaseError: (error: PurchaseError) =>
      showPurchaseError(error, purchaseRequestTrace.current),
  });

  useEffect(() => {
    if (!connected) return;
    fetchProducts({skus: PRODUCT_IDS, type: 'in-app'}).catch((error) => {
      const message = formatErrorForDisplay(error, ErrorCode.QueryProduct);
      setPurchaseResult(`Product loading failed: ${message}`);
    });
    getAvailablePurchases().catch((error) => {
      console.log('[PurchaseFlow] getAvailablePurchases error:', error);
    });
  }, [connected, fetchProducts, getAvailablePurchases]);

  const handleRefreshAvailablePurchases = useCallback(async () => {
    if (refreshingAvailablePurchases) {
      return;
    }

    setRefreshingAvailablePurchases(true);
    try {
      await getAvailablePurchases();
    } catch (error) {
      console.log(
        '[PurchaseFlow] Failed to refresh available purchases manually:',
        error,
      );
      Alert.alert('Refresh Failed', 'Could not refresh available purchases.');
    } finally {
      setRefreshingAvailablePurchases(false);
    }
  }, [getAvailablePurchases, refreshingAvailablePurchases]);

  // requestPurchase takes an Apple request, a Google request, or both. A
  // Google subscription also passes subscriptionOffers with an offerToken.
  const handlePurchase = useCallback(
    (productId: string) => {
      // Presses can arrive before the disabled button rerenders.
      if (purchaseRequestPendingRef.current) return;
      purchaseRequestPendingRef.current = true;
      const requestTrace = startStore(productId);
      purchaseRequestTrace.current = requestTrace;
      setProcessingProductId(productId);
      setPurchaseResult('Processing purchase...');

      requestPurchase({
        request: {
          apple: {sku: productId, quantity: 1},
          google: {skus: [productId]},
        },
        type: 'in-app',
      })
        .catch((error: PurchaseError) => showPurchaseError(error, requestTrace))
        .finally(() => {
          purchaseRequestPendingRef.current = false;
        });
    },
    [showPurchaseError, startStore],
  );

  const handleChangeVerificationMethod = useCallback(() => {
    const choices: {label: string; method: VerificationMethod}[] = [
      {label: 'Local (Device)', method: 'local'},
      {label: 'Local (IAPKit)', method: 'iapkit-localhost'},
      {label: 'IAPKit', method: 'iapkit'},
      {label: 'None (Skip)', method: 'ignore'},
    ];

    showActionSheetWithOptions(
      {
        options: [...choices.map(({label}) => label), 'Cancel'],
        cancelButtonIndex: choices.length,
        title: 'Select Verification Method',
        message: 'Verify purchases before completing the transaction',
      },
      (buttonIndex) => {
        const choice = buttonIndex == null ? undefined : choices[buttonIndex];
        if (!choice) return;
        setVerificationMethod(choice.method);
        setMethod(choice.method);
      },
    );
  }, [showActionSheetWithOptions]);

  const loadStorefront = useCallback(() => {
    return getStorefront()
      .then((code) => {
        setStorefront(code ?? '');
        setStorefrontError(null);
      })
      .catch((error: unknown) => {
        console.log('[PurchaseFlow] getStorefront error:', error);
        setStorefrontError(
          error instanceof Error ? error.message : 'Failed to load storefront',
        );
        setStorefront('');
      })
      .finally(() => setStorefrontLoading(false));
  }, []);

  useEffect(() => {
    if (connected) void loadStorefront();
  }, [connected, loadStorefront]);

  const handleRefreshStorefront = useCallback(() => {
    setStorefrontLoading(true);
    setStorefrontError(null);
    return loadStorefront();
  }, [loadStorefront]);

  return (
    <PurchaseFlow
      connected={connected}
      products={products}
      availablePurchases={availablePurchases}
      purchaseResult={purchaseResult}
      isProcessing={processingProductId !== null}
      lastPurchase={lastPurchase}
      refreshingAvailablePurchases={refreshingAvailablePurchases}
      onPurchase={handlePurchase}
      onRefreshAvailablePurchases={handleRefreshAvailablePurchases}
      storefront={connected ? storefront : ''}
      storefrontError={connected ? storefrontError : null}
      storefrontLoading={connected && storefrontLoading}
      onRefreshStorefront={handleRefreshStorefront}
      verificationMethod={verificationMethod}
      onChangeVerificationMethod={handleChangeVerificationMethod}
      activity={activity}
    />
  );
}

// Only the selected confirmation path owns a purchase listener.
export default function PurchaseFlowScreen() {
  return (
    <PurchaseConfirmationScreen productType="in-app">
      <PurchaseFlowContainer />
    </PurchaseConfirmationScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  productAction: {flex: 1},
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
  },
  content: {
    padding: 20,
    paddingBottom: 64,
    gap: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  storefrontContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 15,
    gap: 8,
  },
  storefrontRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storefrontValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D47A1',
  },
  storefrontErrorValue: {
    color: '#D32F2F',
  },
  storefrontErrorText: {
    fontSize: 12,
    color: '#D32F2F',
  },
  storefrontRefreshButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  storefrontRefreshButtonText: {
    color: '#1E40AF',
    fontWeight: '600',
    fontSize: 13,
  },
  verificationContainer: {
    marginBottom: 15,
  },
  verificationButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  verificationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  verificationButtonHint: {
    fontSize: 12,
    color: '#666',
  },
  changeLabel: {fontSize: 14, fontWeight: '600', color: '#1E40AF'},
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  tvFocusedButton: {
    borderColor: '#0F172A',
    borderWidth: 3,
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  resultContainer: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 12,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  copyButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
    minHeight: 44,
    justifyContent: 'center',
  },
  copyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  refreshButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  instructions: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 15,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    color: '#e65100',
  },
  instructionsText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalScrollContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
  },
  modalInnerContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalCloseIconButton: {
    padding: 4,
  },
  modalCloseIconText: {
    fontSize: 22,
    color: '#666',
  },
  modalLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
    marginBottom: 5,
  },
  modalValue: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  purchaseDetailsContainer: {
    gap: 10,
  },
  purchaseDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  offersSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  offersSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  offerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 6,
  },
  offerDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});
