import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {Platform} from 'react-native';
import Home from '../app/index';
import * as ExpoIap from 'expo-iap';

const mockPush = jest.fn();

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
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
    const {getByText} = await render(<Home />);
    expect(getByText('Choose a flow')).toBeDefined();

    await waitFor(() => {
      expect(ExpoIap.getStorefront).toHaveBeenCalled();
    });
  });

  it('should render the full example menu', async () => {
    const {getByText} = await render(<Home />);

    expect(getByText('All Products')).toBeDefined();
    expect(getByText('Purchase')).toBeDefined();
    expect(getByText('Subscription Flow')).toBeDefined();
    expect(getByText('Available Purchases')).toBeDefined();
    expect(getByText('Offer Code Redemption')).toBeDefined();
    expect(getByText('Alternative Billing')).toBeDefined();
    expect(getByText('App Ownership')).toBeDefined();
    expect(getByText('Check the app came from its store')).toBeDefined();

    await waitFor(() => {
      expect(ExpoIap.getStorefront).toHaveBeenCalled();
    });
  });

  it('lists App Ownership right after Alternative Billing and opens it', async () => {
    const {getAllByText, getByText} = await render(<Home />);

    const titles = getAllByText(/^(Alternative Billing|App Ownership)$/).map(
      (title) => title.props.children,
    );
    expect(titles).toEqual(['Alternative Billing', 'App Ownership']);

    await fireEvent.press(getByText('App Ownership'));

    expect(mockPush).toHaveBeenCalledWith('/app-ownership');
  });

  it('should render on iOS platform', async () => {
    // Mock Platform.OS to be iOS
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'ios'),
      configurable: true,
    });

    const {getByText} = await render(<Home />);
    expect(getByText('Choose a flow')).toBeDefined();

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

    const {getByText} = await render(<Home />);
    expect(getByText('Choose a flow')).toBeDefined();

    // getStorefront is called but resolves to empty string on unsupported platforms
    await waitFor(() => {
      expect(ExpoIap.getStorefront).toHaveBeenCalled();
    });

    consoleLog.mockRestore();
  });

  it('should skip storefront lookup on Vega', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'kepler'),
      configurable: true,
    });

    const {getByText} = await render(<Home />);
    expect(getByText('Choose a flow')).toBeDefined();
    expect(ExpoIap.getStorefront).not.toHaveBeenCalled();
  });
});
