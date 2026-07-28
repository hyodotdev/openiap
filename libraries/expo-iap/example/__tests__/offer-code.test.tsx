import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Platform, Alert} from 'react-native';
import OfferCode from '../app/offer-code';
import * as ExpoIap from 'expo-iap';

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

jest.mock('expo-iap', () => ({
  presentCodeRedemptionSheetIOS: jest.fn(() =>
    Promise.resolve({
      id: 'redeemed-transaction',
      productId: 'premium',
      store: 'apple',
    }),
  ),
  openRedeemOfferCodeAndroid: jest.fn(() => Promise.resolve(true)),
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

  it('should render without crashing', () => {
    const {getByText} = render(<OfferCode />);
    expect(getByText('Offer Code Redemption')).toBeDefined();
  });

  it('should show iOS instructions on iOS', () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'ios'),
      configurable: true,
    });

    const {getByText} = render(<OfferCode />);
    // Check for iOS-specific text from the actual component
    expect(
      getByText(/Tap the button below to open the redemption sheet/),
    ).toBeDefined();
    expect(
      getByText(/iOS supports in-app code redemption via StoreKit/),
    ).toBeDefined();
  });

  it('should show Android instructions on Android', () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'android'),
      configurable: true,
    });

    const {getByText} = render(<OfferCode />);
    // Check for Android-specific text from the actual component
    expect(getByText(/Tap the button to open Google Play Store/)).toBeDefined();
    expect(
      getByText(/Android requires redemption through Google Play Store/),
    ).toBeDefined();
  });

  it('should show Vega unsupported guidance without calling platform redemption APIs', () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'kepler'),
      configurable: true,
    });

    const {getByText} = render(<OfferCode />);

    fireEvent.press(getByText('Amazon Vega IAP'));

    expect(ExpoIap.presentCodeRedemptionSheetIOS).not.toHaveBeenCalled();
    expect(ExpoIap.openRedeemOfferCodeAndroid).not.toHaveBeenCalled();
    expect(
      getByText(/Offer code redemption is not supported on Amazon Vega/),
    ).toBeDefined();
  });

  it('should handle redeem button press on iOS', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'ios'),
      configurable: true,
    });

    const {getByText} = render(<OfferCode />);
    // The button text is "🎁 Redeem Offer Code" on iOS
    const redeemButton = getByText('🎁 Redeem Offer Code');

    fireEvent.press(redeemButton);

    // Wait for async operation and Alert
    await waitFor(() => {
      expect(ExpoIap.presentCodeRedemptionSheetIOS).toHaveBeenCalled();
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

    const {getByText} = render(<OfferCode />);
    // The button text is "🎁 Open Play Store" on Android
    const redeemButton = getByText('🎁 Open Play Store');

    fireEvent.press(redeemButton);

    // Wait for async operation and Alert
    await waitFor(() => {
      expect(ExpoIap.openRedeemOfferCodeAndroid).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Play Store Opened',
        'Enter your code in the Play Store. After redemption, return to the app to see your purchase.',
      );
    });
  });

  it('should explain the legacy iOS redemption result', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'ios'),
      configurable: true,
    });
    jest
      .mocked(ExpoIap.presentCodeRedemptionSheetIOS)
      .mockResolvedValueOnce(null);

    const {getByText} = render(<OfferCode />);
    fireEvent.press(getByText('🎁 Redeem Offer Code'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Redemption Sheet Presented',
        'This iOS version uses the legacy sheet. Refresh available purchases after completing redemption.',
      );
    });
  });

  it('should report unsupported Android store results', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'android'),
      configurable: true,
    });
    jest
      .mocked(ExpoIap.openRedeemOfferCodeAndroid)
      .mockResolvedValueOnce(false);

    const {getByText} = render(<OfferCode />);
    fireEvent.press(getByText('🎁 Open Play Store'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Not Supported',
        'This Android store does not provide an offer-code redemption flow.',
      );
    });
  });
});
