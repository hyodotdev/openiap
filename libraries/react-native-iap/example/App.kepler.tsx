import React, {useMemo, useState} from 'react';
import {
  LogBox,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AllProducts from './screens/AllProducts';
import AlternativeBilling from './screens/AlternativeBilling';
import AvailablePurchases from './screens/AvailablePurchases';
import Home from './screens/Home';
import OfferCode from './screens/OfferCode';
import PurchaseFlow from './screens/PurchaseFlow';
import SubscriptionFlow from './screens/SubscriptionFlow';
import WebhookStream from './screens/WebhookStream';
import {DataModalProvider} from './src/contexts/DataModalContext';

LogBox.ignoreLogs([
  'Legacy AsyncStorage is on a deprecation path',
  '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
  '[AmazonIAPSDK] Response status for GetUserData : FAILED',
  '[AmazonIAPSDK] Response status for GetProductData : FAILED',
  '[AmazonIAPSDK] Response status for GetPurchaseUpdates : FAILED',
  '[RN-IAP] Error fetching products:',
  '[RN-IAP] Error fetching available purchases:',
  '[RN-IAP] Error getting active subscriptions:',
]);

(global as any).RN_IAP_DEV_MODE = true;
(global as any).RN_IAP_SUPPRESS_NATIVE_ALERTS = true;

type RouteName =
  | 'Home'
  | 'AllProducts'
  | 'PurchaseFlow'
  | 'SubscriptionFlow'
  | 'AvailablePurchases'
  | 'OfferCode'
  | 'AlternativeBilling'
  | 'WebhookStream';

const ROUTE_TITLES: Record<RouteName, string> = {
  Home: 'React Native IAP',
  AllProducts: 'All Products',
  PurchaseFlow: 'Purchase Flow',
  SubscriptionFlow: 'Subscription Flow',
  AvailablePurchases: 'Available Purchases',
  OfferCode: 'Offer Code',
  AlternativeBilling: 'Alternative Billing',
  WebhookStream: 'Webhook Stream',
};

const SCREENS: Record<Exclude<RouteName, 'Home'>, React.ComponentType> = {
  AllProducts,
  PurchaseFlow,
  SubscriptionFlow,
  AvailablePurchases,
  OfferCode,
  AlternativeBilling,
  WebhookStream,
};

export default function App(): React.JSX.Element {
  const [stack, setStack] = useState<RouteName[]>(['Home']);
  const route = stack[stack.length - 1] ?? 'Home';
  const canGoBack = stack.length > 1;

  const navigation = useMemo(
    () => ({
      navigate(nextRoute: RouteName) {
        setStack((currentStack) => [...currentStack, nextRoute]);
      },
      goBack() {
        setStack((currentStack) =>
          currentStack.length > 1 ? currentStack.slice(0, -1) : currentStack,
        );
      },
      canGoBack() {
        return stack.length > 1;
      },
    }),
    [stack.length],
  );

  const Screen = route === 'Home' ? null : SCREENS[route];

  return (
    <DataModalProvider>
      <SafeAreaView style={styles.container}>
        {canGoBack ? (
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={navigation.goBack}
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
          {route === 'Home' ? (
            <Home navigation={navigation as never} />
          ) : Screen ? (
            <Screen />
          ) : null}
        </View>
      </SafeAreaView>
    </DataModalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
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
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#333',
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    minWidth: 72,
  },
});
