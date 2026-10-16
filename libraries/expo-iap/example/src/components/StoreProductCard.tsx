import type {ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {Product, ProductSubscription} from 'expo-iap';

type Props = {
  product: Product | ProductSubscription;
  kind: string;
  price?: string;
  terms?: string;
  children: ReactNode;
};

export default function StoreProductCard({
  product,
  kind,
  price,
  terms,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.kind}>{kind}</Text>
      <Text style={styles.title}>{product.displayName || product.title}</Text>
      {product.description ? (
        <Text style={styles.description}>{product.description}</Text>
      ) : null}
      <Text style={styles.price}>{price ?? product.displayPrice}</Text>
      {terms ? <Text style={styles.description}>{terms}</Text> : null}
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    gap: 8,
  },
  kind: {fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#64748B'},
  title: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'left',
  },
  description: {fontSize: 14, lineHeight: 21, color: '#475569'},
  price: {fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#0F172A'},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6},
});
