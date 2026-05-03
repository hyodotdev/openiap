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
} from 'expo-iap';

/**
 * UTF-8 safe base64 — `Buffer` is a Node global that Hermes / JSC
 * don't ship, so we wrap btoa with the standard
 * unescape(encodeURIComponent(...)) trick. Extracted into a helper
 * because the pattern is opaque at the call site (PR #124
 * (https://github.com/hyodotdev/openiap/pull/124) review).
 */
function base64EncodeUtf8(input: string): string {
  return btoa(unescape(encodeURIComponent(input)));
}

/**
 * Webhook Stream Demo
 *
 * Subscribes to `GET /v1/webhooks/stream/{apiKey}` (the SSE endpoint added in
 * PR #124) and renders incoming `WebhookEvent`s in real time. The "Trigger
 * test notification" button POSTs a synthetic event to the unified receiver
 * so the round-trip can be exercised without going through Apple ASN v2 or
 * Google RTDN.
 */
export default function WebhookStreamScreen() {
  const apiKey: string | undefined =
    (Constants.expoConfig?.extra as {iapkitApiKey?: string} | undefined)
      ?.iapkitApiKey ?? process.env.EXPO_PUBLIC_IAPKIT_API_KEY;
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
      setStatusMessage(
        'IAPKit API key not configured. Set EXPO_PUBLIC_IAPKIT_API_KEY in your environment.',
      );
      return;
    }
    // Defensive close-before-open: a transient transport error keeps
    // the underlying SSE auto-reconnecting in the background, so a
    // user tapping Connect again in the error state would otherwise
    // create a second live listener and double-emit events.
    listenerRef.current?.close();
    listenerRef.current = null;
    setStatus('connecting');
    setStatusMessage(null);
    listenerRef.current = connectWebhookStream({
      apiKey,
      baseUrl,
      onEvent: (event) => {
        setStatusMessage(null);
        // Newest first; cap at 50 to keep the list bounded.
        setEvents((prev) => [event, ...prev].slice(0, 50));
      },
      onError: (error: WebhookListenerError) => {
        // Transport errors auto-reconnect under the hood; surface the
        // most recent reason for visibility.
        setStatus('error');
        setStatusMessage(`${error.code}: ${error.message}`);
      },
    });
    // Mark connected as soon as `connectWebhookStream` returns —
    // the listener is live even if no event has arrived yet.
    // Waiting for the first onEvent left a healthy idle stream
    // stuck in `connecting` indefinitely (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    setStatus('connected');
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
      // Mirror the Pub/Sub envelope the dashboard's "Live test" button uses.
      // See packages/kit/src/pages/auth/organization/project/webhooks.tsx.
      const dataJson = JSON.stringify({
        version: '1.0',
        packageName: 'com.example.app',
        eventTimeMillis: String(Date.now()),
        testNotification: {version: '1.0'},
      });
      const payload = {
        message: {
          data: base64EncodeUtf8(dataJson),
          messageId: `expo-test-${Date.now()}`,
          publishTime: new Date().toISOString(),
        },
        subscription: 'projects/example/subscriptions/iapkit-rtdn',
      };
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/v1/webhooks/${encodeURIComponent(
          apiKey,
        )}`,
        {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        setStatusMessage(`Test POST returned ${response.status}: ${text}`);
      } else {
        setStatusMessage('Test notification accepted (200).');
      }
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
        <Text style={styles.subtitle}>
          SSE → /v1/webhooks/stream/{`{apiKey}`}
        </Text>
        <Text style={styles.subtitleMuted}>
          base: {baseUrl}
          {'\n'}
          api key: {apiKey ? `${apiKey.slice(0, 8)}…` : 'MISSING'}
        </Text>
      </View>

      <View style={styles.controls}>
        {status === 'idle' || status === 'error' ? (
          <TouchableOpacity
            style={[styles.button, styles.primary]}
            onPress={startStream}
          >
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.secondary]}
            onPress={stopStream}
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, styles.tertiary]}
          onPress={triggerTestNotification}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Trigger test notification</Text>
          )}
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.statusBanner,
          status === 'connected' && styles.statusOk,
          status === 'connecting' && styles.statusPending,
          status === 'error' && styles.statusError,
        ]}
      >
        <Text style={styles.statusLabel}>Status: {status}</Text>
        {statusMessage ? (
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        ) : null}
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={events}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No events yet. Connect, then trigger a test notification or wait
              for a real Apple / Google webhook.
            </Text>
          </View>
        )}
        renderItem={({item}) => (
          <View style={styles.eventCard}>
            <Text style={styles.eventType}>{item.type}</Text>
            <Text style={styles.eventMeta}>
              source: {item.source ?? '—'} · platform: {item.platform ?? '—'} ·
              env: {item.environment ?? '—'}
            </Text>
            <Text style={styles.eventMeta}>
              productId: {item.productId ?? '—'}
              {'\n'}
              subscriptionState: {item.subscriptionState ?? '—'}
              {'\n'}
              receivedAt:{' '}
              {item.receivedAt
                ? new Date(item.receivedAt).toLocaleString()
                : '—'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#ffffff'},
  header: {padding: 20, borderBottomWidth: 1, borderBottomColor: '#eaeaea'},
  title: {fontSize: 22, fontWeight: '700', color: '#000'},
  subtitle: {marginTop: 4, fontSize: 13, color: '#444', fontFamily: 'Menlo'},
  subtitleMuted: {marginTop: 8, fontSize: 12, color: '#888'},
  controls: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {backgroundColor: '#007AFF'},
  secondary: {backgroundColor: '#FF3B30'},
  tertiary: {backgroundColor: '#34C759'},
  buttonText: {color: '#fff', fontWeight: '600'},
  statusBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  statusOk: {backgroundColor: '#E5F7EA'},
  statusPending: {backgroundColor: '#FFF6E0'},
  statusError: {backgroundColor: '#FDECEC'},
  statusLabel: {fontWeight: '600', color: '#222'},
  statusMessage: {marginTop: 4, color: '#444', fontSize: 12},
  list: {flex: 1},
  listContent: {padding: 20},
  separator: {height: 8},
  empty: {paddingTop: 24, alignItems: 'center'},
  emptyText: {color: '#888', textAlign: 'center'},
  eventCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  eventType: {fontSize: 14, fontWeight: '700', color: '#000'},
  eventMeta: {marginTop: 4, fontSize: 12, color: '#444'},
});
