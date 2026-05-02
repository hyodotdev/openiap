import {useEffect, useRef, useState} from 'react';

import {
  connectWebhookStream,
  type WebhookEventPayload,
  type WebhookEventStream,
  type WebhookListener,
  type WebhookListenerError,
} from '../webhook-client';

export type UseWebhookEventsOptions = {
  /**
   * kit project API key — same value used for receipt verification.
   * Must be non-empty to start the stream; pass `null`/`undefined` to
   * disable the listener (e.g. before the user is logged in).
   */
  apiKey: string | null | undefined;
  /**
   * Override the kit base URL. Defaults to https://kit.openiap.dev.
   */
  baseUrl?: string;
  /**
   * Optional EventSource factory. Required on React Native because RN
   * does not ship a global EventSource — pass an instance from
   * `react-native-sse` (or any compatible polyfill).
   */
  eventSourceFactory?: (
    url: string,
    headers: Record<string, string>,
  ) => WebhookEventStream;
  /**
   * Maximum number of events to retain in the in-memory ring buffer
   * surfaced as `events`. Older entries are discarded. Defaults to 50.
   * Set 0 to opt out of the buffer entirely (consume only via
   * `onEvent`).
   */
  bufferSize?: number;
  /**
   * Called for every received event in addition to being appended to
   * the buffer. Useful for side effects (toast, analytics, granting
   * entitlement). Called with the latest stable callback identity.
   */
  onEvent?: (event: WebhookEventPayload) => void;
  /**
   * Called when the stream surfaces a transport / parse error.
   * EventSource auto-reconnects regardless of this hook — this is
   * primarily for telemetry + UI surfacing.
   */
  onError?: (error: WebhookListenerError) => void;
};

export type UseWebhookEventsResult = {
  /** Most recent N events (most-recent-first). Capped at bufferSize. */
  events: WebhookEventPayload[];
  /** Last error reported by the underlying stream. Null when healthy. */
  lastError: WebhookListenerError | null;
  /** True after the first successful stream open. */
  isConnected: boolean;
};

// React hook wrapping the SSE webhook stream. Lifecycle:
//   - opens on mount (once `apiKey` is non-empty),
//   - closes on unmount,
//   - reconnects automatically when EventSource raises a transport
//     error (the underlying client auto-reconnects via the EventSource
//     spec; this hook just surfaces the error and re-renders).
//
// Why a hook: openiap's UX guidance is that consumers consume webhook
// events from React state (granting entitlement, refreshing the
// subscription view) rather than via an imperative listener. The
// hook's `events` buffer + `onEvent` callback cover both styles.
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

  // Stash callbacks in refs so reconnects don't fire on every render.
  // The underlying SSE connection should only restart when `apiKey` /
  // `baseUrl` / `eventSourceFactory` change. `bufferSize` is also a
  // ref so adjusting the buffer cap from the host component doesn't
  // tear down the stream and lose in-flight events.
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
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
