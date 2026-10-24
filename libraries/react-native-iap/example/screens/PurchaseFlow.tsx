import {useCallback, useEffect, useState} from 'react';
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
  getStorefront,
  ErrorCode,
} from 'react-native-iap';
import Loading from '../src/components/Loading';
import AppOwnershipCard from '../src/components/AppOwnershipCard';
import {
  CONSUMABLE_PRODUCT_IDS,
  NON_CONSUMABLE_PRODUCT_IDS,
  PRODUCT_IDS,
} from '../src/utils/constants';
import {getErrorMessage} from '../src/utils/errorUtils';
import {useVerificationMethod} from '../src/hooks/useVerificationMethod';
import {
  alertPurchaseOutcome,
  describePurchaseOutcome,
  purchaseFlow,
  type VerificationMethod,
} from '../src/utils/purchaseFlow';
import type {Product, Purchase, PurchaseError} from 'react-native-iap';
import PurchaseSummaryRow from '../src/components/PurchaseSummaryRow';
import VerificationMethodSelectorModal from '../src/components/VerificationMethodSelectorModal';

const CONSUMABLE_PRODUCT_ID_SET = new Set(CONSUMABLE_PRODUCT_IDS);
const NON_CONSUMABLE_PRODUCT_ID_SET = new Set(NON_CONSUMABLE_PRODUCT_IDS);

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
 * Purchase Flow Example: one-time in-app products. Each purchase's result
 * arrives as an outcome of the app's purchase flow.
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
            {products.length > 0
              ? `${products.length} product(s) available`
              : 'Loading products...'}
          </Text>

          {products.map((product, index) => (
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

          {products.length === 0 && connected && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No products available. Please check your app store
                configuration.
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

        <AppOwnershipCard />

        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to test:</Text>
          <Text style={styles.instructionsText}>
            1. Make sure you’re signed in with a Sandbox account
          </Text>
          <Text style={styles.instructionsText}>
            2. Configure products in the selected store console
          </Text>
          <Text style={styles.instructionsText}>
            3. Tap “Purchase” to initiate the transaction
          </Text>
          <Text style={styles.instructionsText}>
            4. The purchase flow verifies and finishes the transaction
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
 * Purchase Flow Container: one-time products through the app's purchase flow.
 *
 * 1. useIAP connects to the store. Given `purchaseFlow`, it also recovers
 *    unfinished purchases, reports each outcome, and refreshes ownership.
 * 2. requestPurchase opens the store sheet; the purchase arrives as an outcome.
 * 3. The flow confirms it with the selected verification method, credits a
 *    consumable in `grant`, then finishes the transaction
 *    (src/utils/purchaseFlow.ts).
 */
function PurchaseFlowContainer() {
  const [purchaseResult, setPurchaseResult] = useState('');
  // From requestPurchase until that product's outcome or a purchase error.
  const [processingProductId, setProcessingProductId] = useState<string | null>(
    null,
  );
  const [lastPurchase, setLastPurchase] = useState<Purchase | null>(null);
  const [storefront, setStorefront] = useState<string | null>(null);
  const [fetchingStorefront, setFetchingStorefront] = useState(false);
  const {
    verificationMethod,
    verificationMethodSelectorVisible,
    hideVerificationMethodSelector,
    selectVerificationMethod,
    showVerificationMethodSelector,
  } = useVerificationMethod();

  const {connected, products, fetchProducts} = useIAP({
    purchaseFlow,
    onPurchaseFlowOutcome: ({purchase, status}) => {
      if (!PRODUCT_IDS.includes(purchase.productId)) return;
      setLastPurchase(purchase);
      setProcessingProductId((current) =>
        current === purchase.productId ? null : current,
      );
      setPurchaseResult(describePurchaseOutcome(status));
      alertPurchaseOutcome(status);
    },
    onPurchaseError: (error: PurchaseError) => {
      setProcessingProductId(null);
      setPurchaseResult(
        error.code === ErrorCode.UserCancelled
          ? 'Purchase cancelled by user'
          : `Purchase failed: ${error.message} (code: ${error.code})`,
      );
    },
  });

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

  useEffect(() => {
    if (!connected) {
      setStorefront(null);
      return;
    }
    fetchProducts({skus: PRODUCT_IDS, type: 'in-app'}).catch((error) => {
      setPurchaseResult(`Product loading failed: ${getErrorMessage(error)}`);
    });
    void fetchStorefront();
  }, [connected, fetchProducts, fetchStorefront]);

  // requestPurchase takes an Apple request, a Google request, or both; this
  // cross-platform form sends each store its own.
  const handlePurchase = useCallback((productId: string) => {
    setProcessingProductId(productId);
    setPurchaseResult('Processing purchase...');
    requestPurchase({
      request: {
        apple: {sku: productId, quantity: 1},
        google: {skus: [productId]},
      },
      type: 'in-app',
    }).catch((error: PurchaseError) => {
      setProcessingProductId(null);
      setPurchaseResult(
        error.code === ErrorCode.UserCancelled
          ? 'Purchase cancelled by user'
          : `Purchase failed: ${error.message}`,
      );
    });
  }, []);

  return (
    <>
      <PurchaseFlow
        connected={connected}
        products={products}
        purchaseResult={purchaseResult}
        isProcessing={processingProductId !== null}
        lastPurchase={lastPurchase}
        storefront={storefront}
        isFetchingStorefront={fetchingStorefront}
        verificationMethod={verificationMethod}
        onPurchase={handlePurchase}
        onRefreshStorefront={() => void fetchStorefront()}
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
