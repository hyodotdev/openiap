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
   * Secret admin key sent in the Authorization header. Never pass a publishable
   * key or ship this value in an app bundle.
   */
  apiKey: string | null | undefined;
  /**
   * Override the kit base URL. Defaults to https://kit.openiap.dev.
   */
  baseUrl?: string;
  /**
   * EventSource factory that supports custom Authorization headers. React
   * Native does not ship a global EventSource; use a compatible trusted-process
   * transport.
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
   * the buffer. Called with the latest stable callback identity.
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

/**
 * React hook wrapping the secret Bearer-authenticated SSE webhook stream.
 *
 * Hosted IAPKit now restricts the project-wide stream to trusted
 * administrative consumers. Never use this hook in a shipped app. Connect
 * from MCP, CI, or a backend, and provide a transport factory that supports
 * Authorization headers.
 *
 * @deprecated Project-wide streams are not a mobile-app integration surface.
 * Connect from a trusted process. Scheduled for removal in react-native-iap
 * 16.0.0.
 */
// Lifecycle:
//   - opens on mount (once `apiKey` is non-empty),
//   - closes on unmount,
//   - reconnects automatically when EventSource raises a transport
//     error (the underlying client auto-reconnects via the EventSource
//     spec; this hook just surfaces the error and re-renders).
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
