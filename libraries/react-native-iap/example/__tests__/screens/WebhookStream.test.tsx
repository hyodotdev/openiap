import {fireEvent, render, waitFor} from '@testing-library/react-native';
import WebhookStream, {base64EncodeUtf8} from '../../screens/WebhookStream';

describe('WebhookStream Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn(() => Promise.resolve('')),
    });
  });

  it('renders webhook stream controls', () => {
    const {getByText} = render(<WebhookStream />);

    expect(getByText('Webhook Stream')).toBeTruthy();
    expect(getByText('IAPKit SSE + test notification')).toBeTruthy();
    expect(getByText('Connect')).toBeTruthy();
    expect(getByText('Trigger test notification')).toBeTruthy();
    expect(
      getByText('No events yet. Connect, then trigger a test notification.'),
    ).toBeTruthy();
  });

  it('shows a configuration error when connecting without an API key', () => {
    const {getByText} = render(<WebhookStream />);

    fireEvent.press(getByText('Connect'));

    expect(getByText('Status: error')).toBeTruthy();
    expect(getByText('IAPKIT_API_KEY is not configured.')).toBeTruthy();
  });

  it('does not post a test notification without an API key', async () => {
    const {getByText} = render(<WebhookStream />);

    fireEvent.press(getByText('Trigger test notification'));

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
      expect(
        getByText('Cannot trigger test: IAPKIT_API_KEY is missing.'),
      ).toBeTruthy();
    });
  });

  it('fails explicitly when base64 encoding support is missing', () => {
    const globalWithBtoa = globalThis as {btoa?: (value: string) => string};
    const originalBtoa = globalWithBtoa.btoa;

    try {
      delete globalWithBtoa.btoa;

      expect(() => base64EncodeUtf8('{"type":"test-notification"}')).toThrow(
        'btoa is not available in this environment',
      );
    } finally {
      if (originalBtoa) {
        globalWithBtoa.btoa = originalBtoa;
      }
    }
  });
});
