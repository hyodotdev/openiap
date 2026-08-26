import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';
import OfferCode from '../../screens/OfferCode';
import * as RNIap from 'react-native-iap';

const mockGetActiveSubscriptions = jest.fn();
const mockGetAvailablePurchases = jest.fn();
const mockOpenRedeemOfferCode = RNIap.openRedeemOfferCode as jest.Mock;

// Override the useIAP hook for this test
(RNIap.useIAP as jest.Mock).mockReturnValue({
  connected: true,
  activeSubscriptions: [],
  availablePurchases: [],
  getActiveSubscriptions: mockGetActiveSubscriptions,
  getAvailablePurchases: mockGetAvailablePurchases,
});

jest.spyOn(Alert, 'alert');

describe('OfferCode Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveSubscriptions.mockResolvedValue([]);
    mockGetAvailablePurchases.mockResolvedValue([]);
    mockOpenRedeemOfferCode.mockResolvedValue(null);
  });

  it('renders the screen title and description', async () => {
    const {getByText} = await render(<OfferCode />);

    expect(getByText('Offer Code Redemption')).toBeTruthy();
    expect(getByText('How it works:')).toBeTruthy();
  });

  it('shows connection status when connected', async () => {
    const {getByText} = await render(<OfferCode />);

    expect(getByText('Connected to Store')).toBeTruthy();
  });

  it('displays iOS-specific redemption button on iOS', async () => {
    Platform.OS = 'ios';
    const {getByText} = await render(<OfferCode />);

    const redeemButton = getByText('🎁 Redeem Offer Code');
    expect(redeemButton).toBeTruthy();
  });

  it('calls the unified API and reports the sheet on iOS null results', async () => {
    Platform.OS = 'ios';
    mockOpenRedeemOfferCode.mockResolvedValue(null);

    const {getByText} = await render(<OfferCode />);

    const redeemButton = getByText('🎁 Redeem Offer Code');
    await fireEvent.press(redeemButton);

    await waitFor(() => {
      expect(mockOpenRedeemOfferCode).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Redemption Sheet Presented',
        expect.stringContaining('Refresh available purchases'),
      );
    });
  });

  it('shows the redeemed purchase when iOS returns it synchronously', async () => {
    Platform.OS = 'ios';
    mockOpenRedeemOfferCode.mockResolvedValue({
      id: 'redeemed-transaction',
      productId: 'premium',
    });

    const {getByText} = await render(<OfferCode />);

    const redeemButton = getByText('🎁 Redeem Offer Code');
    await fireEvent.press(redeemButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Verified Redemption',
        'Redeemed premium (redeemed-transaction).',
      );
    });
  });

  it('shows error when iOS redemption fails', async () => {
    Platform.OS = 'ios';
    mockOpenRedeemOfferCode.mockRejectedValue(new Error('Redemption failed'));

    const {getByText} = await render(<OfferCode />);

    const redeemButton = getByText('🎁 Redeem Offer Code');
    await fireEvent.press(redeemButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to redeem code'),
      );
    });
  });

  it('displays Android-specific message on Android', async () => {
    Platform.OS = 'android';
    const {getByText} = await render(<OfferCode />);

    expect(getByText('🎁 Open Play Store')).toBeTruthy();
  });

  it('handles Android offer code redemption button press', async () => {
    Platform.OS = 'android';
    mockOpenRedeemOfferCode.mockResolvedValue(null);

    const {getByText} = await render(<OfferCode />);

    const redeemButton = getByText('🎁 Open Play Store');
    await fireEvent.press(redeemButton);

    await waitFor(() => {
      expect(mockOpenRedeemOfferCode).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Redemption Requested',
        'Google Play opens its redeem page; stores without one open nothing. Refresh available purchases after redeeming.',
      );
    });
  });

  it('shows error when Android redemption fails', async () => {
    Platform.OS = 'android';
    mockOpenRedeemOfferCode.mockRejectedValue(
      new Error('Play Store unavailable'),
    );

    const {getByText} = await render(<OfferCode />);

    const redeemButton = getByText('🎁 Open Play Store');
    await fireEvent.press(redeemButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to redeem code'),
      );
    });
  });

  it('shows Vega unsupported guidance without calling the redemption API', async () => {
    (Platform as any).OS = 'kepler';
    const {getByText} = await render(<OfferCode />);

    await fireEvent.press(getByText('Amazon Vega IAP'));

    expect(mockOpenRedeemOfferCode).not.toHaveBeenCalled();
    expect(
      getByText(/Offer code redemption is not supported on Amazon Vega/),
    ).toBeTruthy();
  });

  it('shows testing offer codes section', async () => {
    const {getByText} = await render(<OfferCode />);

    expect(getByText('Testing Offer Codes')).toBeTruthy();
  });
});
