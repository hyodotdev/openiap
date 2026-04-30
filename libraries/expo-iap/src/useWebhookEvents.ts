import {useEffect, useRef, useState} from 'react';

import {
  connectWebhookStream,
  type WebhookEventPayload,
  type WebhookEventStream,
  type WebhookListener,
  type WebhookListenerError,
} from './webhook-client';

export type UseWebhookEventsOptions = {
  apiKey: string | null | undefined;
  baseUrl?: string;
  eventSourceFactory?: (
    url: string,
    headers: Record<string, string>,
  ) => WebhookEventStream;
  bufferSize?: number;
  onEvent?: (event: WebhookEventPayload) => void;
  onError?: (error: WebhookListenerError) => void;
};

export type UseWebhookEventsResult = {
  events: WebhookEventPayload[];
  lastError: WebhookListenerError | null;
  isConnected: boolean;
};

// React hook wrapping the kit SSE webhook stream. See
// `libraries/react-native-iap/src/hooks/useWebhookEvents.ts` for the
// canonical version — this file mirrors it 1:1 because expo-iap and
// react-native-iap share the JS/TS SSE wire format. The intentional
// duplication keeps each library self-contained (no cross-package
// runtime dep) at the cost of a coordinated edit when the surface
// changes; that's checked by the SDK Parity Checklist in
// `knowledge/internal/04-platform-packages.md`.
export function useWebhookEvents({
  apiKey,
  baseUrl,
  eventSourceFactory,
  bufferSize = 50,
  onEvent,
  onError,
}: UseWebhookEventsOptions): UseWebhookEventsResult {
  const [events, setEvents] = useState<WebhookEventPayload[]>([]);
  const [lastError, setLastError] = useState<WebhookListenerError | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let listener: WebhookListener | null = null;
    let mounted = true;

    try {
      listener = connectWebhookStream({
        apiKey,
        baseUrl,
        eventSourceFactory,
        onEvent: (event) => {
          if (!mounted) {
            return;
          }
          setIsConnected(true);
          if (bufferSize > 0) {
            setEvents((prev) => [event, ...prev].slice(0, bufferSize));
          }
          onEventRef.current?.(event);
        },
        onError: (error) => {
          if (!mounted) {
            return;
          }
          setLastError(error);
          onErrorRef.current?.(error);
        },
      });
    } catch (error) {
      const wrapped: WebhookListenerError = {
        code: 'TRANSPORT_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to open webhook stream',
        cause: error,
      };
      setLastError(wrapped);
      onErrorRef.current?.(wrapped);
    }

    return () => {
      mounted = false;
      listener?.close();
      setIsConnected(false);
    };
  }, [apiKey, baseUrl, bufferSize, eventSourceFactory]);

  return {events, lastError, isConnected};
}
