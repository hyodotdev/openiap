import {useEffect, useRef, useState} from 'react';

import {
  connectWebhookStream,
  type WebhookEventPayload,
  type WebhookEventStream,
  type WebhookListener,
  type WebhookListenerError,
} from './webhook-client';

export type UseWebhookEventsOptions = {
  /**
   * Secret admin key sent in the Authorization header. Never pass a publishable
   * key or ship this value in an app bundle.
   */
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
 * Connect from a trusted process. Scheduled for removal in expo-iap 5.0.0.
 */
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
  // Hold `eventSourceFactory` in a ref too so a caller passing an
  // anonymous function literal (the common React pitfall) doesn't
  // tear down the SSE connection on every render. We still capture
  // the latest factory so a runtime-config swap (e.g. apiKey changes
  // and a new EventSource constructor is needed) is honored on the
  // next connect, but the *identity* of the factory no longer drives
  // useEffect.
  const eventSourceFactoryRef = useRef(eventSourceFactory);
  // Holding bufferSize in a ref so adjusting it from the host
  // component doesn't tear down the SSE connection. Same reasoning
  // as onEvent / onError: a re-render with a new bufferSize would
  // otherwise re-fire useEffect, close the stream, and reconnect
  // (losing in-flight events the SSE handler had already buffered).
  const bufferSizeRef = useRef(bufferSize);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;
  eventSourceFactoryRef.current = eventSourceFactory;
  bufferSizeRef.current = bufferSize;

  // Trim the existing buffer when the host lowers `bufferSize`
  // mid-stream. The ref-based update only takes effect on the next
  // event arrival, which can leave the visible buffer above the new
  // cap until traffic resumes — this effect enforces the cap
  // immediately on the change instead.
  useEffect(() => {
    setEvents((prev) => (bufferSize > 0 ? prev.slice(0, bufferSize) : []));
  }, [bufferSize]);

  useEffect(() => {
    // Reset surfaced state on every (re)connect target so a stale
    // event from the prior stream can't briefly leak into a new
    // apiKey/baseUrl context. Matches the SSE convention of
    // "fresh stream → fresh history."
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
