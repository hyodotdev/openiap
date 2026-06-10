import React, {useMemo, useState} from 'react';
import {
  LogBox,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {ActionSheetProvider} from '@expo/react-native-action-sheet';
import AllProducts from './app/all-products';
import AlternativeBilling from './app/alternative-billing';
import AvailablePurchases from './app/available-purchases';
import Home from './app/index';
import OfferCode from './app/offer-code';
import PurchaseFlow from './app/purchase-flow';
import SubscriptionFlow from './app/subscription-flow';
import WebhookStream from './app/webhook-stream';
import {ExpoRouterShimProvider} from './vega-shims/expo-router';

LogBox.ignoreLogs([
  'Legacy AsyncStorage is on a deprecation path',
  '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
  '[AmazonIAPSDK] Response status for GetUserData : FAILED',
  '[AmazonIAPSDK] Response status for GetProductData : FAILED',
  '[AmazonIAPSDK] Response status for GetPurchaseUpdates : FAILED',
  '[Expo-IAP] Error fetching products:',
  '[Expo-IAP] Error fetching available purchases:',
  '[Expo-IAP] Error getting active subscriptions:',
]);

(globalThis as {
  EXPO_IAP_ENABLE_TV_SHORTCUTS?: boolean;
  EXPO_IAP_SUPPRESS_NATIVE_ALERTS?: boolean;
}).EXPO_IAP_ENABLE_TV_SHORTCUTS = true;

(globalThis as {
  EXPO_IAP_ENABLE_TV_SHORTCUTS?: boolean;
  EXPO_IAP_SUPPRESS_NATIVE_ALERTS?: boolean;
}).EXPO_IAP_SUPPRESS_NATIVE_ALERTS = true;

type RoutePath =
  | '/'
  | '/all-products'
  | '/purchase-flow'
  | '/subscription-flow'
  | '/available-purchases'
  | '/offer-code'
  | '/alternative-billing'
  | '/webhook-stream';

const ROUTE_TITLES: Record<RoutePath, string> = {
  '/': 'expo-iap Examples',
  '/all-products': 'All Products',
  '/purchase-flow': 'In-App Purchase Flow',
  '/subscription-flow': 'Subscription Flow',
  '/available-purchases': 'Available Purchases',
  '/offer-code': 'Offer Code Redemption',
  '/alternative-billing': 'Alternative Billing',
  '/webhook-stream': 'Webhook Stream',
};

const SCREENS: Record<Exclude<RoutePath, '/'>, React.ComponentType> = {
  '/all-products': AllProducts,
  '/purchase-flow': PurchaseFlow,
  '/subscription-flow': SubscriptionFlow,
  '/available-purchases': AvailablePurchases,
  '/offer-code': OfferCode,
  '/alternative-billing': AlternativeBilling,
  '/webhook-stream': WebhookStream,
};

const normalizeRoute = (href: unknown): RoutePath => {
  const route = typeof href === 'string' ? href : '/';
  return route in ROUTE_TITLES ? (route as RoutePath) : '/';
};

export default function App(): React.JSX.Element {
  const [stack, setStack] = useState<RoutePath[]>(['/']);
  const route = stack[stack.length - 1] ?? '/';
  const canGoBack = stack.length > 1;

  const navigation = useMemo(
    () => ({
      navigate(href: unknown) {
        const nextRoute = normalizeRoute(href);
        setStack((currentStack) => [...currentStack, nextRoute]);
      },
      replace(href: unknown) {
        const nextRoute = normalizeRoute(href);
        setStack((currentStack) => [...currentStack.slice(0, -1), nextRoute]);
      },
      back() {
        setStack((currentStack) =>
          currentStack.length > 1 ? currentStack.slice(0, -1) : currentStack,
        );
      },
    }),
    [],
  );

  const Screen = route === '/' ? null : SCREENS[route];

  return (
    <ActionSheetProvider>
      <ExpoRouterShimProvider navigation={navigation}>
        <SafeAreaView style={styles.container}>
          {canGoBack ? (
            <View style={styles.header}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={navigation.back}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              <Text numberOfLines={1} style={styles.headerTitle}>
                {ROUTE_TITLES[route]}
              </Text>
              <View style={styles.headerSpacer} />
            </View>
          ) : null}

          <View style={styles.content}>
            {route === '/' ? <Home /> : Screen ? <Screen /> : null}
          </View>
        </SafeAreaView>
      </ExpoRouterShimProvider>
    </ActionSheetProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 12,
  },
  backButton: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#0F172A',
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    minWidth: 72,
  },
});
