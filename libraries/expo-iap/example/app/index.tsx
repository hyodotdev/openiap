import {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import {useRouter} from 'expo-router';
import {getStorefront} from 'expo-iap';

type MenuItem = {
  id: string;
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  accentColor: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'all-products',
    href: '/all-products',
    icon: '📱',
    title: 'All Products',
    subtitle: 'View all items at once',
    accentColor: '#EF4444',
  },
  {
    id: 'purchase-flow',
    href: '/purchase-flow',
    icon: '🛒',
    title: 'In-App Purchase Flow',
    subtitle: 'One-time products',
    accentColor: '#2563EB',
  },
  {
    id: 'subscription-flow',
    href: '/subscription-flow',
    icon: '🔄',
    title: 'Subscription Flow',
    subtitle: 'Recurring subscriptions',
    accentColor: '#16A34A',
  },
  {
    id: 'available-purchases',
    href: '/available-purchases',
    icon: '📦',
    title: 'Available Purchases',
    subtitle: 'View past purchases',
    accentColor: '#7C3AED',
  },
  {
    id: 'offer-code',
    href: '/offer-code',
    icon: '🎁',
    title: 'Offer Code Redemption',
    subtitle: 'Redeem promo codes',
    accentColor: '#4B5563',
  },
  {
    id: 'alternative-billing',
    href: '/alternative-billing',
    icon: '🌐',
    title: 'Alternative Billing',
    subtitle: 'External payment links',
    accentColor: '#EA580C',
  },
  {
    id: 'webhook-stream',
    href: '/webhook-stream',
    icon: '📡',
    title: 'Webhook Stream',
    subtitle: 'IAPKit SSE + test notification',
    accentColor: '#0284C7',
  },
];

/**
 * Example App Landing Page
 *
 * Navigation to focused purchase flow implementations.
 * This demonstrates TypeScript-first, platform-agnostic approaches to in-app purchases.
 */
export default function Home() {
  const router = useRouter();
  const [storefront, setStorefront] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if ((Platform.OS as string) === 'kepler') {
      return;
    }

    getStorefront()
      .then((code) => {
        setStorefront(code);
      })
      .catch((error) => {
        // Silently fail on unsupported platforms
        console.log('Storefront not available:', error.message);
      });
  }, []);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>expo-iap Examples</Text>
      <Text style={styles.subtitle}>
        Example flows for purchases, subscriptions, restore, offers, and
        platform-specific APIs{storefront ? ` · Store ${storefront}` : ''}
      </Text>
    </View>
  );

  const renderItem = (item: MenuItem, index: number) => {
    return (
      <TouchableOpacity
        key={item.id}
        focusable
        hasTVPreferredFocus={focusedIndex === index}
        onFocus={() => setFocusedIndex(index)}
        onPress={() => router.push(item.href as any)}
        style={[
          styles.menuItem,
          focusedIndex === index && styles.menuItemFocused,
        ]}
      >
        <View
          style={[styles.iconContainer, {backgroundColor: item.accentColor}]}
        >
          <Text style={styles.menuIcon}>{item.icon}</Text>
        </View>
        <View style={styles.menuLabel}>
          <Text style={styles.menuTitle}>{item.title}</Text>
          <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.contentInner}>
        {renderHeader()}
        <View style={styles.menuGrid}>{MENU_ITEMS.map(renderItem)}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  contentInner: {
    maxWidth: 430,
    width: '100%',
  },
  headerContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 20,
    color: '#475569',
  },
  menuGrid: {
    gap: 12,
  },
  menuItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: 'row',
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  menuItemFocused: {
    borderColor: '#2563EB',
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    marginRight: 14,
    width: 44,
  },
  menuIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  menuLabel: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    color: '#111827',
    fontSize: 16,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  menuSubtitle: {
    color: '#64748B',
    fontSize: 14,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 18,
  },
  chevron: {
    color: '#94A3B8',
    fontSize: 24,
    lineHeight: 26,
    marginLeft: 8,
  },
});
