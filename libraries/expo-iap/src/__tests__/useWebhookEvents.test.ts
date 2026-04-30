/* eslint-disable import/first */
jest.mock('react-native', () => ({
  Platform: {OS: 'ios', select: jest.fn((obj: any) => obj.ios)},
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

import * as React from 'react';
import * as ReactTestRenderer from 'react-test-renderer';

import {useWebhookEvents} from '../useWebhookEvents';
import type {
  WebhookEventPayload,
  WebhookEventStream,
} from '../webhook-client';

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
  (HookProbe as any).last = result;
  return null;
}

describe('useWebhookEvents (expo)', () => {
  afterEach(() => {
    (HookProbe as any).last = null;
  });

  it('opens a stream and forwards events into the buffer', () => {
    const {stream, fire} = makeFakeStream();
    const factory = jest.fn(() => stream);
    const onEvent = jest.fn();

    let renderer: ReturnType<typeof ReactTestRenderer.create> | null = null;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
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

    ReactTestRenderer.act(() => {
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

    ReactTestRenderer.act(() => {
      renderer?.unmount();
    });
    expect(stream.close).toHaveBeenCalled();
  });

  it('reports transport errors via onError without unmounting', () => {
    const {stream} = makeFakeStream();
    const factory = jest.fn(() => stream);
    const onError = jest.fn();

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        React.createElement(HookProbe, {
          apiKey: 'k',
          baseUrl: 'http://localhost',
          eventSourceFactory: factory as any,
          onError,
        }),
      );
    });

    ReactTestRenderer.act(() => {
      stream.onerror?.(new Error('disconnect'));
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({code: 'TRANSPORT_ERROR'}),
    );
  });
});
