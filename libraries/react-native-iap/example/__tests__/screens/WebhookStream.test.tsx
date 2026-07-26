import {render} from '@testing-library/react-native';
import WebhookStream from '../../screens/WebhookStream';
import * as RNIap from 'react-native-iap';

const mockConnectWebhookStream = RNIap.connectWebhookStream as jest.Mock;

describe('WebhookStream Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the secret-backed stream out of the mobile example', () => {
    const {getByText, queryByText} = render(<WebhookStream />);

    expect(getByText('Webhook Stream')).toBeTruthy();
    expect(getByText('Trusted backend or MCP only')).toBeTruthy();
    expect(getByText('Do not connect from a shipped app')).toBeTruthy();
    expect(getByText(/openiap-kit_pk_/)).toBeTruthy();
    expect(getByText(/openiap-kit_sk_/)).toBeTruthy();
    expect(queryByText('Connect')).toBeNull();
    expect(mockConnectWebhookStream).not.toHaveBeenCalled();
  });
});
