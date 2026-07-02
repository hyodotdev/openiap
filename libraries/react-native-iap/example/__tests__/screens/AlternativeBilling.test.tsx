import {fireEvent, render} from '@testing-library/react-native';
import {Platform} from 'react-native';
import * as RNIap from 'react-native-iap';
import AlternativeBilling from '../../screens/AlternativeBilling';

describe('AlternativeBilling Screen', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (RNIap.useIAP as jest.Mock).mockReturnValue({
      connected: true,
      products: [
        {
          id: 'dev.hyo.martie.consumable',
          title: 'Test Consumable',
          description: 'Test consumable description',
          displayPrice: '$0.99',
          type: 'in-app',
        },
      ],
      fetchProducts: jest.fn(() => Promise.resolve([])),
      finishTransaction: jest.fn(() => Promise.resolve()),
    });
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
  });

  it('renders Amazon Vega as unsupported for alternative billing', () => {
    (Platform as any).OS = 'kepler';

    const {getByText} = render(<AlternativeBilling />);

    expect(getByText('Not supported on Amazon Vega')).toBeTruthy();
    expect(
      getByText(/Alternative billing APIs are intentionally unsupported/),
    ).toBeTruthy();
    expect(getByText('Current mode: Amazon Vega standard IAP')).toBeTruthy();

    fireEvent.press(getByText('Test Consumable'));

    expect(getByText('Not supported on Vega')).toBeTruthy();
  });
});
