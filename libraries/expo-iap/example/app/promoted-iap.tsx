import React, {useMemo, useState} from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  buildPromotedIapUrl,
  PROMOTED_IAP_BUNDLE_ID,
  PROMOTED_IAP_DEFAULT_PRODUCT_ID,
  PROMOTED_IAP_PRODUCT_IDS,
  refreshPromotedIapProduct,
  resetPromotedIapEvents,
  usePromotedIapEvents,
} from '../src/promotedIapEvents';

export default function PromotedIap() {
  const events = usePromotedIapEvents();
  const [selectedProductId, setSelectedProductId] = useState<string>(
    PROMOTED_IAP_DEFAULT_PRODUCT_ID,
  );

  const purchaseIntentUrl = useMemo(
    () => buildPromotedIapUrl(selectedProductId),
    [selectedProductId],
  );

  const copyUrl = async () => {
    await Clipboard.setStringAsync(purchaseIntentUrl);
  };

  const openUrl = async () => {
    await Linking.openURL(purchaseIntentUrl);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Promoted IAP</Text>
        <Text style={styles.subtitle}>Bundle {PROMOTED_IAP_BUNDLE_ID}</Text>
        <Text style={styles.platform}>Platform {Platform.OS}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Product</Text>
        <View style={styles.productList}>
          {PROMOTED_IAP_PRODUCT_IDS.map((productId) => {
            const selected = selectedProductId === productId;
            return (
              <TouchableOpacity
                key={productId}
                style={[
                  styles.productButton,
                  selected && styles.productButtonSelected,
                ]}
                onPress={() => setSelectedProductId(productId)}
              >
                <Text
                  style={[
                    styles.productButtonText,
                    selected && styles.productButtonTextSelected,
                  ]}
                >
                  {productId}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Purchase Intent URL</Text>
        <Text selectable style={styles.urlText}>
          {purchaseIntentUrl}
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={copyUrl}>
            <Text style={styles.actionButtonText}>Copy URL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={openUrl}>
            <Text style={styles.actionButtonText}>Open URL</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>Events</Text>
          <View style={styles.actionRowCompact}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={refreshPromotedIapProduct}
            >
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={resetPromotedIapEvents}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {events.length === 0 ? (
          <Text style={styles.emptyText}>No events yet</Text>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventSource}>{event.source}</Text>
              <Text style={styles.eventMessage}>{event.message}</Text>
              <Text style={styles.eventTime}>{event.at}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#374151',
    fontSize: 15,
    marginBottom: 4,
  },
  platform: {
    color: '#6B7280',
    fontSize: 14,
  },
  section: {
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  productList: {
    gap: 8,
  },
  productButton: {
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  productButtonSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  productButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  productButtonTextSelected: {
    color: '#ffffff',
  },
  urlText: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    color: '#111827',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
    padding: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionRowCompact: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  logHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
  eventRow: {
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  eventSource: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventMessage: {
    color: '#111827',
    fontSize: 14,
    marginBottom: 4,
  },
  eventTime: {
    color: '#6B7280',
    fontSize: 12,
  },
});
