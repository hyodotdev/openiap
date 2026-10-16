import {fireEvent, render, waitFor} from '@testing-library/react-native';
import AllProducts from '../app/all-products';

const mockPush = jest.fn();
const mockFetchProducts = jest.fn().mockResolvedValue(undefined);
const mockRequestPurchase = jest.fn();

jest.mock('expo-router', () => ({useRouter: () => ({push: mockPush})}));
jest.mock('expo-iap', () => ({
  useIAP: () => ({
    connected: true,
    products: [
      {
        id: 'dev.hyo.martie.10bulbs',
        type: 'in-app',
        platform: 'android',
        displayName: '10 Bulbs',
        title: '10 Bulbs (Martie: Focus & Habit)',
        description: 'A pack of ten bulbs.',
        displayPrice: '₩1,400',
      },
    ],
    subscriptions: [
      {
        id: 'premium',
        title: 'Premium Year',
        platform: 'android',
        type: 'subs',
        displayPrice: '$50',
        subscriptionOffers: [
          {
            offerTokenAndroid: 'monthly-prepaid',
            displayPrice: '$5',
            pricingPhasesAndroid: {
              pricingPhaseList: [{billingPeriod: 'P1M', recurrenceMode: 3}],
            },
          },
        ],
      },
    ],
    fetchProducts: mockFetchProducts,
    requestPurchase: mockRequestPurchase,
  }),
}));

beforeEach(() => jest.clearAllMocks());

it('browses readable product metadata and details without starting a purchase', async () => {
  const screen = await render(<AllProducts />);
  await waitFor(() => expect(mockFetchProducts).toHaveBeenCalledTimes(2));

  expect(screen.getByText('10 Bulbs')).toBeTruthy();
  expect(screen.getByText('₩1,400')).toBeTruthy();
  expect(screen.getByText('$5')).toBeTruthy();
  expect(screen.getByText('for 1 month · Does not renew')).toBeTruthy();
  expect(screen.queryByText('$50')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', {name: 'Details for 10 Bulbs'}),
  );
  expect(screen.getByText('10 Bulbs (Martie: Focus & Habit)')).toBeTruthy();
  expect(mockRequestPurchase).not.toHaveBeenCalled();
});

it('makes the route from catalog to purchase demo explicit', async () => {
  const screen = await render(<AllProducts />);
  await waitFor(() => expect(mockFetchProducts).toHaveBeenCalledTimes(2));
  await fireEvent.press(
    screen.getByRole('button', {name: 'Open purchase demo'}),
  );

  expect(mockPush).toHaveBeenCalledWith('/purchase-flow');
  expect(mockRequestPurchase).not.toHaveBeenCalled();
});
