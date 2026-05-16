import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import {
  connectWebhookStream,
  type WebhookEventPayload,
  type WebhookListener,
  type WebhookListenerError,
} from 'react-native-iap';

function base64EncodeUtf8(input: string): string {
  return btoa(unescape(encodeURIComponent(input)));
}

export default function WebhookStreamScreen() {
  const apiKey: string = ((
    Constants.expoConfig?.extra as {iapkitApiKey?: string} | undefined
  )?.iapkitApiKey ??
    process.env.EXPO_PUBLIC_IAPKIT_API_KEY ??
    '') as string;
  const baseUrl =
    process.env.EXPO_PUBLIC_IAPKIT_BASE_URL ?? 'https://kit.openiap.dev';

  const [events, setEvents] = useState<WebhookEventPayload[]>([]);
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const listenerRef = useRef<WebhookListener | null>(null);

  const startStream = useCallback(() => {
    if (!apiKey) {
      setStatus('error');
      setStatusMessage('Set EXPO_PUBLIC_IAPKIT_API_KEY to connect.');
      return;
    }
    listenerRef.current?.close();
    listenerRef.current = connectWebhookStream({
      apiKey,
      baseUrl,
      onEvent: (event) => {
        setStatusMessage(null);
        setEvents((prev) => [event, ...prev].slice(0, 50));
      },
      onError: (error: WebhookListenerError) => {
        setStatus('error');
        setStatusMessage(`${error.code}: ${error.message}`);
      },
    });
    setStatus('connected');
    setStatusMessage(null);
  }, [apiKey, baseUrl]);

  const stopStream = useCallback(() => {
    listenerRef.current?.close();
    listenerRef.current = null;
    setStatus('idle');
    setStatusMessage(null);
  }, []);

  useEffect(() => {
    return () => {
      listenerRef.current?.close();
      listenerRef.current = null;
    };
  }, []);

  const triggerTestNotification = useCallback(async () => {
    if (!apiKey) {
      setStatusMessage('Cannot trigger test: API key missing.');
      return;
    }
    setTesting(true);
    try {
      const dataJson = JSON.stringify({
        version: '1.0',
        packageName: 'com.example.app',
        eventTimeMillis: String(Date.now()),
        testNotification: {version: '1.0'},
      });
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/v1/webhooks/${encodeURIComponent(
          apiKey,
        )}`,
        {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            message: {
              data: base64EncodeUtf8(dataJson),
              messageId: `rn-expo-test-${Date.now()}`,
              publishTime: new Date().toISOString(),
            },
            subscription: 'projects/example/subscriptions/iapkit-rtdn',
          }),
        },
      );
      setStatusMessage(
        response.ok
          ? 'Test notification accepted.'
          : `Test POST returned ${response.status}: ${await response.text()}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Test POST failed: ${message}`);
    } finally {
      setTesting(false);
    }
  }, [apiKey, baseUrl]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Webhook Stream</Text>
        <Text style={styles.subtitle}>SSE /v1/webhooks/stream/apiKey</Text>
        <Text style={styles.meta}>
          api key: {apiKey ? 'CONFIGURED' : 'MISSING'}
        </Text>
      </View>
      <View style={styles.controls}>
        {status === 'idle' || status === 'error' ? (
          <TouchableOpacity style={styles.primaryButton} onPress={startStream}>
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={stopStream}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.testButton}
          onPress={triggerTestNotification}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Trigger test notification</Text>
          )}
        </TouchableOpacity>
      </View>
      <View style={[styles.status, styles[status]]}>
        <Text style={styles.statusText}>Status: {status}</Text>
        {statusMessage ? (
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        ) : null}
      </View>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No events yet. Connect to start.</Text>
        }
        renderItem={({item}) => (
          <View style={styles.eventCard}>
            <Text style={styles.eventType}>{item.type}</Text>
            <Text style={styles.eventMeta}>
              source: {item.source ?? '-'} / platform: {item.platform ?? '-'}
            </Text>
            <Text style={styles.eventMeta}>
              productId: {item.productId ?? '-'}
              {'\n'}receivedAt:{' '}
              {item.receivedAt
                ? new Date(item.receivedAt).toLocaleString()
                : '-'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb'},
  title: {fontSize: 24, fontWeight: '700', color: '#111827'},
  subtitle: {marginTop: 4, color: '#4b5563'},
  meta: {marginTop: 8, color: '#6b7280', fontSize: 12},
  controls: {flexDirection: 'row', gap: 8, padding: 20},
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  testButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {color: '#fff', fontWeight: '600', textAlign: 'center'},
  status: {marginHorizontal: 20, padding: 12, borderRadius: 8},
  idle: {backgroundColor: '#f3f4f6'},
  connecting: {backgroundColor: '#fef3c7'},
  connected: {backgroundColor: '#dcfce7'},
  error: {backgroundColor: '#fee2e2'},
  statusText: {fontWeight: '600', color: '#111827'},
  statusMessage: {marginTop: 4, color: '#374151', fontSize: 12},
  list: {padding: 20, gap: 8},
  empty: {textAlign: 'center', color: '#6b7280', marginTop: 24},
  eventCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  eventType: {fontWeight: '700', color: '#111827'},
  eventMeta: {marginTop: 4, fontSize: 12, color: '#4b5563'},
});
