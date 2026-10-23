import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  requestPurchase,
  useIAP,
  deepLinkToSubscriptions,
  type ActiveSubscription,
  type ProductSubscription,
  type ProductSubscriptionAndroid,
  type Purchase,
  type PurchaseError,
  type SubscriptionOffer,
  ErrorCode,
} from 'react-native-iap';
import Loading from '../src/components/Loading';
import {SUBSCRIPTION_PRODUCT_IDS} from '../src/utils/constants';
import {getErrorMessage} from '../src/utils/errorUtils';
import {useVerificationMethod} from '../src/hooks/useVerificationMethod';
import {
  alertPurchaseOutcome,
  describePurchaseOutcome,
  purchaseFlow,
  type VerificationMethod,
} from '../src/utils/purchaseFlow';
import {
  getSubscriptionProductId,
  showNativeAlert,
} from '../src/utils/vegaRuntime';
import PurchaseSummaryRow from '../src/components/PurchaseSummaryRow';
import VerificationMethodSelectorModal from '../src/components/VerificationMethodSelectorModal';

// Amazon reports a subscription under its catalog base SKU, with the term as
// its plan; this screen's products are the terms.
function subscriptionProductId(purchase: Purchase): string | undefined {
  const productId = getSubscriptionProductId(
    purchase.productId,
    purchase.currentPlanId,
    purchase.store,
    purchase.storeId,
  );
  return productId && SUBSCRIPTION_PRODUCT_IDS.includes(productId)
    ? productId
    : undefined;
}

function stringifyForDisplay(value: unknown): string {
  return (
    JSON.stringify(
      value,
      (key, item) =>
        item &&
        /(?:token|apiKey|signatureAndroid|dataAndroid|receipt|jws|jsonRepresentation|rawSignedPayload)/i.test(
          key,
        )
          ? 'Present'
          : item,
      2,
    ) ?? ''
  );
}

// ActiveSubscription plus fields outside its type: computed locally (basePlanId,
// _detectedBasePlanId), on the Purchase but not mapped (isUpgradedIOS), or
// platform-specific (purchaseTokenAndroid).
type ExtendedActiveSubscription = ActiveSubscription & {
  basePlanId?: string; // Android: detected from subscription offers
  purchaseTokenAndroid?: string; // Android: purchase token
  _detectedBasePlanId?: string; // Locally detected/cached base plan ID
  isUpgradedIOS?: boolean; // iOS: from PurchaseIOS.isUpgradedIOS
};

// Component for plan change controls
interface PlanChangeControlsProps {
  activeSubscriptions: ActiveSubscription[];
  handlePlanChange: (
    productId: string,
    changeType: 'upgrade' | 'downgrade' | 'yearly' | 'monthly',
    currentBasePlanId: string,
  ) => void;
  isProcessing: boolean;
  lastPurchasedPlan: string | null;
}

const PlanChangeControls = React.memo(function PlanChangeControls({
  activeSubscriptions,
  handlePlanChange,
  isProcessing,
  lastPurchasedPlan,
}: PlanChangeControlsProps) {
  // Find all premium subscriptions (both monthly and yearly)
  const premiumSubs = activeSubscriptions.filter(
    (sub) =>
      sub.productId === 'dev.hyo.martie.premium' ||
      sub.productId === 'dev.hyo.martie.premium_year',
  );

  if (premiumSubs.length === 0) return null;

  // Detect the current plan based on product ID for iOS
  let currentBasePlan = 'unknown';
  let activeSub: ActiveSubscription | undefined = undefined;

  if (Platform.OS === 'ios') {
    // On iOS, take the most recent subscription; both can exist mid-transition.
    const sortedSubs = [...premiumSubs].sort((a, b) => {
      const dateA = a.transactionDate ?? 0;
      const dateB = b.transactionDate ?? 0;
      return dateB - dateA;
    });

    activeSub = sortedSubs[0];

    // Check which products exist; both means a transition.
    const hasYearly = premiumSubs.some(
      (s) => s.productId === 'dev.hyo.martie.premium_year',
    );
    const hasMonthly = premiumSubs.some(
      (s) => s.productId === 'dev.hyo.martie.premium',
    );

    if (lastPurchasedPlan) {
      // If we have a recently purchased plan, use that
      currentBasePlan = lastPurchasedPlan;
      console.log('Using last purchased plan:', lastPurchasedPlan);
    } else if (hasYearly && !hasMonthly) {
      // Only yearly exists - user has yearly
      currentBasePlan = 'premium-year';
    } else if (!hasYearly && hasMonthly) {
      // Only monthly exists - user has monthly
      currentBasePlan = 'premium';
    } else if (activeSub) {
      // Both exist or transition state - use the most recent one
      if (activeSub.productId === 'dev.hyo.martie.premium_year') {
        currentBasePlan = 'premium-year';
      } else if (activeSub.productId === 'dev.hyo.martie.premium') {
        currentBasePlan = 'premium';
      }
    }
  } else {
    // Android uses base plans within the same product
    activeSub = premiumSubs[0];
    const extendedSub = activeSub as ExtendedActiveSubscription;
    if (activeSub?.productId === 'dev.hyo.martie.premium_year') {
      currentBasePlan = 'premium-year';
    } else if (extendedSub.basePlanId) {
      currentBasePlan = extendedSub.basePlanId;
    } else if (lastPurchasedPlan) {
      currentBasePlan = lastPurchasedPlan;
    } else {
      // Default to monthly if we can't detect
      currentBasePlan = 'premium';
    }
  }

  console.log(
    'Button section - current base plan:',
    currentBasePlan,
    'Active sub:',
    activeSub?.productId,
  );

  // iOS doesn't need upgrade/downgrade buttons as it's handled automatically by the App Store
  if (Platform.OS === 'ios') {
    return null;
  }

  return (
    <View style={styles.planChangeSection}>
      {currentBasePlan === 'premium' && (
        <TouchableOpacity
          style={[styles.changePlanButton, styles.upgradeButton]}
          onPress={() =>
            handlePlanChange(
              activeSub?.productId || 'dev.hyo.martie.premium',
              'upgrade',
              'premium',
            )
          }
          disabled={isProcessing}
        >
          <Text style={styles.changePlanButtonText}>
            ⬆️ Upgrade to Yearly Plan
          </Text>
          <Text style={styles.changePlanButtonSubtext}>
            Save with annual billing
          </Text>
        </TouchableOpacity>
      )}

      {currentBasePlan === 'premium-year' && (
        <TouchableOpacity
          style={[styles.changePlanButton, styles.downgradeButton]}
          onPress={() =>
            handlePlanChange(
              activeSub?.productId || 'dev.hyo.martie.premium_year',
              'downgrade',
              'premium-year',
            )
          }
          disabled={isProcessing}
        >
          <Text style={styles.changePlanButtonText}>
            ⬇️ Downgrade to Monthly Plan
          </Text>
          <Text style={styles.changePlanButtonSubtext}>
            More flexibility with monthly billing
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

/**
 * Subscription Flow Example: recurring subscriptions. Each purchase's result
 * arrives as an outcome of the app's purchase flow.
 *
 * Status checks:
 * - getActiveSubscriptions() - all active subscriptions
 * - getActiveSubscriptions(['id1', 'id2']) - only those subscriptions
 * - activeSubscriptions state - updated automatically
 */

type SubscriptionFlowProps = {
  connected: boolean;
  subscriptions: ProductSubscription[];
  activeSubscriptions: ActiveSubscription[];
  purchaseResult: string;
  isProcessing: boolean;
  isCheckingStatus: boolean;
  lastPurchase: Purchase | null;
  lastPurchasedPlan: string | null;
  pendingPlanChange: string | null;
  verificationMethod: VerificationMethod;
  setProcessingProductId: (productId: string | null) => void;
  setPurchaseResult: (value: string) => void;
  onSubscribe: (productId: string) => void;
  onRetryLoadSubscriptions: () => void;
  onRefreshStatus: () => void;
  onManageSubscriptions: () => void;
  onChangeVerificationMethod: () => void;
};

function SubscriptionFlow({
  connected,
  subscriptions,
  activeSubscriptions,
  purchaseResult,
  isProcessing,
  isCheckingStatus,
  lastPurchase,
  lastPurchasedPlan,
  pendingPlanChange,
  verificationMethod,
  setProcessingProductId,
  setPurchaseResult,
  onSubscribe,
  onRetryLoadSubscriptions,
  onRefreshStatus,
  onManageSubscriptions,
  onChangeVerificationMethod,
}: SubscriptionFlowProps) {
  const [selectedSubscription, setSelectedSubscription] =
    useState<ProductSubscription | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const ownedSubscriptions = useMemo(() => {
    return new Set(activeSubscriptions.map((sub) => sub.productId));
  }, [activeSubscriptions]);

  const handleSubscription = useCallback(
    (itemId: string) => {
      const isAlreadySubscribed = ownedSubscriptions.has(itemId);

      if (isAlreadySubscribed) {
        Alert.alert(
          'Already Subscribed',
          'You already have an active subscription to this product.',
          [{text: 'OK', style: 'default'}],
        );
        return;
      }
      onSubscribe(itemId);
    },
    [onSubscribe, ownedSubscriptions],
  );

  const handleSubscriptionPress = (subscription: ProductSubscription) => {
    setSelectedSubscription(subscription);
    setModalVisible(true);
  };

  const handlePlanChange = useCallback(
    (
      currentProductId: string,
      changeType: 'upgrade' | 'downgrade' | 'yearly' | 'monthly',
      currentBasePlanId: string,
    ) => {
      // Unused on iOS: the App Store handles upgrades and downgrades.
      if (Platform.OS === 'ios') {
        return;
      }

      // Android uses the same product with different base plans
      const targetProductId = 'dev.hyo.martie.premium';

      // Find the subscription with the target base plan
      const targetSubscription = subscriptions.find(
        (s) => s.id === targetProductId,
      );

      if (!targetSubscription) {
        Alert.alert('Error', 'Target subscription plan not found');
        return;
      }

      // Determine target base plan based on current plan and change type
      let targetBasePlanId = '';
      let actionDescription = '';

      if (currentBasePlanId === 'premium') {
        // Currently on monthly, can only upgrade
        if (changeType === 'upgrade' || changeType === 'yearly') {
          targetBasePlanId = 'premium-year';
          actionDescription = 'upgrade to Yearly';
        } else {
          Alert.alert('Info', 'You are already on the Monthly plan');
          return;
        }
      } else if (currentBasePlanId === 'premium-year') {
        // Currently on yearly, can only downgrade
        if (changeType === 'downgrade' || changeType === 'monthly') {
          targetBasePlanId = 'premium';
          actionDescription = 'downgrade to Monthly';
        } else {
          Alert.alert('Info', 'You are already on the Yearly plan');
          return;
        }
      } else {
        // Can't detect current plan, allow switching to either
        if (changeType === 'upgrade' || changeType === 'yearly') {
          targetBasePlanId = 'premium-year';
          actionDescription = 'switch to Yearly';
        } else if (changeType === 'downgrade' || changeType === 'monthly') {
          targetBasePlanId = 'premium';
          actionDescription = 'switch to Monthly';
        }
      }

      console.log('Plan change:', {
        currentBasePlanId,
        targetBasePlanId,
        changeType,
      });

      Alert.alert(
        'Change Subscription Plan',
        `Do you want to ${actionDescription} plan?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Confirm',
            onPress: async () => {
              setProcessingProductId(targetProductId);
              setPurchaseResult('Processing plan change...');

              // Get the current subscription to find purchase token
              const currentSub = activeSubscriptions.find(
                (s) => s.productId === currentProductId,
              );

              if (Platform.OS === 'android') {
                // Android subscription replacement
                const targetSubWithDetails =
                  targetSubscription as ProductSubscriptionAndroid;
                const androidOffers = targetSubWithDetails.subscriptionOffers;
                const targetOffer = androidOffers?.find(
                  (offer) => offer.basePlanIdAndroid === targetBasePlanId,
                );

                if (!targetOffer) {
                  Alert.alert('Error', 'Target plan not available');
                  setProcessingProductId(null);
                  return;
                }

                // For Android, get purchase token from activeSubscriptions
                const extendedSub = currentSub as
                  ExtendedActiveSubscription | undefined;
                const purchaseToken =
                  extendedSub?.purchaseToken ||
                  extendedSub?.purchaseTokenAndroid;

                if (!purchaseToken) {
                  Alert.alert(
                    'Error',
                    'Unable to find current subscription purchase token. Please try refreshing your subscription status.',
                  );
                  setProcessingProductId(null);
                  return;
                }

                // Make sure purchase token is a string
                const tokenString =
                  typeof purchaseToken === 'string'
                    ? purchaseToken
                    : String(purchaseToken);

                // Make the request with proper token
                void requestPurchase({
                  request: {
                    google: {
                      skus: [targetProductId],
                      subscriptionOffers: targetOffer.offerTokenAndroid
                        ? [
                            {
                              sku: targetProductId,
                              offerToken: targetOffer.offerTokenAndroid,
                            },
                          ]
                        : undefined,
                      subscriptionProductReplacementParams: {
                        oldProductId: currentSub!.productId,
                        replacementMode: 'without-proration',
                      },
                      purchaseToken: tokenString,
                    },
                  },
                  type: 'subs',
                }).catch((err: PurchaseError) => {
                  console.log('Plan change failed:', {
                    code: err.code,
                    message: err.message,
                  });

                  // More helpful error messages
                  let errorMessage = err.message;
                  if (
                    err.message?.includes('DEVELOPER_ERROR') ||
                    err.message?.includes('Invalid arguments')
                  ) {
                    errorMessage =
                      'Unable to change subscription plan. This may be due to:\n' +
                      '• Subscriptions not being in the same group in Play Console\n' +
                      '• Invalid offer configuration\n' +
                      '• Missing purchase token\n\n' +
                      'Original error: ' +
                      err.message;
                  }

                  setProcessingProductId(null);
                  setPurchaseResult(`❌ Plan change failed: ${err.message}`);
                  Alert.alert('Plan Change Failed', errorMessage);
                });
              }
            },
          },
        ],
      );
    },
    [
      subscriptions,
      activeSubscriptions,
      setProcessingProductId,
      setPurchaseResult,
    ],
  );

  const copyToClipboard = (jsonString: string) => {
    Clipboard.setString(jsonString);
    Alert.alert('Copied', 'Subscription JSON copied to clipboard');
  };

  const renderSubscriptionDetails = useMemo(() => {
    if (!selectedSubscription) return null;

    const jsonString = stringifyForDisplay(selectedSubscription);

    // Check for subscription offers (cross-platform)
    const hasSubscriptionOffers =
      'subscriptionOffers' in selectedSubscription &&
      selectedSubscription.subscriptionOffers &&
      selectedSubscription.subscriptionOffers.length > 0;

    return (
      <View style={styles.modalContent}>
        <ScrollView style={styles.jsonContainer}>
          {/* Basic Info */}
          <Text style={styles.detailLabel}>Product ID:</Text>
          <Text style={styles.detailValue}>{selectedSubscription.id}</Text>

          <Text style={styles.detailLabel}>Title:</Text>
          <Text style={styles.detailValue}>{selectedSubscription.title}</Text>

          <Text style={styles.detailLabel}>Price:</Text>
          <Text style={styles.detailValue}>
            {selectedSubscription.displayPrice}
          </Text>

          {/* Subscription Offers (Cross-platform) */}
          {hasSubscriptionOffers && (
            <View style={styles.offersSection}>
              <Text style={styles.offersSectionTitle}>
                Subscription Offers (
                {selectedSubscription.subscriptionOffers!.length})
              </Text>
              {selectedSubscription.subscriptionOffers!.map(
                (offer: SubscriptionOffer, index: number) => (
                  <View
                    key={offer.offerTokenAndroid || offer.id || index}
                    style={styles.offerCard}
                  >
                    <Text style={styles.offerTitle}>
                      {offer.id || `Offer ${index + 1}`}
                    </Text>

                    <Text style={styles.offerDetailLabel}>Price:</Text>
                    <Text style={styles.offerValue}>{offer.displayPrice}</Text>

                    <Text style={styles.offerDetailLabel}>Type:</Text>
                    <Text style={styles.offerValue}>{offer.type}</Text>

                    {offer.paymentMode && (
                      <>
                        <Text style={styles.offerDetailLabel}>
                          Payment Mode:
                        </Text>
                        <Text style={styles.offerValue}>
                          {offer.paymentMode}
                        </Text>
                      </>
                    )}

                    {offer.period && (
                      <>
                        <Text style={styles.offerDetailLabel}>Period:</Text>
                        <Text style={styles.offerValue}>
                          {offer.period.value} {offer.period.unit}
                        </Text>
                      </>
                    )}

                    {offer.basePlanIdAndroid && (
                      <>
                        <Text style={styles.offerDetailLabel}>
                          Base Plan ID:
                        </Text>
                        <Text style={styles.offerValue}>
                          {offer.basePlanIdAndroid}
                        </Text>
                      </>
                    )}

                    {offer.pricingPhasesAndroid?.pricingPhaseList &&
                      offer.pricingPhasesAndroid.pricingPhaseList.length >
                        0 && (
                        <>
                          <Text style={styles.offerDetailLabel}>
                            Pricing Phases:
                          </Text>
                          {offer.pricingPhasesAndroid.pricingPhaseList.map(
                            (phase, phaseIndex) => (
                              <View
                                key={phaseIndex}
                                style={styles.pricingPhase}
                              >
                                <Text style={styles.phaseText}>
                                  Phase {phaseIndex + 1}: {phase.formattedPrice}{' '}
                                  / {phase.billingPeriod}
                                </Text>
                                <Text style={styles.phaseDetail}>
                                  Cycles: {phase.billingCycleCount}, Mode:{' '}
                                  {phase.recurrenceMode}
                                </Text>
                              </View>
                            ),
                          )}
                        </>
                      )}

                    {Array.isArray(offer.offerTagsAndroid) &&
                      offer.offerTagsAndroid.length > 0 && (
                        <>
                          <Text style={styles.offerDetailLabel}>Tags:</Text>
                          <Text style={styles.offerValue}>
                            {offer.offerTagsAndroid.join(', ')}
                          </Text>
                        </>
                      )}

                    {offer.offerTokenAndroid && (
                      <>
                        <Text style={styles.offerDetailLabel}>
                          Offer Token:
                        </Text>
                        <Text
                          style={[styles.offerValue, styles.offerTokenText]}
                          numberOfLines={2}
                        >
                          Present
                        </Text>
                      </>
                    )}
                  </View>
                ),
              )}
            </View>
          )}

          {/* Raw JSON Section */}
          <View style={styles.rawJsonSection}>
            <Text style={styles.rawJsonTitle}>Raw JSON:</Text>
            <Text style={styles.jsonText}>{jsonString}</Text>
          </View>
        </ScrollView>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.copyButton]}
            onPress={() => copyToClipboard(jsonString)}
          >
            <Text style={styles.actionButtonText}>📋 Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.consoleButton]}
            onPress={() => {
              console.log('=== SUBSCRIPTION DATA ===');
              console.log(jsonString);
              Alert.alert('Console', 'Subscription data logged to console');
            }}
          >
            <Text style={styles.actionButtonText}>🖥️ Console</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [selectedSubscription]);

  if (!connected) {
    return <Loading message="Connecting to Store..." />;
  }

  const renderIntroductoryOffer = (subscription: ProductSubscription) => {
    if (Platform.OS === 'ios' && 'introductoryPriceIOS' in subscription) {
      if (subscription.introductoryPriceIOS) {
        const paymentMode = subscription.introductoryPricePaymentModeIOS;
        const numberOfPeriods =
          subscription.introductoryPriceNumberOfPeriodsIOS;
        const subscriptionPeriod =
          subscription.introductoryPriceSubscriptionPeriodIOS;

        const periodLabel = subscriptionPeriod
          ? subscriptionPeriod.toLowerCase()
          : 'period';

        if (paymentMode === 'free-trial') {
          return `${numberOfPeriods} ${periodLabel} free trial`;
        }
        if (paymentMode === 'pay-as-you-go') {
          return `${subscription.introductoryPriceIOS} for ${numberOfPeriods} ${periodLabel}`;
        }
        if (paymentMode === 'pay-up-front') {
          return `${subscription.introductoryPriceIOS} for first ${numberOfPeriods} ${periodLabel}`;
        }
      }
    }
    return null;
  };

  const renderSubscriptionPeriod = (subscription: ProductSubscription) => {
    if (Platform.OS === 'ios' && 'subscriptionPeriodUnitIOS' in subscription) {
      const periodUnit = subscription.subscriptionPeriodUnitIOS;
      const periodNumber = subscription.subscriptionPeriodNumberIOS;
      if (periodUnit && periodNumber) {
        const units: Record<string, string> = {
          day: 'day',
          week: 'week',
          month: 'month',
          year: 'year',
        };
        const periodNum = parseInt(periodNumber, 10);
        const normalizedUnit = units[periodUnit] || periodUnit;
        return `${periodNumber} ${normalizedUnit}${periodNum > 1 ? 's' : ''}`;
      }
    }
    return 'subscription';
  };

  const renderSubscriptionPrice = (subscription: ProductSubscription) => {
    // Use cross-platform subscriptionOffers first
    if (
      'subscriptionOffers' in subscription &&
      subscription.subscriptionOffers
    ) {
      const offers = subscription.subscriptionOffers;
      if (offers && offers.length > 0) {
        const firstOffer = offers[0];
        // Use displayPrice from offer if available
        if (firstOffer?.displayPrice) {
          return firstOffer.displayPrice;
        }
        // Fallback to pricingPhasesAndroid
        if (firstOffer?.pricingPhasesAndroid?.pricingPhaseList) {
          const pricingPhaseList =
            firstOffer.pricingPhasesAndroid.pricingPhaseList;
          if (pricingPhaseList.length > 0) {
            const firstPhase = pricingPhaseList[0];
            if (firstPhase) {
              return firstPhase.formattedPrice;
            }
          }
        }
      }
      return subscription.displayPrice;
    }
    return subscription.displayPrice;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Subscription Flow</Text>
        <Text style={styles.subtitle}>
          React Native IAP Subscription Management with useIAP Hook
        </Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Store: {connected ? '✅ Connected' : '❌ Disconnected'}
          </Text>
          <Text style={styles.statusText}>
            Platform: {Platform.OS === 'ios' ? '🍎 iOS' : '🤖 Android'}
          </Text>
        </View>

        {/* Verification Method Selector */}
        <View style={styles.verificationContainer}>
          <Text style={styles.verificationLabel}>Purchase Verification:</Text>
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
      </View>

      {activeSubscriptions.length > 0 && (
        <View style={[styles.section, styles.statusSection]}>
          <Text style={styles.sectionTitle}>
            Store-reported Subscription Status
          </Text>
          <Text style={styles.statusLabel}>
            Store ownership is not server verification. Grant access only after
            successful verification.
          </Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[styles.statusValue, styles.activeStatus]}>
                ✅ Active
              </Text>
            </View>

            {(() => {
              // For iOS, filter to show only the most recent subscription in the group
              let subsToShow = [...activeSubscriptions];

              if (Platform.OS === 'ios') {
                // Filter out duplicates for iOS subscription group
                const premiumSubs = activeSubscriptions.filter(
                  (sub) =>
                    sub.productId === 'dev.hyo.martie.premium' ||
                    sub.productId === 'dev.hyo.martie.premium_year',
                );

                if (premiumSubs.length > 1) {
                  // Sort by transaction date and keep only the most recent
                  const sortedPremiumSubs = [...premiumSubs].sort((a, b) => {
                    const dateA = a.transactionDate ?? 0;
                    const dateB = b.transactionDate ?? 0;
                    return dateB - dateA;
                  });

                  const mostRecentPremium = sortedPremiumSubs[0];

                  // Filter out old premium subscriptions, keep only the most recent
                  subsToShow = activeSubscriptions.filter((sub) => {
                    if (
                      sub.productId === 'dev.hyo.martie.premium' ||
                      sub.productId === 'dev.hyo.martie.premium_year'
                    ) {
                      return sub === mostRecentPremium;
                    }
                    return true; // Keep all non-premium subscriptions
                  });
                }
              }

              return subsToShow.map((sub, index) => {
                // Find the matching subscription to get offer details
                const matchingSubscription = subscriptions.find(
                  (s) => s.id === sub.productId,
                );

                // Plan detection for dev.hyo.martie.premium
                let activeOfferLabel = '';
                let detectedBasePlanId = '';

                if (
                  (sub.productId === 'dev.hyo.martie.premium' ||
                    sub.productId === 'dev.hyo.martie.premium_year') &&
                  matchingSubscription
                ) {
                  const extendedSub = sub as ExtendedActiveSubscription;
                  console.log(
                    'Product ID:',
                    sub.productId,
                    'Is Upgraded?:',
                    extendedSub.isUpgradedIOS,
                  );

                  if (sub.productId === 'dev.hyo.martie.premium_year') {
                    detectedBasePlanId = 'premium-year';
                    activeOfferLabel = '📅 Yearly Plan';
                  } else if (Platform.OS === 'ios') {
                    detectedBasePlanId = 'premium';
                    activeOfferLabel = '📆 Monthly Plan';
                  } else {
                    // Android: Try to detect the base plan from various sources
                    // Method 1: Check if basePlanId is directly available from native
                    if (extendedSub.basePlanId) {
                      detectedBasePlanId = extendedSub.basePlanId;
                      activeOfferLabel =
                        detectedBasePlanId === 'premium-year'
                          ? '📅 Yearly Plan'
                          : '📆 Monthly Plan';
                    }
                    // Method 2: fall back to the last purchased plan in state
                    else {
                      const storedPlan = lastPurchasedPlan;

                      if (storedPlan === 'premium-year') {
                        detectedBasePlanId = 'premium-year';
                        activeOfferLabel = '📅 Yearly Plan';
                      } else {
                        // Default to monthly
                        detectedBasePlanId = 'premium';
                        activeOfferLabel = '📆 Monthly Plan';
                      }

                      console.log(
                        'Detected plan from state:',
                        storedPlan || 'none (defaulting to monthly)',
                      );
                    }
                  }

                  // We'll use this detectedBasePlanId in the button section below
                }

                return (
                  <View
                    key={sub.productId + index}
                    style={styles.subscriptionStatusItem}
                  >
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Product:</Text>
                      <Text style={styles.statusValue}>{sub.productId}</Text>
                    </View>

                    {activeOfferLabel &&
                      (sub.productId === 'dev.hyo.martie.premium' ||
                        sub.productId === 'dev.hyo.martie.premium_year') && (
                        <View style={styles.statusRow}>
                          <Text style={styles.statusLabel}>Current Plan:</Text>
                          <Text style={[styles.statusValue, styles.offerLabel]}>
                            {activeOfferLabel}
                          </Text>
                        </View>
                      )}

                    {sub.expirationDateIOS && (
                      <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Expires:</Text>
                        <Text style={styles.statusValue}>
                          {new Date(sub.expirationDateIOS).toLocaleDateString()}
                        </Text>
                      </View>
                    )}

                    {Platform.OS === 'android' &&
                      sub.isActive !== undefined && (
                        <View style={styles.statusRow}>
                          <Text style={styles.statusLabel}>Auto-Renew:</Text>
                          <Text
                            style={[
                              styles.statusValue,
                              sub.isActive
                                ? styles.activeStatus
                                : styles.cancelledStatus,
                            ]}
                          >
                            {sub.isActive ? '✅ Enabled' : '⚠️ Cancelled'}
                          </Text>
                        </View>
                      )}

                    {sub.transactionId && (
                      <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Transaction ID:</Text>
                        <Text
                          style={[styles.statusValue, styles.transactionId]}
                        >
                          {sub.transactionId.substring(0, 10)}...
                        </Text>
                      </View>
                    )}

                    {/* renewalInfoIOS showcase */}
                    {Platform.OS === 'ios' && sub.renewalInfoIOS && (
                      <View style={styles.renewalInfoSection}>
                        <Text style={styles.renewalInfoTitle}>
                          📱 iOS Renewal Info (NEW!)
                        </Text>

                        {/* Auto-renew status */}
                        <View style={styles.statusRow}>
                          <Text style={styles.statusLabel}>
                            Will Auto-Renew:
                          </Text>
                          <Text
                            style={[
                              styles.statusValue,
                              sub.renewalInfoIOS.willAutoRenew
                                ? styles.activeStatus
                                : styles.cancelledStatus,
                            ]}
                          >
                            {sub.renewalInfoIOS.willAutoRenew
                              ? '✅ Yes'
                              : '⚠️ No'}
                          </Text>
                        </View>

                        {/* Pending upgrade detection */}
                        {sub.renewalInfoIOS.pendingUpgradeProductId && (
                          <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>
                              Upgrade Pending:
                            </Text>
                            <Text
                              style={[styles.statusValue, styles.upgradeText]}
                            >
                              ⬆️ {sub.renewalInfoIOS.pendingUpgradeProductId}
                            </Text>
                          </View>
                        )}

                        {/* Next renewal date */}
                        {sub.renewalInfoIOS.renewalDate && (
                          <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>
                              Next Renewal:
                            </Text>
                            <Text style={styles.statusValue}>
                              {new Date(
                                sub.renewalInfoIOS.renewalDate,
                              ).toLocaleDateString()}
                            </Text>
                          </View>
                        )}

                        {/* Expiration reason */}
                        {sub.renewalInfoIOS.expirationReason && (
                          <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>
                              Expiration Reason:
                            </Text>
                            <Text style={styles.statusValue}>
                              {sub.renewalInfoIOS.expirationReason}
                            </Text>
                          </View>
                        )}

                        {/* Billing retry status */}
                        {sub.renewalInfoIOS.isInBillingRetry && (
                          <>
                            <View style={styles.statusRow}>
                              <Text style={styles.statusLabel}>
                                Billing Status:
                              </Text>
                              <Text
                                style={[
                                  styles.statusValue,
                                  styles.billingRetryText,
                                ]}
                              >
                                💳 In Billing Retry
                              </Text>
                            </View>
                            {sub.renewalInfoIOS.gracePeriodExpirationDate && (
                              <View style={styles.statusRow}>
                                <Text style={styles.statusLabel}>
                                  Grace Period Ends:
                                </Text>
                                <Text style={styles.statusValue}>
                                  {new Date(
                                    sub.renewalInfoIOS
                                      .gracePeriodExpirationDate,
                                  ).toLocaleDateString()}
                                </Text>
                              </View>
                            )}
                          </>
                        )}

                        {/* Price increase status */}
                        {sub.renewalInfoIOS.priceIncreaseStatus && (
                          <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>
                              Price Increase:
                            </Text>
                            <Text style={styles.statusValue}>
                              {sub.renewalInfoIOS.priceIncreaseStatus}
                            </Text>
                          </View>
                        )}

                        {/* Auto-renew preference (if different from current product) */}
                        {sub.renewalInfoIOS.autoRenewPreference &&
                          sub.renewalInfoIOS.autoRenewPreference !==
                            sub.productId && (
                            <View style={styles.statusRow}>
                              <Text style={styles.statusLabel}>
                                Will Renew As:
                              </Text>
                              <Text style={styles.statusValue}>
                                {sub.renewalInfoIOS.autoRenewPreference}
                              </Text>
                            </View>
                          )}

                        {/* Renewal offer type */}
                        {sub.renewalInfoIOS.renewalOfferType && (
                          <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>
                              🆕 Offer Type:
                            </Text>
                            <Text style={styles.statusValue}>
                              {sub.renewalInfoIOS.renewalOfferType}
                            </Text>
                          </View>
                        )}

                        {/* Renewal offer ID */}
                        {sub.renewalInfoIOS.renewalOfferId && (
                          <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>🆕 Offer ID:</Text>
                            <Text style={styles.statusValue}>
                              {sub.renewalInfoIOS.renewalOfferId}
                            </Text>
                          </View>
                        )}

                        {/* JSON Representation availability */}
                        {sub.renewalInfoIOS.jsonRepresentation && (
                          <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>
                              🆕 JSON Available:
                            </Text>
                            <Text
                              style={[styles.statusValue, styles.activeStatus]}
                            >
                              ✅ Yes
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              });
            })()}
          </View>

          {/* Upgrade/Downgrade button for Android only */}
          {subscriptions.some((subscription) =>
            subscription.subscriptionOffers?.some(
              (offer) =>
                offer.basePlanIdAndroid === 'premium' ||
                offer.basePlanIdAndroid === 'premium-year',
            ),
          ) && (
            <PlanChangeControls
              activeSubscriptions={activeSubscriptions}
              handlePlanChange={handlePlanChange}
              isProcessing={isProcessing}
              lastPurchasedPlan={lastPurchasedPlan}
            />
          )}

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefreshStatus}
            disabled={isCheckingStatus}
          >
            {isCheckingStatus ? (
              <ActivityIndicator color="#007AFF" />
            ) : (
              <Text style={styles.refreshButtonText}>Check Status</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Subscription Upgrade Detection - iOS renewalInfo from ActiveSubscription */}
      {Platform.OS === 'ios' &&
      activeSubscriptions.length > 0 &&
      activeSubscriptions.some((sub) => {
        const pendingProductId = sub.renewalInfoIOS?.pendingUpgradeProductId;

        // Show upgrade card if there's a pending upgrade product that's different
        // from the current product. In production, you might want to also check
        // willAutoRenew, but Apple Sandbox behavior can be inconsistent.
        return pendingProductId && pendingProductId !== sub.productId;
      }) ? (
        <View style={[styles.section, styles.upgradeDetectionSection]}>
          <View style={styles.upgradeDetectionCard}>
            <Text style={styles.upgradeDetectionTitle}>
              🎉 Subscription Upgrade Detected
            </Text>
            <Text style={styles.upgradeDetectionSubtitle}>
              Your subscription will be upgraded at the next renewal
            </Text>

            {activeSubscriptions.map((sub) => {
              const renewalInfo = sub.renewalInfoIOS;
              const pendingProductId = renewalInfo?.pendingUpgradeProductId;

              if (!pendingProductId || pendingProductId === sub.productId) {
                return null;
              }

              const currentProduct = subscriptions.find(
                (s) => s.id === sub.productId,
              );
              const upgradingToProduct = subscriptions.find(
                (s) => s.id === pendingProductId,
              );

              return (
                <View key={sub.productId} style={styles.upgradeFlowContainer}>
                  <View style={styles.upgradeProductBox}>
                    <Text style={styles.upgradeProductLabel}>Current Plan</Text>
                    <Text style={styles.upgradeProductTitle}>
                      {currentProduct?.title || sub.productId}
                    </Text>
                  </View>

                  <Text style={styles.upgradeArrow}>→</Text>

                  <View style={styles.upgradeProductBox}>
                    <Text style={styles.upgradeProductLabel}>Upgrading To</Text>
                    <Text
                      style={[
                        styles.upgradeProductTitle,
                        styles.upgradingProduct,
                      ]}
                    >
                      {upgradingToProduct?.title || pendingProductId}
                    </Text>
                  </View>

                  {renewalInfo?.willAutoRenew !== undefined ? (
                    <View style={styles.upgradeRow}>
                      <Text style={styles.upgradeLabel}>Auto-Renew:</Text>
                      <Text
                        style={[
                          styles.upgradeValue,
                          renewalInfo.willAutoRenew
                            ? styles.activeStatus
                            : styles.cancelledStatus,
                        ]}
                      >
                        {renewalInfo.willAutoRenew
                          ? '✅ Enabled'
                          : '⚠️ Disabled'}
                      </Text>
                    </View>
                  ) : null}

                  {renewalInfo?.renewalDate ? (
                    <View style={styles.upgradeRow}>
                      <Text style={styles.upgradeLabel}>Renewal Date:</Text>
                      <Text style={styles.upgradeValue}>
                        {new Date(renewalInfo.renewalDate).toLocaleDateString()}
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.viewRenewalInfoButton}
                    onPress={() => {
                      const details = stringifyForDisplay(renewalInfo);
                      Alert.alert('Renewal Info', details, [
                        {
                          text: 'Copy',
                          onPress: () => Clipboard.setString(details),
                        },
                        {text: 'Close'},
                      ]);
                    }}
                  >
                    <Text style={styles.viewRenewalInfoButtonText}>
                      View Full renewalInfo
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Subscription Cancellation Detection - iOS renewalInfo from ActiveSubscription */}
      {Platform.OS === 'ios' &&
      activeSubscriptions.length > 0 &&
      activeSubscriptions.some((sub) => {
        const renewalInfo = sub.renewalInfoIOS;

        // Show cancellation card if willAutoRenew is false and no pending upgrade
        return (
          renewalInfo?.willAutoRenew === false &&
          !renewalInfo?.pendingUpgradeProductId
        );
      }) ? (
        <View style={[styles.section, styles.cancellationDetectionSection]}>
          <View style={styles.cancellationDetectionCard}>
            <Text style={styles.cancellationDetectionTitle}>
              ⚠️ Subscription Will Not Renew
            </Text>
            <Text style={styles.cancellationDetectionSubtitle}>
              Your subscription is active but will not automatically renew
            </Text>

            {activeSubscriptions.map((sub) => {
              const renewalInfo = sub.renewalInfoIOS;

              if (
                renewalInfo?.willAutoRenew !== false ||
                renewalInfo?.pendingUpgradeProductId
              ) {
                return null;
              }

              const currentProduct = subscriptions.find(
                (s) => s.id === sub.productId,
              );

              return (
                <View
                  key={sub.productId}
                  style={styles.cancellationInfoContainer}
                >
                  <View style={styles.cancellationProductBox}>
                    <Text style={styles.cancellationProductLabel}>
                      Active Until
                    </Text>
                    <Text style={styles.cancellationProductTitle}>
                      {currentProduct?.title || sub.productId}
                    </Text>
                    {renewalInfo?.renewalDate ? (
                      <Text style={styles.cancellationExpiryDate}>
                        Expires:{' '}
                        {new Date(renewalInfo.renewalDate).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.viewRenewalInfoButton}
                    onPress={() => {
                      const details = stringifyForDisplay(renewalInfo);
                      Alert.alert('Renewal Info', details, [
                        {
                          text: 'Copy',
                          onPress: () => Clipboard.setString(details),
                        },
                        {text: 'Close'},
                      ]);
                    }}
                  >
                    <Text style={styles.viewRenewalInfoButtonText}>
                      View Full renewalInfo
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Subscriptions</Text>
          <TouchableOpacity
            style={styles.manageButton}
            onPress={onManageSubscriptions}
          >
            <Text style={styles.manageButtonText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSubtitle}>
          {subscriptions.length > 0
            ? `${subscriptions.length} subscription(s) available`
            : 'No subscriptions found. Configure products in the console.'}
        </Text>

        {subscriptions.length > 0 ? (
          subscriptions.map((subscription, index) => {
            const introOffer = renderIntroductoryOffer(subscription);
            const periodLabel = renderSubscriptionPeriod(subscription);
            const priceLabel = renderSubscriptionPrice(subscription);
            const owned = ownedSubscriptions.has(subscription.id);

            return (
              <View key={subscription.id} style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <View style={{flex: 1}}>
                    <Text style={styles.subscriptionTitle}>
                      {subscription.title}
                    </Text>
                    <Text style={styles.subscriptionDescription}>
                      {subscription.description}
                    </Text>
                  </View>
                  <TouchableOpacity
                    focusable={true}
                    style={styles.infoButton}
                    onPress={() => handleSubscriptionPress(subscription)}
                  >
                    <Text style={styles.infoButtonText}>ℹ️</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.subscriptionMeta}>
                  <Text style={styles.subscriptionPrice}>{priceLabel}</Text>
                  <Text style={styles.subscriptionPeriod}>{periodLabel}</Text>
                </View>

                {introOffer ? (
                  <View style={styles.badgeIntroOffer}>
                    <Text style={styles.badgeIntroOfferText}>{introOffer}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  focusable={true}
                  hasTVPreferredFocus={index === 0}
                  style={[
                    styles.subscribeButton,
                    owned && styles.subscribeButtonOwned,
                  ]}
                  onPress={() => handleSubscription(subscription.id)}
                  disabled={isProcessing || owned}
                >
                  <Text
                    style={[
                      styles.subscribeButtonText,
                      owned && styles.subscribeButtonOwnedText,
                    ]}
                  >
                    {owned
                      ? 'Already Subscribed'
                      : isProcessing
                        ? 'Processing...'
                        : 'Subscribe'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No subscriptions found. Please configure your products.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetryLoadSubscriptions}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {purchaseResult || pendingPlanChange || lastPurchase ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest Activity</Text>
          {purchaseResult ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultText}>{purchaseResult}</Text>
            </View>
          ) : null}
          {pendingPlanChange ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultText}>{pendingPlanChange}</Text>
            </View>
          ) : null}
          {lastPurchase ? (
            <View style={styles.latestPurchaseContainer}>
              <Text style={styles.latestPurchaseTitle}>Latest Purchase</Text>
              <PurchaseSummaryRow purchase={lastPurchase} onPress={() => {}} />
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Subscription Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            {renderSubscriptionDetails}
          </View>
        </View>
      </Modal>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>🔄 Key Features with useIAP Hook</Text>
        <Text style={styles.infoText}>
          • Automatic connection handling and purchase recovery
        </Text>
        <Text style={styles.infoText}>
          • Active subscription tracking with `getActiveSubscriptions`
        </Text>
        <Text style={styles.infoText}>
          • Auto-refresh of purchases after successful transactions
        </Text>
        <Text style={styles.infoText}>
          • Platform-specific offer handling built-in
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * Subscription Flow Container: subscriptions through the app's purchase flow.
 *
 * - useIAP connects to the store. Given `purchaseFlow`, it also recovers
 *   unfinished purchases, reports each outcome, and refreshes
 *   activeSubscriptions and availablePurchases afterwards.
 * - requestPurchase opens the store sheet. The flow confirms the purchase with
 *   the selected verification method, then finishes it
 *   (src/utils/purchaseFlow.ts).
 * - Status: iOS reports renewalInfoIOS (willAutoRenew, pendingUpgradeProductId,
 *   isInBillingRetry, ...); the Android client reports only auto-renewal, so
 *   the rest needs a server. Refunds bypass the client: use App Store Server
 *   Notifications V2 or Play RTDN.
 */
function SubscriptionFlowContainer() {
  // From requestPurchase until that product's outcome or a purchase error.
  const [processingProductId, setProcessingProductId] = useState<string | null>(
    null,
  );
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState('');
  const [lastPurchase, setLastPurchase] = useState<Purchase | null>(null);
  const [lastPurchasedPlan, setLastPurchasedPlan] = useState<string | null>(
    null,
  );
  const statusAutoCheckedRef = useRef(false);
  const {
    verificationMethod,
    verificationMethodSelectorVisible,
    hideVerificationMethodSelector,
    selectVerificationMethod,
    showVerificationMethodSelector,
  } = useVerificationMethod();

  const {
    connected,
    subscriptions,
    availablePurchases,
    activeSubscriptions: storeActiveSubscriptions,
    fetchProducts,
    getAvailablePurchases,
    getActiveSubscriptions,
  } = useIAP({
    purchaseFlow,
    onPurchaseFlowOutcome: ({purchase, status}) => {
      const productId = subscriptionProductId(purchase);
      if (!productId) return;
      setLastPurchase(purchase);
      setProcessingProductId((current) =>
        current === productId ? null : current,
      );
      // iOS and Amazon sell each plan as its own product.
      if (
        Platform.OS === 'ios' ||
        purchase.store === 'amazon' ||
        (purchase.store === 'unknown' && purchase.storeId === 'amazon_example')
      ) {
        setLastPurchasedPlan(
          productId === 'dev.hyo.martie.premium_year'
            ? 'premium-year'
            : 'premium',
        );
      }
      setPurchaseResult(describePurchaseOutcome(status));
      alertPurchaseOutcome(status);
    },
    onPurchaseError: (error: PurchaseError) => {
      setProcessingProductId(null);
      if (error.code === ErrorCode.UserCancelled) {
        setPurchaseResult('Subscription cancelled by user');
        return;
      }
      setPurchaseResult(`❌ Subscription failed: ${error.message}`);
      showNativeAlert('Subscription Failed', error.message);
    },
  });

  // A requested upgrade, downgrade, or prepaid top-up the store has not
  // applied. useIAP refreshes availablePurchases after every outcome, so the
  // note stays until the store applies it.
  const pendingPlanChange = useMemo(() => {
    for (const purchase of availablePurchases) {
      const change =
        'pendingPurchaseUpdateAndroid' in purchase
          ? purchase.pendingPurchaseUpdateAndroid
          : null;
      if (change && subscriptionProductId(purchase)) {
        return (
          `Plan change to ${change.products.join(', ')} is pending. ` +
          `${purchase.productId} stays active until it applies.`
        );
      }
    }
    return null;
  }, [availablePurchases]);

  const activeSubscriptions = useMemo(
    () =>
      storeActiveSubscriptions.flatMap((subscription) => {
        const productId = getSubscriptionProductId(
          subscription.productId,
          subscription.currentPlanId,
        );
        return productId && SUBSCRIPTION_PRODUCT_IDS.includes(productId)
          ? [{...subscription, productId}]
          : [];
      }),
    [storeActiveSubscriptions],
  );

  useEffect(() => {
    if (!connected) return;
    fetchProducts({skus: SUBSCRIPTION_PRODUCT_IDS, type: 'subs'}).catch(
      (error) => {
        setPurchaseResult(
          `❌ Subscription loading failed: ${getErrorMessage(error)}`,
        );
      },
    );
    // Shows a plan change still pending from an earlier session.
    getAvailablePurchases().catch((error) => {
      console.log('[SubscriptionFlow] getAvailablePurchases error:', error);
    });
  }, [connected, fetchProducts, getAvailablePurchases]);

  // Log discount and promotional offer data
  useEffect(() => {
    if (subscriptions.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 [SubscriptionFlow] DISCOUNT DATA CHECK:');
      console.log(`   Total subscriptions: ${subscriptions.length}`);

      subscriptions.forEach((sub) => {
        console.log(`\n   📦 Subscription: ${sub.id}`);
        console.log(`      • Title: ${sub.title}`);
        const price = 'localizedPrice' in sub ? sub.localizedPrice : sub.price;
        console.log(`      • Price: ${price}`);

        // iOS specific fields
        if (Platform.OS === 'ios' && 'introductoryPricePaymentModeIOS' in sub) {
          console.log(
            `      • introductoryPricePaymentModeIOS: ${
              sub.introductoryPricePaymentModeIOS || 'null'
            }`,
          );
          console.log(
            `      • introductoryPriceIOS: ${
              sub.introductoryPriceIOS || 'null'
            }`,
          );
        }

        // Cross-platform subscription offers
        if ('subscriptionOffers' in sub && sub.subscriptionOffers) {
          console.log(
            `      • subscriptionOffers: ${
              sub.subscriptionOffers.length || 0
            } offer(s)`,
          );
        }
      });

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }, [subscriptions]);

  // ──────────────────────────────────────────────────────────────────────────
  // CHECKING SUBSCRIPTION STATUS
  // ──────────────────────────────────────────────────────────────────────────
  // Check periodically for cancellations (willAutoRenew = false), billing
  // issues (isInBillingRetry = true), pending upgrades/downgrades
  // (pendingUpgradeProductId), and grace periods (gracePeriodExpirationDate).
  const handleRefreshStatus = useCallback(async () => {
    if (!connected || isCheckingStatus) return;

    setIsCheckingStatus(true);
    try {
      // The key status API; results carry platform-specific renewal info.
      const activeSubs = await getActiveSubscriptions();
      console.log('\n===== Active Subscriptions Check =====');
      console.log('Total subscriptions:', activeSubs.length);
      console.log(
        'Subscription summary:',
        activeSubs.map((sub) => ({
          productId: sub.productId,
          isActive: sub.isActive,
          expirationDateIOS: sub.expirationDateIOS,
          environmentIOS: sub.environmentIOS,
        })),
      );

      // For iOS, check if there's a pending change in renewalInfo
      if (Platform.OS === 'ios') {
        const premiumSubs = activeSubs.filter(
          (sub) =>
            sub.productId === 'dev.hyo.martie.premium' ||
            sub.productId === 'dev.hyo.martie.premium_year',
        );

        console.log('\n===== iOS Subscription Analysis =====');
        console.log('Premium subscriptions found:', premiumSubs.length);

        premiumSubs.forEach((sub, index) => {
          console.log(`\n[Subscription ${index + 1}]`);
          console.log('  productId:', sub.productId);
          console.log(
            '  transactionDate:',
            sub.transactionDate
              ? new Date(sub.transactionDate).toISOString()
              : 'N/A',
          );
          console.log('  transactionId:', sub.transactionId);
          console.log('  expirationDateIOS:', sub.expirationDateIOS);
          console.log('  environmentIOS:', sub.environmentIOS);

          // Log every renewalInfoIOS field when present
          if (sub.renewalInfoIOS) {
            console.log('  ✅ renewalInfoIOS EXISTS:');
            console.log('    willAutoRenew:', sub.renewalInfoIOS.willAutoRenew);
            console.log(
              '    pendingUpgradeProductId:',
              sub.renewalInfoIOS.pendingUpgradeProductId,
            );
            console.log(
              '    autoRenewPreference:',
              sub.renewalInfoIOS.autoRenewPreference,
            );
            console.log('    renewalDate:', sub.renewalInfoIOS.renewalDate);
            console.log(
              '    expirationReason:',
              sub.renewalInfoIOS.expirationReason,
            );
            console.log(
              '    isInBillingRetry:',
              sub.renewalInfoIOS.isInBillingRetry,
            );
            console.log(
              '    gracePeriodExpirationDate:',
              sub.renewalInfoIOS.gracePeriodExpirationDate,
            );
            console.log(
              '    priceIncreaseStatus:',
              sub.renewalInfoIOS.priceIncreaseStatus,
            );
            // Confirm the renewal offer fields come through
            console.log(
              '    🆕 renewalOfferType:',
              sub.renewalInfoIOS.renewalOfferType,
            );
            console.log(
              '    🆕 renewalOfferId:',
              sub.renewalInfoIOS.renewalOfferId,
            );
            console.log(
              '    has jsonRepresentation:',
              Boolean(sub.renewalInfoIOS.jsonRepresentation),
            );
          } else {
            console.log('  ❌ renewalInfoIOS is NULL/UNDEFINED');
          }
        });
        console.log('===================================\n');
      }
    } catch (error) {
      console.log(
        'Error checking subscription status:',
        getErrorMessage(error),
      );
    } finally {
      setIsCheckingStatus(false);
    }
  }, [connected, getActiveSubscriptions, isCheckingStatus]);

  useEffect(() => {
    if (connected && !statusAutoCheckedRef.current) {
      const timer = setTimeout(() => {
        statusAutoCheckedRef.current = true;
        void handleRefreshStatus();
      }, 500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [connected, handleRefreshStatus]);

  // ──────────────────────────────────────────────────────────────────────────
  // REQUEST SUBSCRIPTION PURCHASE
  // ──────────────────────────────────────────────────────────────────────────
  // iOS: pass the sku, plus an optional appAccountToken to track the user;
  // StoreKit handles offer eligibility.
  // Android: pass subscriptionOffers, each with the offerToken of a base plan
  // (monthly/yearly) or promotional offer from the product's subscriptionOffers.
  const handleSubscription = useCallback(
    (itemId: string) => {
      setProcessingProductId(itemId);
      setPurchaseResult('Processing subscription...');

      requestPurchase({
        request: {
          apple: {
            sku: itemId,
            appAccountToken: 'user-123',
          },
          // Without subscriptionOffers the store picks the default offer;
          // Amazon subscriptions have none.
          google: {skus: [itemId]},
        },
        type: 'subs',
      }).catch((err: PurchaseError) => {
        setProcessingProductId(null);
        if (err.code === ErrorCode.UserCancelled) {
          setPurchaseResult('Subscription cancelled by user');
          return;
        }

        setPurchaseResult(`❌ Subscription failed: ${err.message}`);
        Alert.alert('Subscription Failed', err.message);
      });
    },
    [],
  );

  // Retry loading subscriptions (useful when products fail to load initially)
  const handleRetryLoadSubscriptions = useCallback(() => {
    fetchProducts({
      skus: SUBSCRIPTION_PRODUCT_IDS,
      type: 'subs',
    }).catch((error) => {
      const message = getErrorMessage(error);
      console.log('[SubscriptionFlow] retry fetchProducts error:', message);
      setPurchaseResult(`❌ Subscription loading failed: ${message}`);
    });
  }, [fetchProducts]);

  // ──────────────────────────────────────────────────────────────────────────
  // MANAGE SUBSCRIPTIONS (Deep link to platform settings)
  // ──────────────────────────────────────────────────────────────────────────
  // Opens the platform's subscription management screen, where users cancel,
  // change plans (upgrade/downgrade), update payment methods, and view history.
  const handleManageSubscriptions = useCallback(async () => {
    try {
      await deepLinkToSubscriptions();
    } catch (error) {
      console.log(
        'Failed to open subscription management:',
        getErrorMessage(error),
      );
      Alert.alert(
        'Cannot Open',
        'Unable to open the subscription management screen on this device.',
      );
    }
  }, []);

  return (
    <>
      <SubscriptionFlow
        connected={connected}
        subscriptions={subscriptions}
        activeSubscriptions={activeSubscriptions}
        purchaseResult={purchaseResult}
        isProcessing={processingProductId !== null}
        isCheckingStatus={isCheckingStatus}
        lastPurchase={lastPurchase}
        lastPurchasedPlan={lastPurchasedPlan}
        pendingPlanChange={pendingPlanChange}
        verificationMethod={verificationMethod}
        setProcessingProductId={setProcessingProductId}
        setPurchaseResult={setPurchaseResult}
        onSubscribe={handleSubscription}
        onRetryLoadSubscriptions={handleRetryLoadSubscriptions}
        onRefreshStatus={handleRefreshStatus}
        onManageSubscriptions={handleManageSubscriptions}
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
export default SubscriptionFlowContainer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  header: {
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#1f3c88',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  statusContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statusText: {
    color: 'white',
    fontSize: 13,
    marginBottom: 4,
  },
  verificationContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  verificationLabel: {
    color: 'white',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  verificationButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  verificationButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  verificationButtonHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1f36',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#5f6470',
    marginTop: 6,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e1e7ef',
    marginVertical: 20,
  },
  subscriptionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1f36',
  },
  subscriptionDescription: {
    fontSize: 13,
    color: '#5f6470',
    marginTop: 4,
  },
  subscriptionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  subscriptionPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1f36',
  },
  subscriptionPeriod: {
    fontSize: 13,
    color: '#5f6470',
  },
  badgeIntroOffer: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ff8c42',
  },
  badgeIntroOfferText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subscribeButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#1f3c88',
  },
  subscribeButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  subscribeButtonOwned: {
    backgroundColor: 'rgba(31,60,136,0.1)',
  },
  subscribeButtonOwnedText: {
    color: '#1f3c88',
  },
  infoButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f4ff',
  },
  infoButtonText: {
    fontSize: 16,
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#5f6470',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1f3c88',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  statusSection: {
    paddingTop: 32,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    color: '#5f6470',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1f36',
  },
  activeStatus: {
    color: '#1f8a70',
  },
  cancelledStatus: {
    color: '#d7263d',
  },
  subscriptionStatusItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e7ef',
    borderRadius: 12,
  },
  refreshButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f3c88',
    backgroundColor: 'white',
  },
  refreshButtonText: {
    color: '#1f3c88',
    fontWeight: '600',
    fontSize: 14,
  },
  manageButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31,60,136,0.1)',
  },
  manageButtonText: {
    color: '#1f3c88',
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 16,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1f8a70',
  },
  resultText: {
    fontSize: 13,
    color: '#1a1f36',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  latestPurchaseContainer: {
    marginTop: 16,
    gap: 12,
  },
  latestPurchaseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1f36',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e1e7ef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1f36',
  },
  closeButton: {
    padding: 6,
  },
  closeButtonText: {
    fontSize: 22,
    color: '#5f6470',
  },
  modalContent: {
    padding: 18,
  },
  modalLabel: {
    fontSize: 12,
    color: '#5f6470',
  },
  modalValue: {
    fontSize: 14,
    color: '#1a1f36',
  },
  jsonContainer: {
    maxHeight: 320,
    borderRadius: 12,
    backgroundColor: '#f7f9fc',
    padding: 16,
  },
  jsonText: {
    fontSize: 12,
    color: '#1a1f36',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  copyButton: {
    backgroundColor: '#1f3c88',
  },
  consoleButton: {
    backgroundColor: '#1f8a70',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  purchaseDetailsContainer: {
    gap: 12,
  },
  purchaseDetailRow: {
    flexDirection: 'column',
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e1e7ef',
  },
  infoSection: {
    margin: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1f36',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#1a1f36',
    marginBottom: 6,
  },
  offerLabel: {
    fontWeight: '600',
    color: '#1f3c88',
  },
  transactionId: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    color: '#5f6470',
  },
  renewalInfoSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1e7ef',
  },
  renewalInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f3c88',
    marginBottom: 8,
  },
  upgradeText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  cancelledText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  billingRetryText: {
    color: '#8b5cf6',
    fontWeight: '600',
  },
  planChangeSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  planChangeOptions: {
    gap: 8,
  },
  changePlanButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  changePlanButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  changePlanButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  upgradeButton: {
    backgroundColor: '#4CAF50',
  },
  downgradeButton: {
    backgroundColor: '#FF9800',
  },
  switchButton: {
    backgroundColor: '#2196F3',
  },
  selectButton: {
    backgroundColor: '#9C27B0',
  },
  warningText: {
    fontSize: 13,
    color: '#FF9800',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    color: '#1a1f36',
  },
  // Upgrade Detection Styles
  upgradeDetectionSection: {
    paddingTop: 20,
  },
  upgradeDetectionCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#ff9800',
  },
  upgradeDetectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e65100',
    marginBottom: 8,
  },
  upgradeDetectionSubtitle: {
    fontSize: 14,
    color: '#5f6470',
    marginBottom: 16,
  },
  upgradeFlowContainer: {
    marginTop: 12,
    gap: 12,
  },
  upgradeProductBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e7ef',
  },
  upgradeProductLabel: {
    fontSize: 12,
    color: '#5f6470',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  upgradeProductTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1f36',
  },
  upgradingProduct: {
    color: '#ff9800',
  },
  upgradeArrow: {
    fontSize: 24,
    color: '#ff9800',
    textAlign: 'center',
    fontWeight: '700',
  },
  upgradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  upgradeLabel: {
    fontSize: 13,
    color: '#5f6470',
    fontWeight: '600',
  },
  upgradeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1f36',
  },
  viewRenewalInfoButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff9800',
    backgroundColor: 'white',
  },
  viewRenewalInfoButtonText: {
    color: '#ff9800',
    fontWeight: '600',
    fontSize: 14,
  },
  // Cancellation Detection Styles
  cancellationDetectionSection: {
    paddingTop: 20,
  },
  cancellationDetectionCard: {
    backgroundColor: '#fff9e6',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#ffc107',
  },
  cancellationDetectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f57c00',
    marginBottom: 8,
  },
  cancellationDetectionSubtitle: {
    fontSize: 14,
    color: '#5f6470',
    marginBottom: 16,
  },
  cancellationInfoContainer: {
    marginTop: 12,
    gap: 12,
  },
  cancellationProductBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e7ef',
  },
  cancellationProductLabel: {
    fontSize: 12,
    color: '#5f6470',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cancellationProductTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1f36',
    marginBottom: 4,
  },
  cancellationExpiryDate: {
    fontSize: 14,
    color: '#f57c00',
    fontWeight: '600',
  },
  // Offer Details Styles (Modal)
  detailLabel: {
    fontSize: 12,
    color: '#5f6470',
    fontWeight: '600',
    marginTop: 8,
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1f36',
    marginTop: 2,
    marginBottom: 4,
  },
  offersSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e1e7ef',
  },
  offersSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1f36',
    marginBottom: 12,
  },
  offerCard: {
    backgroundColor: '#f1f4ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1f3c88',
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f3c88',
    marginBottom: 10,
  },
  offerDetailLabel: {
    fontSize: 11,
    color: '#5f6470',
    marginTop: 8,
    fontWeight: '600',
  },
  offerValue: {
    fontSize: 13,
    color: '#1a1f36',
    marginTop: 2,
  },
  offerValueDiscount: {
    fontSize: 13,
    color: '#E53935',
    marginTop: 2,
    fontWeight: '700',
  },
  offerTokenText: {
    fontSize: 10,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  pricingPhase: {
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    marginBottom: 2,
  },
  phaseText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
  },
  phaseDetail: {
    fontSize: 10,
    color: '#5f6470',
    marginTop: 2,
  },
  rawJsonSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e1e7ef',
  },
  rawJsonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5f6470',
    marginBottom: 8,
  },
});
