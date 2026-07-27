import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {ViewStyle} from 'react-native';
import type {Purchase} from 'react-native-iap';

const storeLabel = (store?: string | null): string => {
  if (!store) return 'unknown';
  return store.toString().toLowerCase();
};

const storeStyle = (store?: string | null) => {
  const normalized = storeLabel(store);
  switch (normalized) {
    case 'apple':
      return styles.badgeIOS;
    case 'google-play':
    case 'amazon':
    case 'horizon':
      return styles.badgeAndroid;
    default:
      return styles.badgeUnknown;
  }
};

type PurchaseWithMaybeTransactionId = Purchase & {
  transactionId?: string | null;
};

const resolveTransactionId = (
  purchase: PurchaseWithMaybeTransactionId,
): string => {
  const transactionId = purchase.transactionId;
  if (typeof transactionId === 'string' && transactionId.length > 0) {
    return transactionId;
  }
  return purchase.id;
};

type Props = {
  purchase: Purchase;
  onPress?: () => void;
  style?: ViewStyle;
};

function PurchaseSummaryRow({purchase, onPress, style}: Props) {
  const store = storeLabel(purchase.store);
  const transactionId = resolveTransactionId(purchase);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[styles.row, onPress ? styles.rowPressable : null, style]}
    >
      <View style={styles.infoContainer}>
        <Text style={styles.productId} numberOfLines={1}>
          {purchase.productId}
        </Text>
        <Text style={styles.transactionId} numberOfLines={1}>
          Transaction: {transactionId || 'N/A'}
        </Text>
      </View>
      <View style={[styles.badge, storeStyle(purchase.store)]}>
        <Text style={styles.badgeText}>{store}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f7f9fc',
    borderWidth: 1,
    borderColor: '#e1e7ef',
    marginBottom: 12,
  },
  rowPressable: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoContainer: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  productId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  transactionId: {
    fontSize: 13,
    color: '#5f6470',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  badgeIOS: {
    backgroundColor: '#007AFF',
  },
  badgeAndroid: {
    backgroundColor: '#3DDC84',
  },
  badgeUnknown: {
    backgroundColor: '#9E9E9E',
  },
});

export default PurchaseSummaryRow;
