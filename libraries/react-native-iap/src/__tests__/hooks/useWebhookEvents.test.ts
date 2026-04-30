/* eslint-disable import/first */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

// `useWebhookEvents` doesn't import any RN-native code beyond `react`,
// but it lives next to hooks that do — keep RN mocks consistent with
// the rest of the test suite so jest's react-native preset doesn't
// fail to resolve a transitive import.
jest.mock('react-native', () => ({
  Platform: {OS: 'ios', select: (obj: any) => obj.ios},
}));

import {useWebhookEvents} from '../../hooks/useWebhookEvents';
import type {
  WebhookEventPayload,
  WebhookEventStream,
} from '../../webhook-client';

const validEvent: WebhookEventPayload = {
  id: 'uuid-1',
  type: 'SubscriptionRenewed',
  source: 'AppleAppStoreServerNotificationsV2',
  platform: 'IOS',
  environment: 'Production',
  projectId: 'p-1',
  occurredAt: 1_711_000_000_000,
  receivedAt: 1_711_000_001_000,
  purchaseToken: 'token-1',
  productId: 'com.example.premium',
  subscriptionState: 'Active',
};

function makeFakeStream() {
  const listeners: Record<
    string,
    (event: {data: string; lastEventId?: string}) => void
  > = {};
  const stream: WebhookEventStream = {
    onmessage: null,
    onerror: null,
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
    close: jest.fn(),
  };
  return {
    stream,
    fire: (data: string) => listeners.message?.({data}),
  };
}

function HookProbe(props: Parameters<typeof useWebhookEvents>[0]) {
  const result = useWebhookEvents(props);
  // expose into a static slot for the test to read
  (HookProbe as any).last = result;
  return null;
}

describe('useWebhookEvents', () => {
  afterEach(() => {
    (HookProbe as any).last = null;
  });

  it('does nothing when apiKey is empty', () => {
    const factory = jest.fn();
    let renderer: ReturnType<typeof TestRenderer.create> | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(HookProbe, {
          apiKey: null,
          eventSourceFactory: factory as any,
          onEvent: () => {},
        }),
      );
    });
    expect(factory).not.toHaveBeenCalled();
    act(() => {
      renderer?.unmount();
    });
  });

  it('opens a stream once apiKey is non-empty and forwards events into the buffer', () => {
    const {stream, fire} = makeFakeStream();
    const factory = jest.fn(() => stream);
    const onEvent = jest.fn();

    let renderer: ReturnType<typeof TestRenderer.create> | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(HookProbe, {
          apiKey: 'k',
          baseUrl: 'http://localhost',
          eventSourceFactory: factory as any,
          onEvent,
        }),
      );
    });

    expect(factory).toHaveBeenCalledWith(
      'http://localhost/v1/webhooks/stream/k',
      {},
    );

    act(() => {
      fire(JSON.stringify(validEvent));
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({id: 'uuid-1'}),
    );

    const result = (HookProbe as any).last as {
      events: WebhookEventPayload[];
      isConnected: boolean;
    };
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.id).toBe('uuid-1');
    expect(result.isConnected).toBe(true);

    act(() => {
      renderer?.unmount();
    });
    expect(stream.close).toHaveBeenCalled();
  });

  it('caps the in-memory buffer at bufferSize', () => {
    const {stream, fire} = makeFakeStream();
    const factory = jest.fn(() => stream);

    let renderer: ReturnType<typeof TestRenderer.create> | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(HookProbe, {
          apiKey: 'k',
          baseUrl: 'http://localhost',
          eventSourceFactory: factory as any,
          bufferSize: 2,
        }),
      );
    });

    act(() => {
      fire(JSON.stringify({...validEvent, id: 'a'}));
      fire(JSON.stringify({...validEvent, id: 'b'}));
      fire(JSON.stringify({...validEvent, id: 'c'}));
    });

    const result = (HookProbe as any).last as {
      events: WebhookEventPayload[];
    };
    expect(result.events).toHaveLength(2);
    expect(result.events.map((e) => e?.id)).toEqual(['c', 'b']);

    act(() => {
      renderer?.unmount();
    });
  });

  it('reports errors via lastError + onError but keeps the listener alive', () => {
    const {stream} = makeFakeStream();
    const factory = jest.fn(() => stream);
    const onError = jest.fn();

    let renderer: ReturnType<typeof TestRenderer.create> | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(HookProbe, {
          apiKey: 'k',
          baseUrl: 'http://localhost',
          eventSourceFactory: factory as any,
          onError,
        }),
      );
    });

    act(() => {
      stream.onerror?.(new Error('disconnect'));
    });

    const result = (HookProbe as any).last as {
      lastError: {code: string} | null;
    };
    expect(result.lastError?.code).toBe('TRANSPORT_ERROR');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({code: 'TRANSPORT_ERROR'}),
    );

    act(() => {
      renderer?.unmount();
    });
  });
});
