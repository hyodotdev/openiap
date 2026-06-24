import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {Platform} from 'react-native';
import Home from '../app/index';
import * as ExpoIap from 'expo-iap';

// Mock expo-router
jest.mock('expo-router', () => ({
  Link: ({children}: any) => children,
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock expo-iap
jest.mock('expo-iap', () => ({
  getStorefront: jest.fn(() => Promise.resolve('US')),
}));

describe('Home Component', () => {
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
    const {getByText} = render(<Home />);
    expect(getByText('expo-iap Examples')).toBeDefined();

    await waitFor(() => {
      expect(ExpoIap.getStorefront).toHaveBeenCalled();
    });
  });

  it('should render the full example menu', async () => {
    const {getByText} = render(<Home />);

    expect(getByText('All Products')).toBeDefined();
    expect(getByText('In-App Purchase Flow')).toBeDefined();
    expect(getByText('Subscription Flow')).toBeDefined();
    expect(getByText('Available Purchases')).toBeDefined();
    expect(getByText('Offer Code Redemption')).toBeDefined();
    expect(getByText('Alternative Billing')).toBeDefined();
    expect(getByText('Webhook Stream')).toBeDefined();

    await waitFor(() => {
      expect(ExpoIap.getStorefront).toHaveBeenCalled();
    });
  });

  it('should render on iOS platform', async () => {
    // Mock Platform.OS to be iOS
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'ios'),
      configurable: true,
    });

    const {getByText} = render(<Home />);
    expect(getByText('expo-iap Examples')).toBeDefined();

    // Wait for async operations to complete
    await waitFor(() => {
      expect(ExpoIap.getStorefront).toHaveBeenCalled();
    });
  });

  it('should render on Android platform', async () => {
    // Mock Platform.OS to be Android
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'android'),
      configurable: true,
    });

    const consoleLog = jest.spyOn(console, 'log').mockImplementation();

    const {getByText} = render(<Home />);
    expect(getByText('expo-iap Examples')).toBeDefined();

    // getStorefront is called but resolves to empty string on unsupported platforms
    await waitFor(() => {
      expect(ExpoIap.getStorefront).toHaveBeenCalled();
    });

    consoleLog.mockRestore();
  });

  it('should skip storefront lookup on Vega', () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'kepler'),
      configurable: true,
    });

    const {getByText} = render(<Home />);
    expect(getByText('expo-iap Examples')).toBeDefined();
    expect(ExpoIap.getStorefront).not.toHaveBeenCalled();
  });
});
