import React from 'react';
import {render} from '@testing-library/react-native';
import WebhookStream from '../app/webhook-stream';
import * as ExpoIap from 'expo-iap';

const mockConnectWebhookStream = ExpoIap.connectWebhookStream as jest.Mock;

describe('WebhookStream Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the secret-backed stream out of the mobile example', () => {
    const {getByText, queryByText} = render(<WebhookStream />);

    expect(getByText('Webhook Stream')).toBeDefined();
    expect(getByText('Trusted backend or MCP only')).toBeDefined();
    expect(getByText('Do not connect from a shipped app')).toBeDefined();
    expect(getByText(/openiap-kit_pk_/)).toBeDefined();
    expect(getByText(/openiap-kit_sk_/)).toBeDefined();
    expect(queryByText('Connect')).toBeNull();
    expect(mockConnectWebhookStream).not.toHaveBeenCalled();
  });
});
