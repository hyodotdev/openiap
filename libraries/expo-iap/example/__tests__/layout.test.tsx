import React from 'react';
import {render} from '@testing-library/react-native';
import RootLayout from '../app/_layout';

jest.mock('@expo/react-native-action-sheet', () => ({
  ActionSheetProvider: ({children}: {children?: React.ReactNode}) => children,
}));

// Mock expo-router
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMock = require('react');
  const Stack = function MockStack({children}: {children?: React.ReactNode}) {
    return ReactMock.createElement('View', null, children);
  };
  Stack.displayName = 'MockStack';
  Stack.Screen = function MockScreen({name}: {name: string; options?: object}) {
    return ReactMock.createElement('View', {testID: name});
  };
  Stack.Screen.displayName = 'MockScreen';
  return {
    Stack,
  };
});

describe('RootLayout', () => {
  it('should render without crashing', () => {
    // Just call the function to ensure it executes without errors
    const component = RootLayout();
    expect(component).toBeDefined();
  });

  it('should return a valid React element', () => {
    const component = RootLayout();
    expect(React.isValidElement(component)).toBe(true);
  });

  it('should register every example route', () => {
    const {getByTestId} = render(<RootLayout />);

    [
      'index',
      'all-products',
      'purchase-flow',
      'subscription-flow',
      'available-purchases',
      'offer-code',
      'alternative-billing',
      'webhook-stream',
    ].forEach((route) => {
      expect(getByTestId(route)).toBeDefined();
    });
  });
});
