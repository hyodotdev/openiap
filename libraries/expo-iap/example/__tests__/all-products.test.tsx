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
    subscriptions: [],
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
