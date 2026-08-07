import React from 'react';
import {render} from '@testing-library/react-native';
import {Text, View} from 'react-native';

// Simple component for testing
const TestComponent = () => (
  <View>
    <Text>expo-iap Example App</Text>
  </View>
);

describe('Basic Tests', () => {
  it('should render test component', async () => {
    const {getByText} = await render(<TestComponent />);
    expect(getByText('expo-iap Example App')).toBeTruthy();
  });

  it('should pass basic math test', async () => {
    expect(1 + 1).toBe(2);
  });

  it('should test string operations', async () => {
    const text = 'expo-iap';
    expect(text).toContain('iap');
    expect(text.length).toBe(8);
  });

  it('should test array operations', async () => {
    const products = ['product1', 'product2', 'product3'];
    expect(products).toHaveLength(3);
    expect(products).toContain('product2');
  });

  it('should test object operations', async () => {
    const product = {
      id: 'com.example.product',
      price: 9.99,
      platform: 'ios',
    };
    expect(product.id).toBe('com.example.product');
    expect(product.price).toBeGreaterThan(0);
    expect(product.platform).toMatch(/ios|android/);
  });
});
