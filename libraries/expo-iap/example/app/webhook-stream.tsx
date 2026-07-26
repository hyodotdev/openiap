import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

export default function WebhookStreamScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Webhook Stream</Text>
      <Text style={styles.subtitle}>Trusted backend or MCP only</Text>

      <View style={styles.warning}>
        <Text style={styles.warningTitle}>
          Do not connect from a shipped app
        </Text>
        <Text style={styles.body}>
          The project-wide IAPKit stream contains lifecycle records and purchase
          identifiers. It requires an openiap-kit_sk_ secret admin key, which
          must never be placed in EXPO_PUBLIC_* or embedded in an app bundle.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mobile app</Text>
        <Text style={styles.body}>
          Use an openiap-kit_pk_ publishable key for purchase verification,
          user-scoped entitlement helpers, and public product payloads.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trusted consumer</Text>
        <Text style={styles.body}>
          MCP, CI, or your backend connects to GET /v1/webhooks/stream and sends
          Authorization: Bearer &lt;IAPKIT_SECRET_KEY&gt;. If your backend
          protects paid content, it should make the final entitlement decision.
        </Text>
      </View>

      <Text style={styles.footer}>
        Configure the separate lifecycle webhook URL from the IAPKit dashboard
        in App Store Connect and Google Cloud Pub/Sub.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#ffffff'},
  content: {padding: 20, gap: 16},
  title: {fontSize: 22, fontWeight: '700', color: '#000'},
  subtitle: {fontSize: 14, color: '#444'},
  warning: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  warningTitle: {fontWeight: '700', color: '#9a3412', marginBottom: 8},
  card: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {fontWeight: '700', color: '#111827', marginBottom: 8},
  body: {color: '#374151', lineHeight: 21},
  footer: {color: '#6b7280', lineHeight: 20},
});
