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
  return {
    Stack,
  };
});

describe('RootLayout', () => {
  it('should render without crashing', async () => {
    const {toJSON} = await render(<RootLayout />);
    expect(toJSON()).toBeDefined();
  });

  it('should return a valid React element', async () => {
    const component = <RootLayout />;
    expect(React.isValidElement(component)).toBe(true);
  });

  it('should register every example route', async () => {
    const {getByTestId} = await render(<RootLayout />);

    [
      'index',
      'all-products',
      'purchase-flow',
      'subscription-flow',
      'available-purchases',
      'offer-code',
      'alternative-billing',
    ].forEach((route) => {
      expect(getByTestId(route)).toBeDefined();
    });
  });
});
