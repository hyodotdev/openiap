import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Platform, Alert} from 'react-native';
import OfferCode from '../app/offer-code';
import * as ExpoIap from 'expo-iap';

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

jest.mock('expo-iap', () => ({
  openRedeemOfferCode: jest.fn(() =>
    Promise.resolve({
      id: 'redeemed-transaction',
      productId: 'premium',
      store: 'apple',
    }),
  ),
  useIAP: jest.fn(() => ({
    connected: true,
  })),
}));

describe('OfferCode Component', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => originalPlatform),
      configurable: true,
    });
  });

  it('should render without crashing', async () => {
    const {getByText} = await render(<OfferCode />);
    expect(getByText('Offer Code Redemption')).toBeDefined();
  });

  it('should show iOS instructions on iOS', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'ios'),
      configurable: true,
    });

    const {getByText} = await render(<OfferCode />);
    // Check for iOS-specific text from the actual component
    expect(
      getByText(/Tap the button below to open the redemption sheet/),
    ).toBeDefined();
    expect(
      getByText(/iOS supports in-app code redemption via StoreKit/),
    ).toBeDefined();
  });

  it('should show Android instructions on Android', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'android'),
      configurable: true,
    });

    const {getByText} = await render(<OfferCode />);
    // Check for Android-specific text from the actual component
    expect(getByText(/Tap the button to open Google Play Store/)).toBeDefined();
    expect(
      getByText(/Android requires redemption through Google Play Store/),
    ).toBeDefined();
  });

  it('should show Vega unsupported guidance without calling platform redemption APIs', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'kepler'),
      configurable: true,
    });

    const {getByText} = await render(<OfferCode />);

    await fireEvent.press(getByText('Amazon Vega IAP'));

    expect(ExpoIap.openRedeemOfferCode).not.toHaveBeenCalled();
    expect(
      getByText(/Offer code redemption is not supported on Amazon Vega/),
    ).toBeDefined();
  });

  it('should handle redeem button press on iOS', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'ios'),
      configurable: true,
    });

    const {getByText} = await render(<OfferCode />);
    // The button text is "🎁 Redeem Offer Code" on iOS
    const redeemButton = getByText('🎁 Redeem Offer Code');

    await fireEvent.press(redeemButton);

    // Wait for async operation and Alert
    await waitFor(() => {
      expect(ExpoIap.openRedeemOfferCode).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Verified Redemption',
        'Redeemed premium (redeemed-transaction).',
      );
    });
  });

  it('should handle redeem button press on Android', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'android'),
      configurable: true,
    });
    // Android resolves null after launching the Play redeem page
    jest.mocked(ExpoIap.openRedeemOfferCode).mockResolvedValueOnce(null);

    const {getByText} = await render(<OfferCode />);
    // The button text is "🎁 Open Play Store" on Android
    const redeemButton = getByText('🎁 Open Play Store');

    await fireEvent.press(redeemButton);

    // Wait for async operation and Alert
    await waitFor(() => {
      expect(ExpoIap.openRedeemOfferCode).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Redemption Requested',
        'Google Play opens its redeem page; stores without one open nothing. Refresh available purchases after redeeming.',
      );
    });
  });

  it('should explain a nil iOS redemption result', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'ios'),
      configurable: true,
    });
    jest.mocked(ExpoIap.openRedeemOfferCode).mockResolvedValueOnce(null);

    const {getByText} = await render(<OfferCode />);
    await fireEvent.press(getByText('🎁 Redeem Offer Code'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Redemption Sheet Presented',
        'The system sheet did not return a transaction directly. Refresh available purchases after completing redemption.',
      );
    });
  });

  it('should surface launch failures as errors', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'android'),
      configurable: true,
    });
    jest
      .mocked(ExpoIap.openRedeemOfferCode)
      .mockRejectedValueOnce(new Error('Unable to launch redeem page'));

    const {getByText} = await render(<OfferCode />);
    await fireEvent.press(getByText('🎁 Open Play Store'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to redeem code: Unable to launch redeem page',
      );
    });
  });
});
