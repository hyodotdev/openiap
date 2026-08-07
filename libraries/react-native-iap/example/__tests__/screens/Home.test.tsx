import {render, fireEvent} from '@testing-library/react-native';
import Home from '../../screens/Home';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

describe('Home Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header with correct title and subtitle', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    expect(getByText('React Native IAP')).toBeTruthy();
    expect(getByText('Powered by Nitro Modules ⚡️')).toBeTruthy();
  });

  it('renders all menu items', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    expect(getByText('All Products')).toBeTruthy();
    expect(getByText('View all products and subscriptions')).toBeTruthy();

    expect(getByText('Purchase Flow')).toBeTruthy();
    expect(getByText('Test in-app purchases')).toBeTruthy();

    expect(getByText('Subscription Flow')).toBeTruthy();
    expect(
      getByText('Test subscription purchases with useIAP hook'),
    ).toBeTruthy();

    expect(getByText('Available Purchases')).toBeTruthy();
    expect(getByText('View and manage your purchases')).toBeTruthy();

    expect(getByText('Offer Code')).toBeTruthy();
    expect(getByText('Redeem promotional offers')).toBeTruthy();

    expect(getByText('Alternative Billing')).toBeTruthy();
    expect(
      getByText('External purchase links & alternative billing'),
    ).toBeTruthy();
  });

  it('navigates to AllProducts when All Products menu item is pressed', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    const allProductsButton = getByText('All Products').parent?.parent;
    if (allProductsButton) {
      await fireEvent.press(allProductsButton);
    }

    expect(mockNavigate).toHaveBeenCalledWith('AllProducts');
  });

  it('navigates to PurchaseFlow when Purchase Flow menu item is pressed', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    const purchaseFlowButton = getByText('Purchase Flow').parent?.parent;
    if (purchaseFlowButton) {
      await fireEvent.press(purchaseFlowButton);
    }

    expect(mockNavigate).toHaveBeenCalledWith('PurchaseFlow');
  });

  it('navigates to SubscriptionFlow when Subscription Flow menu item is pressed', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    const subscriptionFlowButton =
      getByText('Subscription Flow').parent?.parent;
    if (subscriptionFlowButton) {
      await fireEvent.press(subscriptionFlowButton);
    }

    expect(mockNavigate).toHaveBeenCalledWith('SubscriptionFlow');
  });

  it('navigates to AvailablePurchases when Available Purchases menu item is pressed', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    const availablePurchasesButton = getByText('Available Purchases').parent
      ?.parent;
    if (availablePurchasesButton) {
      await fireEvent.press(availablePurchasesButton);
    }

    expect(mockNavigate).toHaveBeenCalledWith('AvailablePurchases');
  });

  it('navigates to OfferCode when Offer Code menu item is pressed', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    const offerCodeButton = getByText('Offer Code').parent?.parent;
    if (offerCodeButton) {
      await fireEvent.press(offerCodeButton);
    }

    expect(mockNavigate).toHaveBeenCalledWith('OfferCode');
  });

  it('navigates to AlternativeBilling when Alternative Billing menu item is pressed', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    const alternativeBillingButton = getByText('Alternative Billing').parent
      ?.parent;
    if (alternativeBillingButton) {
      await fireEvent.press(alternativeBillingButton);
    }

    expect(mockNavigate).toHaveBeenCalledWith('AlternativeBilling');
  });

  it('renders footer text', async () => {
    const {getByText} = await render(
      <Home navigation={{navigate: mockNavigate} as any} />,
    );

    expect(
      getByText('Example app for react-native-iap with Nitro Modules'),
    ).toBeTruthy();
  });
});
