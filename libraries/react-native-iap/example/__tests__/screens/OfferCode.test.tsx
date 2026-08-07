import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';
import OfferCode from '../../screens/OfferCode';
import * as RNIap from 'react-native-iap';

const mockGetActiveSubscriptions = jest.fn();
const mockGetAvailablePurchases = jest.fn();
const mockPresentCodeRedemptionSheetIOS =
  RNIap.presentCodeRedemptionSheetIOS as jest.Mock;
const mockOpenRedeemOfferCodeAndroid =
  RNIap.openRedeemOfferCodeAndroid as jest.Mock;

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

  it('handles iOS offer code redemption button press', async () => {
    Platform.OS = 'ios';
    mockPresentCodeRedemptionSheetIOS.mockResolvedValue(undefined);

    const {getByText} = await render(<OfferCode />);

    const redeemButton = getByText('🎁 Redeem Offer Code');
    await fireEvent.press(redeemButton);

    await waitFor(() => {
      expect(mockPresentCodeRedemptionSheetIOS).toHaveBeenCalled();
    });
  });

  it('shows error when iOS redemption fails', async () => {
    Platform.OS = 'ios';
    mockPresentCodeRedemptionSheetIOS.mockRejectedValue(
      new Error('Redemption failed'),
    );

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
    mockOpenRedeemOfferCodeAndroid.mockResolvedValue(true);

    const {getByText} = await render(<OfferCode />);

    const redeemButton = getByText('🎁 Open Play Store');
    await fireEvent.press(redeemButton);

    await waitFor(() => {
      expect(mockOpenRedeemOfferCodeAndroid).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Play Store Opened',
        'Enter your code in the Play Store. After redemption, return to the app to see your purchase.',
      );
    });
  });

  it('shows error when Android redemption fails', async () => {
    Platform.OS = 'android';
    mockOpenRedeemOfferCodeAndroid.mockRejectedValue(
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

  it('shows Vega unsupported guidance without calling platform redemption APIs', async () => {
    (Platform as any).OS = 'kepler';
    const {getByText} = await render(<OfferCode />);

    await fireEvent.press(getByText('Amazon Vega IAP'));

    expect(mockPresentCodeRedemptionSheetIOS).not.toHaveBeenCalled();
    expect(mockOpenRedeemOfferCodeAndroid).not.toHaveBeenCalled();
    expect(
      getByText(/Offer code redemption is not supported on Amazon Vega/),
    ).toBeTruthy();
  });

  it('shows testing offer codes section', async () => {
    const {getByText} = await render(<OfferCode />);

    expect(getByText('Testing Offer Codes')).toBeTruthy();
  });
});
