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
  /**
   * True once the first webhook event has been received from the
   * stream. Remains false if the connection is open but idle (the
   * underlying SSE bridge doesn't surface a "stream opened"
   * lifecycle event we can hook into; isConnected is therefore an
   * activity indicator, not a raw socket-state flag). Reset to
   * false on cleanup / apiKey change.
   */
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
  // `baseUrl` change. `eventSourceFactory` is held in a ref too so
  // anonymous-function callers don't tear down the connection every
  // render (a common React pitfall — was previously documented as a
  // caller-side constraint, now enforced by the hook). `bufferSize`
  // is also a ref so adjusting the buffer cap from the host component
  // doesn't tear down the stream and lose in-flight events.
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const eventSourceFactoryRef = useRef(eventSourceFactory);
  const bufferSizeRef = useRef(bufferSize);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;
  eventSourceFactoryRef.current = eventSourceFactory;
  bufferSizeRef.current = bufferSize;

  // Trim the visible buffer immediately when bufferSize is lowered
  // mid-stream. The ref-based update would otherwise only take
  // effect on the next event.
  useEffect(() => {
    setEvents((prev) => (bufferSize > 0 ? prev.slice(0, bufferSize) : []));
  }, [bufferSize]);

  useEffect(() => {
    // Fresh stream → fresh state. Resetting events + lastError on
    // (re)connect prevents a stale payload from the previous
    // apiKey/baseUrl from briefly leaking into the new context.
    setEvents([]);
    setLastError(null);

    if (!apiKey) {
      return;
    }

    let listener: WebhookListener | null = null;
    let mounted = true;

    try {
      listener = connectWebhookStream({
        apiKey,
        baseUrl,
        eventSourceFactory: eventSourceFactoryRef.current,
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
    // `eventSourceFactory` deliberately omitted from deps — held in a
    // ref above so anonymous-function callers don't trigger reconnects
    // on every render. The connection is only re-opened when apiKey or
    // baseUrl changes; a runtime factory swap is picked up on that
    // next reconnect via the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, baseUrl]);

  return {events, lastError, isConnected};
}
