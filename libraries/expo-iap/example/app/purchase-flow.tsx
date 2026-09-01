import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
  getAppTransactionIOS,
  getPendingTransactionsIOS,
  getStorefront,
} from '../../src';
import Loading from '../src/components/Loading';
import {
  CONSUMABLE_PRODUCT_IDS,
  NON_CONSUMABLE_PRODUCT_IDS,
  PRODUCT_IDS,
} from '../src/utils/constants';
import type {
  Product,
  Purchase,
  VerifyPurchaseWithProviderProps,
} from '../../src/types';
import {ErrorCode} from '../../src/types';
import type {PurchaseError} from '../../src/utils/errorMapping';
import PurchaseDetails from '../src/components/PurchaseDetails';
import PurchaseSummaryRow from '../src/components/PurchaseSummaryRow';
import {formatErrorForDisplay} from '../src/utils/errorUtils';
import {useVegaTvSelection} from '../src/hooks/useVegaTvSelection';
import {
  createIapkitVerificationPayload,
  getDefaultVerificationMethod,
  getDirectVerificationError,
  getIapkitVerificationError,
  getPurchaseCleanupKey,
  rememberCompletedPurchaseKey,
  resolveIapkitVerificationBaseUrl,
  showNativeAlert,
  type VerificationMethod,
} from '../src/utils/vegaRuntime';

const CONSUMABLE_PRODUCT_ID_SET = new Set(CONSUMABLE_PRODUCT_IDS);
const NON_CONSUMABLE_PRODUCT_ID_SET = new Set(NON_CONSUMABLE_PRODUCT_IDS);

type InFlightPurchaseTask = {
  result: Promise<'abandoned' | 'failed' | 'finished'>;
  complete: (result: 'abandoned' | 'failed' | 'finished') => void;
};

const inFlightPurchaseTasks = new Map<string, InFlightPurchaseTask>();
const completedPurchaseKeys = new Set<string>();

function isPurchaseFlowProduct(productId: string): boolean {
  return (
    CONSUMABLE_PRODUCT_ID_SET.has(productId) ||
    NON_CONSUMABLE_PRODUCT_ID_SET.has(productId)
  );
}

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
};

/**
 * Purchase Flow Example - In-App Products
 *
 * Demonstrates useIAP hook approach for in-app products:
 * - Uses useIAP hook for purchase management
 * - Handles purchase callbacks with proper types
 * - No manual promise handling required
 * - Clean success/error pattern through hooks
 * - Focused on one-time purchases (products)
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
}: PurchaseFlowProps) {
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

  // Load products when component mounts (guard against dev double-invoke)
  const handlePurchase = useCallback(
    (itemId: string) => {
      onPurchase(itemId);
    },
    [onPurchase],
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

  const checkAppTransaction = async () => {
    try {
      console.log('Checking app transaction...');
      const transaction = await getAppTransactionIOS();

      if (transaction) {
        Alert.alert(
          'App Transaction',
          `App Transaction Found:\n\n` +
            `Original App Version: ${
              transaction.originalAppVersion || 'N/A'
            }\n` +
            `Purchase Date: ${
              transaction.originalPurchaseDate
                ? new Date(
                    transaction.originalPurchaseDate,
                  ).toLocaleDateString()
                : 'N/A'
            }\n` +
            `Device Verification: ${
              transaction.deviceVerification || 'N/A'
            }\n` +
            `Environment: ${transaction.environment || 'N/A'}`,
          [{text: 'OK'}],
        );
      } else {
        Alert.alert('App Transaction', 'No app transaction found');
      }
    } catch (error) {
      console.log('Failed to get app transaction:', error);
      Alert.alert('Error', 'Failed to get app transaction');
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>In-App Purchase Flow</Text>
        <Text style={styles.subtitle}>
          Testing consumable and non-consumable products
        </Text>
      </View>

      <View style={styles.content}>
        {/* Connection Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Store Connection:</Text>
          <Text
            style={[
              styles.statusValue,
              {color: connected ? '#4CAF50' : '#F44336'},
            ]}
          >
            {connected ? '✅ Connected' : '❌ Disconnected'}
          </Text>
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

        {/* Verification Method Selector */}
        <View style={styles.verificationContainer}>
          <Text style={styles.statusLabel}>Purchase Verification:</Text>
          <TouchableOpacity
            style={styles.verificationButton}
            onPress={onChangeVerificationMethod}
          >
            <Text style={styles.verificationButtonText}>
              {verificationMethod === 'ignore'
                ? 'None (Skip)'
                : verificationMethod === 'local'
                ? 'Local (Device)'
                : verificationMethod === 'iapkit-localhost'
                ? 'Local (IAPKit)'
                : 'IAPKit'}
            </Text>
            <Text style={styles.verificationButtonHint}>Tap to change</Text>
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
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productHeader}>
                <Text style={styles.productTitle}>{product.title}</Text>
                <Text style={styles.productPrice}>{product.displayPrice}</Text>
              </View>
              <Text style={styles.productDescription}>
                {product.description}
              </Text>
              <Text
                style={[
                  styles.productBadgeText,
                  CONSUMABLE_PRODUCT_ID_SET.has(product.id)
                    ? styles.productBadgeConsumable
                    : NON_CONSUMABLE_PRODUCT_ID_SET.has(product.id)
                    ? styles.productBadgeNonConsumable
                    : null,
                ]}
              >
                {CONSUMABLE_PRODUCT_ID_SET.has(product.id)
                  ? 'Consumable product'
                  : NON_CONSUMABLE_PRODUCT_ID_SET.has(product.id)
                  ? 'Non-consumable product'
                  : 'In-app product'}
              </Text>
              <View style={styles.productActions}>
                <TouchableOpacity
                  focusable={true}
                  hasTVPreferredFocus={index === tvSelectedProductIndex}
                  style={[
                    styles.purchaseButton,
                    index === tvSelectedProductIndex && styles.tvFocusedButton,
                    isProcessing && {opacity: 0.5},
                  ]}
                  onPress={() => handlePurchase(product.id)}
                  onFocus={() => setTvSelectedProductIndex(index)}
                  disabled={isProcessing}
                >
                  <Text style={styles.purchaseButtonText}>
                    {isProcessing ? 'Processing...' : `Purchase`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  focusable={true}
                  style={styles.detailsButton}
                  onPress={() => handleShowDetails(product)}
                >
                  <Text style={styles.detailsButtonText}>Details</Text>
                </TouchableOpacity>
              </View>
            </View>
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

        {/* App Transaction Check (iOS) */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appTransactionButton}
            onPress={checkAppTransaction}
          >
            <Text style={styles.appTransactionButtonText}>
              🔍 Check App Transaction (iOS 16+)
            </Text>
          </TouchableOpacity>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to test:</Text>
          <Text style={styles.instructionsText}>
            1. Make sure you're signed in with a Sandbox account
          </Text>
          <Text style={styles.instructionsText}>
            2. Products must be configured in App Store Connect
          </Text>
          <Text style={styles.instructionsText}>
            3. Tap "Purchase" to initiate the transaction
          </Text>
          <Text style={styles.instructionsText}>
            4. The transaction will be processed via the hook callbacks
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
                            {offer.fullPriceMicrosAndroid && (
                              <Text style={styles.offerDetail}>
                                Full Price (micros):{' '}
                                {offer.fullPriceMicrosAndroid}
                              </Text>
                            )}
                            {offer.percentageDiscountAndroid && (
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
 * PurchaseFlowContainer - Main IAP Flow Controller
 *
 * IAP Flow Steps:
 * ============================================================
 * 1. initConnection     - Store connection (handled by useIAP)
 * 2. subscribeEvent     - Event subscription (onPurchaseSuccess/onPurchaseError)
 * 3. requestPurchase    - 3 options: Apple, Google, Google with offers
 * 4. verify purchase - local device | local IAPKit | hosted IAPKit | skip
 * 5. grant entitlement  - Update availablePurchases state
 * 6. finish transaction - Call finishTransaction to complete
 * ============================================================
 */
function PurchaseFlowContainer() {
  // ============================================================
  // State Management
  // ============================================================
  const [purchaseResult, setPurchaseResult] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPurchase, setLastPurchase] = useState<Purchase | null>(null);
  const [refreshingAvailablePurchases, setRefreshingAvailablePurchases] =
    useState(false);
  const [storefront, setStorefront] = useState('');
  const [storefrontError, setStorefrontError] = useState<string | null>(null);
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod>(getDefaultVerificationMethod());
  const verificationMethodRef = useRef<VerificationMethod>(verificationMethod);

  // Keep ref in sync with state
  useEffect(() => {
    verificationMethodRef.current = verificationMethod;
  }, [verificationMethod]);

  const {showActionSheetWithOptions} = useActionSheet();
  const cleanupPurchaseKeysRef = useRef(new Set<string>());
  const purchaseSuccessHandlerRef = useRef<
    (purchase: Purchase) => Promise<void>
  >(async () => {});
  const retryPurchaseRef = useRef<(purchase: Purchase) => Promise<void>>(
    async () => {},
  );
  const purchaseQueueTailRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);

  // ============================================================
  // Step 1: initConnection
  // Step 2: subscribeEvent (onPurchaseSuccess, onPurchaseError)
  // ============================================================
  // Step 2: subscribeEvent - onPurchaseSuccess callback
  // This handles both new and restored purchases through one verified path.
  const handlePurchaseSuccess = async (purchase: Purchase): Promise<void> => {
    if (!mountedRef.current) return;

    const purchaseCleanupKey = getPurchaseCleanupKey(purchase);

    console.log('Purchase successful:', purchase.productId);
    console.log('[PurchaseFlow] purchaseState:', purchase.purchaseState);
    const productId = purchase.productId ?? '';
    if (!isPurchaseFlowProduct(productId)) {
      console.log('[PurchaseFlow] ignoring non-purchase-flow product:', {
        productId,
      });
      cleanupPurchaseKeysRef.current.delete(purchaseCleanupKey);
      return;
    }

    if (completedPurchaseKeys.has(purchaseCleanupKey)) {
      console.log('[PurchaseFlow] ignoring duplicate purchase callback:', {
        productId,
      });
      return;
    }
    const inFlightTask = inFlightPurchaseTasks.get(purchaseCleanupKey);
    if (inFlightTask) {
      console.log('[PurchaseFlow] ignoring duplicate purchase task:', {
        productId,
      });
      void inFlightTask.result.then((result) => {
        if (result === 'finished') {
          rememberCompletedPurchaseKey(
            completedPurchaseKeys,
            purchaseCleanupKey,
          );
          return;
        }

        cleanupPurchaseKeysRef.current.delete(purchaseCleanupKey);
        if (result === 'abandoned' && mountedRef.current) {
          void retryPurchaseRef.current(purchase);
        }
      });
      return;
    }

    let taskReleased = false;
    let completeTask!: (result: 'abandoned' | 'failed' | 'finished') => void;
    const taskResult = new Promise<'abandoned' | 'failed' | 'finished'>(
      (resolve) => {
        completeTask = resolve;
      },
    );
    const task: InFlightPurchaseTask = {
      result: taskResult,
      complete: completeTask,
    };
    const releasePurchaseTask = (
      result: 'abandoned' | 'failed' | 'finished' = 'failed',
    ): void => {
      if (taskReleased) return;
      taskReleased = true;
      if (inFlightPurchaseTasks.get(purchaseCleanupKey) === task) {
        inFlightPurchaseTasks.delete(purchaseCleanupKey);
      }
      task.complete(result);
    };
    inFlightPurchaseTasks.set(purchaseCleanupKey, task);

    setLastPurchase(purchase);
    setIsProcessing(false);

    setPurchaseResult(
      `Purchase received (state: ${purchase.purchaseState}). Verifying purchase...`,
    );

    const isConsumablePurchase = CONSUMABLE_PRODUCT_ID_SET.has(productId);
    if (!isConsumablePurchase) {
      console.log(
        '[PurchaseFlow] Non-consumable purchase recorded:',
        productId,
      );
    }

    // ------------------------------------------------------------
    // Step 4: four verification selections
    //   - ignore: Skip verification (for testing)
    //   - local: Direct Apple/Google verification on the device
    //   - iapkit-localhost: IAPKit provider through the local server
    //   - iapkit: IAPKit provider through the hosted service
    // ------------------------------------------------------------
    const currentVerificationMethod = verificationMethodRef.current;
    console.log('[PurchaseFlow] About to verify purchase:', {
      verificationMethod: currentVerificationMethod,
      productId,
      willVerify: currentVerificationMethod !== 'ignore' && !!productId,
    });

    if (currentVerificationMethod !== 'ignore' && productId) {
      setIsProcessing(true);
      try {
        if (currentVerificationMethod === 'local') {
          console.log('[PurchaseFlow] Verifying with Local (Device)...');
          const result = await verifyPurchase({
            apple: {sku: productId},
            google: {
              sku: productId,
              packageName: 'dev.hyo.martie',
              purchaseToken: purchase.purchaseToken ?? '',
              accessToken: '', // Requires a server-issued OAuth token.
            },
          });
          const verificationError = getDirectVerificationError(result);
          if (verificationError) {
            throw new Error(verificationError);
          }
          console.log('[PurchaseFlow] Local (Device) verification completed');
        } else {
          const verificationLabel =
            currentVerificationMethod === 'iapkit-localhost'
              ? 'Local (IAPKit)'
              : 'IAPKit';
          console.log(`[PurchaseFlow] Verifying with ${verificationLabel}...`);

          const jwsOrToken = purchase.purchaseToken ?? '';
          if (!jwsOrToken) {
            throw new Error(
              'No purchase token available for IAPKit verification',
            );
          }

          const baseUrl = resolveIapkitVerificationBaseUrl(
            currentVerificationMethod,
          );
          const iapkitPayload = createIapkitVerificationPayload(
            purchase,
            jwsOrToken,
            baseUrl,
          );
          const verifyRequest: VerifyPurchaseWithProviderProps = {
            provider: 'iapkit',
            iapkit: iapkitPayload,
          };
          console.log(
            `[PurchaseFlow] Sending ${verificationLabel} verification request`,
          );

          const result = await verifyPurchaseWithProvider(verifyRequest);
          console.log('[PurchaseFlow] IAPKit verification result:', result);

          const verificationError = getIapkitVerificationError(
            result,
            productId,
            isConsumablePurchase,
          );
          if (verificationError) {
            throw new Error(verificationError);
          }

          if (result.iapkit && mountedRef.current) {
            const iapkitResult = result.iapkit;
            const statusEmoji = iapkitResult.isValid ? '✅' : '⚠️';
            const stateText = iapkitResult.state || 'unknown';

            showNativeAlert(
              `${statusEmoji} ${verificationLabel} Verification`,
              `Valid: ${iapkitResult.isValid}\nState: ${stateText}\nStore: ${
                iapkitResult.store || 'unknown'
              }`,
            );
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.log('[PurchaseFlow] Verification failed:', error);
        }
        const message = formatErrorForDisplay(
          error,
          ErrorCode.PurchaseVerificationFailed,
        );
        if (mountedRef.current) {
          setPurchaseResult(`Purchase verification failed: ${message}`);
          showNativeAlert(
            'Verification Failed',
            `Purchase verification failed: ${message}`,
          );
          cleanupPurchaseKeysRef.current.delete(purchaseCleanupKey);
        }
        releasePurchaseTask(mountedRef.current ? 'failed' : 'abandoned');
        return;
      } finally {
        if (mountedRef.current) {
          setIsProcessing(false);
        }
      }
    }

    if (!mountedRef.current) {
      releasePurchaseTask('abandoned');
      return;
    }

    // ------------------------------------------------------------
    // Step 6: finish transaction
    // IMPORTANT: Must call finishTransaction to complete the purchase
    // ------------------------------------------------------------
    try {
      await finishTransaction({
        purchase,
        isConsumable: isConsumablePurchase,
      });
      rememberCompletedPurchaseKey(completedPurchaseKeys, purchaseCleanupKey);
      releasePurchaseTask('finished');
    } catch (error) {
      const message = formatErrorForDisplay(
        error,
        ErrorCode.PurchaseVerificationFinishFailed,
      );
      console.log('[PurchaseFlow] finishTransaction failed:', error);
      releasePurchaseTask(mountedRef.current ? 'failed' : 'abandoned');
      if (mountedRef.current) {
        setPurchaseResult(
          `Purchase completed, but finishTransaction failed: ${message}`,
        );
        cleanupPurchaseKeysRef.current.delete(purchaseCleanupKey);
      }
      return;
    }

    if (!mountedRef.current) return;

    setPurchaseResult(
      `Purchase completed and finished successfully (state: ${purchase.purchaseState}).`,
    );

    // ------------------------------------------------------------
    // Step 5: grant entitlement
    // Refresh available purchases to update UI state
    // ------------------------------------------------------------
    try {
      await getAvailablePurchases();
      console.log('[PurchaseFlow] Available purchases refreshed');
    } catch (error) {
      console.log(
        '[PurchaseFlow] Failed to refresh available purchases:',
        error,
      );
    }

    if (mountedRef.current) {
      showNativeAlert('Success', 'Purchase completed successfully!');
    }
  };

  const enqueuePurchase = useCallback((purchase: Purchase): Promise<void> => {
    const cleanupKey = getPurchaseCleanupKey(purchase);
    if (completedPurchaseKeys.has(cleanupKey)) {
      return Promise.resolve();
    }
    if (cleanupPurchaseKeysRef.current.has(cleanupKey)) {
      return Promise.resolve();
    }
    cleanupPurchaseKeysRef.current.add(cleanupKey);

    const queued = purchaseQueueTailRef.current.then(() =>
      purchaseSuccessHandlerRef.current(purchase),
    );
    purchaseQueueTailRef.current = queued.catch((error) => {
      cleanupPurchaseKeysRef.current.delete(cleanupKey);
      console.log(
        '[PurchaseFlow] queued purchase handler failed unexpectedly:',
        error,
      );
    });
    return purchaseQueueTailRef.current;
  }, []);

  const {
    connected,
    products,
    availablePurchases,
    fetchProducts,
    finishTransaction,
    getAvailablePurchases,
    verifyPurchase,
    verifyPurchaseWithProvider,
  } = useIAP({
    onPurchaseSuccess: enqueuePurchase,
    // ------------------------------------------------------------
    // Step 2: subscribeEvent - onPurchaseError callback
    // ------------------------------------------------------------
    onPurchaseError: (error: PurchaseError) => {
      console.log('Purchase failed:', error.message);
      setIsProcessing(false);
      if (error.code === ErrorCode.UserCancelled) {
        setPurchaseResult('Purchase cancelled by user');
        return;
      }

      setPurchaseResult(
        `Purchase failed: ${formatErrorForDisplay(
          error,
          ErrorCode.PurchaseError,
        )}`,
      );
    },
  });

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      purchaseSuccessHandlerRef.current = async () => {};
      retryPurchaseRef.current = async () => {};
    };
  }, []);

  useLayoutEffect(() => {
    purchaseSuccessHandlerRef.current = handlePurchaseSuccess;
    retryPurchaseRef.current = enqueuePurchase;
  });

  const didFetchRef = useRef(false);

  useEffect(() => {
    console.log('[PurchaseFlow] useEffect - connected:', connected);
    console.log('[PurchaseFlow] PRODUCT_IDS:', PRODUCT_IDS);
    if (connected && !didFetchRef.current) {
      didFetchRef.current = true;
      console.log('[PurchaseFlow] Calling fetchProducts with:', PRODUCT_IDS);
      fetchProducts({skus: PRODUCT_IDS, type: 'in-app'})
        .then(() => {
          console.log('[PurchaseFlow] fetchProducts completed');
        })
        .catch((error) => {
          const message = formatErrorForDisplay(error, ErrorCode.QueryProduct);
          console.log('[PurchaseFlow] fetchProducts error:', message);
          setPurchaseResult(`Product loading failed: ${message}`);
        });

      getAvailablePurchases()
        .then(async () => {
          console.log('[PurchaseFlow] getAvailablePurchases completed');
          if (Platform.OS !== 'ios') return;

          const pendingPurchases = await getPendingTransactionsIOS();
          for (const purchase of pendingPurchases) {
            if (isPurchaseFlowProduct(purchase.productId ?? '')) {
              await enqueuePurchase(purchase);
            }
          }
        })
        .catch((error) => {
          console.log('[PurchaseFlow] getAvailablePurchases error:', error);
        });
    } else if (!connected) {
      didFetchRef.current = false;
      console.log('[PurchaseFlow] Not fetching products - not connected');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  useEffect(() => {
    if (!connected || availablePurchases.length === 0) return;

    for (const purchase of availablePurchases) {
      const productId = purchase.productId ?? '';
      if (!isPurchaseFlowProduct(productId)) {
        console.log(
          '[PurchaseFlow] skipping cleanup for non-purchase-flow product:',
          {productId},
        );
        continue;
      }
      const cleanupKey = getPurchaseCleanupKey(purchase);
      if (completedPurchaseKeys.has(cleanupKey)) continue;
      void enqueuePurchase(purchase);
    }
  }, [availablePurchases, connected, enqueuePurchase]);

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

  // ============================================================
  // Step 3: requestPurchase - 3 options available
  //   - Apple: { sku, quantity, ... }
  //   - Google: { skus: [...] }
  //   - Google with offers: { skus: [...], subscriptionOffers: [...] }
  // ============================================================
  const handlePurchase = useCallback(
    (itemId: string) => {
      setIsProcessing(true);
      setPurchaseResult('Processing purchase...');

      void requestPurchase({
        request: {
          // Option 1: Apple purchase request
          apple: {
            sku: itemId,
            quantity: 1,
          },
          // Option 2: Google purchase request
          google: {
            skus: [itemId],
          },
          // Option 3: Google with subscription offers (for subs)
          // google: {
          //   skus: [itemId],
          //   subscriptionOffers: [{ sku: itemId, offerToken: '...' }],
          // },
        },
        type: 'in-app',
      }).catch((error: PurchaseError) => {
        console.log('requestPurchase failed:', {
          code: error.code,
          message: error.message,
        });
        setIsProcessing(false);
        if (error.code === ErrorCode.UserCancelled) {
          setPurchaseResult('Purchase cancelled by user');
          return;
        }

        setPurchaseResult(
          `Purchase failed: ${formatErrorForDisplay(
            error,
            ErrorCode.PurchaseError,
          )}`,
        );
      });
    },
    [setIsProcessing, setPurchaseResult],
  );

  const handleChangeVerificationMethod = useCallback(() => {
    const options = [
      'Local (Device)',
      'Local (IAPKit)',
      'IAPKit',
      'None (Skip)',
      'Cancel',
    ];
    const cancelButtonIndex = 4;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: 'Select Verification Method',
        message: 'Choose how to verify purchases after completion',
      },
      (buttonIndex) => {
        if (buttonIndex === 0) {
          setVerificationMethod('local');
        } else if (buttonIndex === 1) {
          setVerificationMethod('iapkit-localhost');
        } else if (buttonIndex === 2) {
          setVerificationMethod('iapkit');
        } else if (buttonIndex === 3) {
          setVerificationMethod('ignore');
        }
      },
    );
  }, [showActionSheetWithOptions]);

  const loadStorefront = useCallback(async () => {
    setStorefrontLoading(true);
    setStorefrontError(null);
    try {
      const code = await getStorefront();
      setStorefront(code ?? '');
    } catch (error) {
      console.log('[PurchaseFlow] getStorefront error:', error);
      setStorefrontError(
        error instanceof Error ? error.message : 'Failed to load storefront',
      );
      setStorefront('');
    } finally {
      setStorefrontLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      loadStorefront();
    } else {
      setStorefront('');
      setStorefrontError(null);
      setStorefrontLoading(false);
    }
  }, [connected, loadStorefront]);

  return (
    <PurchaseFlow
      connected={connected}
      products={products}
      availablePurchases={availablePurchases}
      purchaseResult={purchaseResult}
      isProcessing={isProcessing}
      lastPurchase={lastPurchase}
      refreshingAvailablePurchases={refreshingAvailablePurchases}
      onPurchase={handlePurchase}
      onRefreshAvailablePurchases={handleRefreshAvailablePurchases}
      storefront={storefront}
      storefrontError={storefrontError}
      storefrontLoading={storefrontLoading}
      onRefreshStorefront={loadStorefront}
      verificationMethod={verificationMethod}
      onChangeVerificationMethod={handleChangeVerificationMethod}
    />
  );
}

// Note: This is the default export required by Expo Router
export default PurchaseFlowContainer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    padding: 15,
  },
  statusContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
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
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
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
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  storefrontRefreshButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  verificationContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  verificationButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  verificationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  verificationButtonHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
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
  productCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  productBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  productBadgeConsumable: {
    color: '#43A047',
  },
  productBadgeNonConsumable: {
    color: '#6A1B9A',
  },
  productActions: {
    flexDirection: 'row',
    gap: 10,
  },
  purchaseButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  tvFocusedButton: {
    borderColor: '#0F172A',
    borderWidth: 3,
  },
  detailsButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
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
  resultActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  resultDetailsButton: {
    minHeight: 44,
    justifyContent: 'center',
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
  appTransactionButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 15,
  },
  appTransactionButtonText: {
    color: 'white',
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
  offerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
    marginTop: 8,
    marginBottom: 4,
  },
  offerDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});
