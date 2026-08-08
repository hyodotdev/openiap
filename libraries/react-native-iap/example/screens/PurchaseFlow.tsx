import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
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
import Clipboard from '@react-native-clipboard/clipboard';
import {
  requestPurchase,
  useIAP,
  getAppTransactionIOS,
  getStorefront,
  ErrorCode,
} from 'react-native-iap';
import {IAPKIT_API_KEY, IAPKIT_BASE_URL} from '@env';
import Loading from '../src/components/Loading';
import {
  CONSUMABLE_PRODUCT_IDS,
  NON_CONSUMABLE_PRODUCT_IDS,
  PRODUCT_IDS,
} from '../src/utils/constants';
import {getErrorMessage} from '../src/utils/errorUtils';
import {
  getDefaultVerificationMethod,
  useVerificationMethod,
  type VerificationMethod,
} from '../src/hooks/useVerificationMethod';
import {
  createIapkitVerificationPayload,
  getDirectVerificationError,
  getIapkitVerificationError,
  getPurchaseCleanupKey,
  rememberCompletedPurchaseKey,
  resolveIapkitVerificationBaseUrl,
  showNativeAlert,
} from '../src/utils/vegaRuntime';
import type {
  Product,
  Purchase,
  PurchaseError,
  VerifyPurchaseWithProviderProps,
} from 'react-native-iap';
import PurchaseSummaryRow from '../src/components/PurchaseSummaryRow';
import VerificationMethodSelectorModal from '../src/components/VerificationMethodSelectorModal';

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

type PurchaseFlowProps = {
  connected: boolean;
  products: Product[];
  purchaseResult: string;
  isProcessing: boolean;
  lastPurchase: Purchase | null;
  storefront: string | null;
  isFetchingStorefront: boolean;
  verificationMethod: VerificationMethod;
  onPurchase: (productId: string) => void;
  onRefreshStorefront: () => void;
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
  purchaseResult,
  isProcessing,
  lastPurchase,
  storefront,
  isFetchingStorefront,
  verificationMethod,
  onPurchase,
  onRefreshStorefront,
  onChangeVerificationMethod,
}: PurchaseFlowProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const visibleProducts = products;
  const hasHiddenNonConsumables = false;

  const handlePurchase = useCallback(
    (itemId: string) => {
      onPurchase(itemId);
    },
    [onPurchase],
  );

  const handleCopyResult = () => {
    if (purchaseResult) {
      Clipboard.setString(purchaseResult);
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
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
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

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Storefront:</Text>
            <Text style={styles.statusValue}>
              {storefront && storefront.trim().length > 0
                ? storefront
                : 'Unavailable'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.statusActionButton,
              (!connected || isFetchingStorefront) && {opacity: 0.7},
            ]}
            onPress={onRefreshStorefront}
            disabled={!connected || isFetchingStorefront}
          >
            <Text style={styles.statusActionButtonText}>
              {isFetchingStorefront
                ? 'Fetching storefront...'
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
                  hasTVPreferredFocus={index === 0}
                  style={[
                    styles.purchaseButton,
                    isProcessing && {opacity: 0.5},
                  ]}
                  onPress={() => handlePurchase(product.id)}
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
                  onPress={() => {}}
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

        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to test:</Text>
          <Text style={styles.instructionsText}>
            1. Make sure you’re signed in with a Sandbox account
          </Text>
          <Text style={styles.instructionsText}>
            2. Products must be configured in App Store Connect
          </Text>
          <Text style={styles.instructionsText}>
            3. Tap “Purchase” to initiate the transaction
          </Text>
          <Text style={styles.instructionsText}>
            4. The transaction will be processed via the hook callbacks
          </Text>
          <Text style={styles.instructionsText}>
            5. Server-side receipt validation is recommended for production
          </Text>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Product Details</Text>
            <ScrollView style={styles.modalScrollView}>
              {selectedProduct && (
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
                            <Text style={styles.offerLabel}>Price:</Text>
                            <Text style={styles.offerValue}>
                              {offer.displayPrice}
                            </Text>
                            {offer.fullPriceMicrosAndroid && (
                              <>
                                <Text style={styles.offerLabel}>
                                  Full Price (micros):
                                </Text>
                                <Text style={styles.offerValue}>
                                  {offer.fullPriceMicrosAndroid}
                                </Text>
                              </>
                            )}
                            {offer.percentageDiscountAndroid && (
                              <Text style={styles.offerValueDiscount}>
                                {offer.percentageDiscountAndroid}% off
                              </Text>
                            )}
                            {offer.formattedDiscountAmountAndroid && (
                              <>
                                <Text style={styles.offerLabel}>Discount:</Text>
                                <Text style={styles.offerValueDiscount}>
                                  {offer.formattedDiscountAmountAndroid}
                                </Text>
                              </>
                            )}
                            {offer.validTimeWindowAndroid && (
                              <>
                                <Text style={styles.offerLabel}>
                                  Valid Window:
                                </Text>
                                <Text style={styles.offerValue}>
                                  {new Date(
                                    Number(
                                      offer.validTimeWindowAndroid
                                        .startTimeMillis,
                                    ),
                                  ).toLocaleDateString()}{' '}
                                  -{' '}
                                  {new Date(
                                    Number(
                                      offer.validTimeWindowAndroid
                                        .endTimeMillis,
                                    ),
                                  ).toLocaleDateString()}
                                </Text>
                              </>
                            )}
                            {offer.limitedQuantityInfoAndroid && (
                              <>
                                <Text style={styles.offerLabel}>
                                  Limited Quantity:
                                </Text>
                                <Text style={styles.offerValue}>
                                  {
                                    offer.limitedQuantityInfoAndroid
                                      .remainingQuantity
                                  }{' '}
                                  /{' '}
                                  {
                                    offer.limitedQuantityInfoAndroid
                                      .maximumQuantity
                                  }{' '}
                                  remaining
                                </Text>
                              </>
                            )}
                            {offer.preorderDetailsAndroid && (
                              <>
                                <Text style={styles.offerLabel}>
                                  Pre-order Release:
                                </Text>
                                <Text style={styles.offerValue}>
                                  {new Date(
                                    Number(
                                      offer.preorderDetailsAndroid
                                        .preorderReleaseTimeMillis,
                                    ),
                                  ).toLocaleDateString()}
                                </Text>
                              </>
                            )}
                            {offer.rentalDetailsAndroid && (
                              <>
                                <Text style={styles.offerLabel}>Rental:</Text>
                                <Text style={styles.offerValue}>
                                  Period:{' '}
                                  {
                                    offer.rentalDetailsAndroid
                                      .rentalExpirationPeriod
                                  }
                                </Text>
                              </>
                            )}
                            {Array.isArray(offer.offerTagsAndroid) &&
                              offer.offerTagsAndroid.length > 0 && (
                                <>
                                  <Text style={styles.offerLabel}>Tags:</Text>
                                  <Text style={styles.offerValue}>
                                    {offer.offerTagsAndroid.join(', ')}
                                  </Text>
                                </>
                              )}
                          </View>
                        ))}
                      </View>
                    )}
                </>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/**
 * ============================================================================
 * Purchase Flow Container
 * ============================================================================
 *
 * This component demonstrates the complete IAP purchase flow with 6 key steps:
 *
 * 1. INIT CONNECTION
 *    - useIAP hook automatically handles connection via initConnection()
 *    - `connected` state indicates when store is ready
 *
 * 2. SUBSCRIBE TO EVENTS
 *    - useIAP internally subscribes to purchase events
 *    - onPurchaseSuccess: Called when purchase completes successfully
 *    - onPurchaseError: Called when purchase fails or is cancelled
 *
 * 3. REQUEST PURCHASE (3 options)
 *    Option A: iOS-specific request with quantity
 *    Option B: Android-specific request with SKU array
 *    Option C: Cross-platform using `request` object (recommended)
 *
 * 4. VERIFY PURCHASE
 *    - Local (Device): Direct Apple/Google verification on the device
 *    - Local (IAPKit): Verify through a locally running IAPKit server
 *    - IAPKit: Verify through kit.openiap.dev
 *    - Skip verification: For testing only (not recommended for production)
 *
 * 5. GRANT ENTITLEMENT
 *    - Update your backend/database with purchase info
 *    - Unlock content or features for the user
 *    - (Handled by your app's business logic)
 *
 * 6. FINISH TRANSACTION
 *    - Call finishTransaction() to acknowledge the purchase
 *    - For consumables: isConsumable: true (allows re-purchase)
 *    - For non-consumables: isConsumable: false
 *    - CRITICAL: Always finish transactions to prevent issues
 *
 * ============================================================================
 */
function PurchaseFlowContainer() {
  // ──────────────────────────────────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────────────────────────────────
  const [purchaseResult, setPurchaseResult] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPurchase, setLastPurchase] = useState<Purchase | null>(null);
  const [storefront, setStorefront] = useState<string | null>(null);
  const [fetchingStorefront, setFetchingStorefront] = useState(false);

  const {
    verificationMethod,
    verificationMethodRef,
    verificationMethodSelectorVisible,
    hideVerificationMethodSelector,
    selectVerificationMethod,
    showVerificationMethodSelector,
  } = useVerificationMethod(
    getDefaultVerificationMethod(IAPKIT_API_KEY, IAPKIT_BASE_URL),
  );
  const purchaseSuccessHandlerRef = useRef<
    (purchase: Purchase) => Promise<void>
  >(async () => {});
  const mountedRef = useRef(true);

  const dispatchPurchaseSuccess = useCallback(
    (purchase: Purchase) => purchaseSuccessHandlerRef.current(purchase),
    [],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: INIT CONNECTION
  // Step 2: SUBSCRIBE TO EVENTS
  // ──────────────────────────────────────────────────────────────────────────
  // useIAP hook automatically:
  // - Calls initConnection() on mount
  // - Sets up purchase event listeners
  // - Cleans up on unmount
  const handlePurchaseSuccess = async (purchase: Purchase): Promise<void> => {
    if (!mountedRef.current) return;

    console.log('Purchase successful:', purchase.productId);
    console.log('[PurchaseFlow] purchaseState:', purchase.purchaseState);
    const productId = purchase.productId ?? '';
    if (!isPurchaseFlowProduct(productId)) {
      console.log('[PurchaseFlow] ignoring non-purchase-flow product:', {
        productId,
      });
      return;
    }

    const purchaseCleanupKey = getPurchaseCleanupKey(purchase);
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
        } else if (result === 'abandoned' && mountedRef.current) {
          void dispatchPurchaseSuccess(purchase);
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
    ) => {
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
      `Purchase received (state: ${purchase.purchaseState}). Finishing transaction...`,
    );

    const isConsumablePurchase = CONSUMABLE_PRODUCT_ID_SET.has(productId);
    if (!isConsumablePurchase) {
      console.log(
        '[PurchaseFlow] Non-consumable purchase recorded:',
        productId,
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Step 4: VERIFY PURCHASE
    // ──────────────────────────────────────────────────────────────────────
    // Choose verification method based on user selection:
    // - 'ignore': Skip verification (testing only)
    // - 'local': Direct Apple/Google verification on the device
    // - 'iapkit-localhost': IAPKit provider through the local server
    // - 'iapkit': IAPKit provider through the hosted service
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
          // This token is intentionally a placeholder. Production apps must
          // obtain Google Play API credentials from their backend.
          const result = await verifyPurchase({
            apple: {sku: productId},
            google: {
              sku: productId,
              accessToken: 'YOUR_OAUTH_ACCESS_TOKEN',
              packageName: 'dev.hyo.martie',
              purchaseToken: purchase.purchaseToken ?? '',
              isSub: false,
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

          const apiKey = IAPKIT_API_KEY?.trim();
          if (!apiKey) {
            throw new Error('IAPKIT_API_KEY not configured');
          }

          const jwsOrToken = purchase.purchaseToken ?? '';
          if (!jwsOrToken) {
            throw new Error(
              'No purchase token available for IAPKit verification',
            );
          }

          const baseUrl = resolveIapkitVerificationBaseUrl(
            currentVerificationMethod,
            IAPKIT_BASE_URL,
          );
          const iapkitPayload = createIapkitVerificationPayload(
            purchase,
            jwsOrToken,
            apiKey,
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
          );
          if (verificationError) {
            throw new Error(verificationError);
          }

          if (result.iapkit && mountedRef.current) {
            const stateText = result.iapkit.state || 'unknown';

            showNativeAlert(
              `✅ ${verificationLabel} Verification`,
              `Valid: true\nState: ${stateText}\nStore: ${
                result.iapkit.store || 'unknown'
              }`,
            );
          }
        }
      } catch (error) {
        console.log('[PurchaseFlow] Verification failed:', error);
        const message = getErrorMessage(error);
        if (mountedRef.current) {
          setPurchaseResult(`Purchase verification failed: ${message}`);
          showNativeAlert(
            'Verification Failed',
            `Purchase verification failed: ${message}`,
          );
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

    // ──────────────────────────────────────────────────────────────────────
    // Step 5: GRANT ENTITLEMENT
    // ──────────────────────────────────────────────────────────────────────
    // Production integration point:
    // - Save purchase record to database
    // - Unlock premium features for user
    // - Update user's subscription status
    // Example: await yourBackend.grantEntitlement(purchase);

    // ──────────────────────────────────────────────────────────────────────
    // Step 6: FINISH TRANSACTION
    // ──────────────────────────────────────────────────────────────────────
    // CRITICAL: Always finish transactions!
    // - Consumables: Set isConsumable: true to allow re-purchase
    // - Non-consumables: Set isConsumable: false
    // - Failing to finish will cause issues on next app launch
    try {
      await finishTransaction({
        purchase,
        isConsumable: isConsumablePurchase,
      });
      rememberCompletedPurchaseKey(completedPurchaseKeys, purchaseCleanupKey);
      releasePurchaseTask('finished');
      if (mountedRef.current) {
        setPurchaseResult(
          `Purchase completed and finished successfully (state: ${purchase.purchaseState}).`,
        );
        showNativeAlert('Success', 'Purchase completed successfully!');
      }
    } catch (error) {
      console.log('[PurchaseFlow] finishTransaction failed:', error);
      const message = getErrorMessage(error);
      releasePurchaseTask(mountedRef.current ? 'failed' : 'abandoned');
      if (mountedRef.current) {
        setPurchaseResult(
          `Purchase completed, but finishTransaction failed: ${message}`,
        );
        showNativeAlert('Finish Transaction Failed', message);
      }
    }
  };

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
    // ────────────────────────────────────────────────────────────────────────
    // Step 2a: Purchase Success Handler
    // ────────────────────────────────────────────────────────────────────────
    onPurchaseSuccess: dispatchPurchaseSuccess,

    // ────────────────────────────────────────────────────────────────────────
    // Step 2b: Purchase Error Handler
    // ────────────────────────────────────────────────────────────────────────
    onPurchaseError: (error: PurchaseError) => {
      console.log('Purchase failed:', {
        code: error.code,
        message: error.message,
        userCancelled: error.code === ErrorCode.UserCancelled,
      });

      setIsProcessing(false);

      // Check for user cancellation - don't show error for this
      if (error.code === ErrorCode.UserCancelled) {
        setPurchaseResult('Purchase cancelled by user');
        return;
      }

      setPurchaseResult(
        `Purchase failed: ${error.message} (code: ${error.code})`,
      );
    },
  });

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      purchaseSuccessHandlerRef.current = async () => {};
    };
  }, []);

  useLayoutEffect(() => {
    purchaseSuccessHandlerRef.current = handlePurchaseSuccess;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────
  const didFetchRef = useRef(false);

  const fetchStorefront = useCallback(async () => {
    setFetchingStorefront(true);
    try {
      const code = await getStorefront();
      setStorefront(code?.trim() ? code : null);
    } catch (error) {
      console.log('[PurchaseFlow] getStorefront failed:', error);
      setStorefront(null);
    } finally {
      setFetchingStorefront(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch Products on Connection
  // ──────────────────────────────────────────────────────────────────────────
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
          const message = getErrorMessage(error);
          console.log('[PurchaseFlow] fetchProducts error:', message);
          setPurchaseResult(`Product loading failed: ${message}`);
        });

      getAvailablePurchases()
        .then(() => {
          console.log('[PurchaseFlow] getAvailablePurchases completed');
        })
        .catch((error) => {
          console.log('[PurchaseFlow] getAvailablePurchases error:', error);
        });

      void fetchStorefront();
    } else if (!connected) {
      didFetchRef.current = false;
      console.log('[PurchaseFlow] Not fetching products - not connected');
      setStorefront(null);
    }
  }, [connected, fetchProducts, fetchStorefront, getAvailablePurchases]);

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

      void dispatchPurchaseSuccess(purchase).catch((error) => {
        console.log(
          '[PurchaseFlow] restored purchase handler failed unexpectedly:',
          error,
        );
      });
    }
  }, [availablePurchases, connected, dispatchPurchaseSuccess]);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: REQUEST PURCHASE
  // ──────────────────────────────────────────────────────────────────────────
  // Three options for requesting purchases:
  //
  // Option A - iOS only:
  //   requestPurchase({ request: { ios: { sku, quantity } }, type: 'in-app' })
  //
  // Option B - Android only:
  //   requestPurchase({ request: { android: { skus: [sku] } }, type: 'in-app' })
  //
  // Option C - Cross-platform (recommended):
  //   requestPurchase({
  //     request: {
  //       ios: { sku, quantity: 1 },
  //       android: { skus: [sku] }
  //     },
  //     type: 'in-app'
  //   })
  const handlePurchase = useCallback((itemId: string) => {
    setIsProcessing(true);
    setPurchaseResult('Processing purchase...');

    // Using Option C: Cross-platform request
    void requestPurchase({
      request: {
        apple: {
          sku: itemId,
          quantity: 1,
        },
        google: {
          skus: [itemId],
        },
      },
      type: 'in-app',
    }).catch((err: PurchaseError) => {
      console.log('requestPurchase failed:', {
        code: err.code,
        message: err.message,
      });
      setIsProcessing(false);
      if (err.code === ErrorCode.UserCancelled) {
        setPurchaseResult('Purchase cancelled by user');
        return;
      }

      setPurchaseResult(`Purchase failed: ${err.message}`);
    });
  }, []);

  const handleRefreshStorefront = useCallback(() => {
    void fetchStorefront();
  }, [fetchStorefront]);

  return (
    <>
      <PurchaseFlow
        connected={connected}
        products={products}
        purchaseResult={purchaseResult}
        isProcessing={isProcessing}
        lastPurchase={lastPurchase}
        storefront={storefront}
        isFetchingStorefront={fetchingStorefront}
        verificationMethod={verificationMethod}
        onPurchase={handlePurchase}
        onRefreshStorefront={handleRefreshStorefront}
        onChangeVerificationMethod={showVerificationMethodSelector}
      />
      <VerificationMethodSelectorModal
        onDismiss={hideVerificationMethodSelector}
        onSelect={selectVerificationMethod}
        selectedMethod={verificationMethod}
        visible={verificationMethodSelectorVisible}
      />
    </>
  );
}

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
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  statusActionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  statusActionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
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
  copyButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 12,
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
  modalScrollView: {
    maxHeight: '85%',
  },
  offersSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  offersSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  offerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  offerLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    fontWeight: '600',
  },
  offerValue: {
    fontSize: 13,
    color: '#333',
    marginTop: 2,
  },
  offerValueDiscount: {
    fontSize: 13,
    color: '#E53935',
    marginTop: 2,
    fontWeight: '600',
  },
  offerToken: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
});
