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
  // Holding bufferSize in a ref so adjusting it from the host
  // component doesn't tear down the SSE connection. Same reasoning
  // as onEvent / onError: a re-render with a new bufferSize would
  // otherwise re-fire useEffect, close the stream, and reconnect
  // (losing in-flight events the SSE handler had already buffered).
  const bufferSizeRef = useRef(bufferSize);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;
  bufferSizeRef.current = bufferSize;

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
          const cap = bufferSizeRef.current;
          if (cap > 0) {
            setEvents((prev) => [event, ...prev].slice(0, cap));
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
    // NOTE: pass `eventSourceFactory` from a useMemo / useCallback /
    // module-level constant on the caller's side. An anonymous
    // function literal will change identity every render and tear
    // down the SSE connection on each re-render.
  }, [apiKey, baseUrl, eventSourceFactory]);

  return {events, lastError, isConnected};
}
