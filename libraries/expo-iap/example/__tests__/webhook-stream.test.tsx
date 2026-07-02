import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import WebhookStream from '../app/webhook-stream';
import * as ExpoIap from 'expo-iap';

jest.mock('expo-constants', () => ({
  expoConfig: {extra: {}},
}));

const mockConnectWebhookStream = ExpoIap.connectWebhookStream as jest.Mock;

describe('WebhookStream Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as {btoa?: (value: string) => string}).btoa = (value) =>
      Buffer.from(value, 'binary').toString('base64');
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      }),
    ) as jest.Mock;
  });

  it('connects, renders incoming events, and triggers a test notification when configured', async () => {
    mockConnectWebhookStream.mockImplementationOnce((options) => {
      options.onEvent({
        id: 'event-1',
        type: 'TestNotification',
        source: 'google-play-real-time-developer-notifications',
        platform: 'Android',
        environment: 'Sandbox',
        projectId: 'project-1',
        occurredAt: Date.now(),
        receivedAt: Date.now(),
        productId: 'dev.hyo.martie.premium',
      });
      return {close: jest.fn()};
    });

    const {getByText} = render(
      <WebhookStream apiKey="test-key" baseUrl="http://localhost:8787" />,
    );

    fireEvent.press(getByText('Connect'));

    await waitFor(() => {
      expect(mockConnectWebhookStream).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-key',
          baseUrl: 'http://localhost:8787',
        }),
      );
      expect(getByText('TestNotification')).toBeDefined();
      expect(getByText(/productId: dev.hyo.martie.premium/)).toBeDefined();
    });

    fireEvent.press(getByText('Trigger test notification'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8787/v1/webhooks/test-key',
        expect.objectContaining({
          method: 'POST',
          headers: {'content-type': 'application/json'},
        }),
      );
      expect(getByText('Test notification accepted (200).')).toBeDefined();
    });
  });
});
