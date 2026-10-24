import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';
import PurchaseFlow from '../../screens/PurchaseFlow';
import * as RNIap from 'react-native-iap';
import {PRODUCT_IDS} from '../../src/utils/constants';
import {
  purchaseFlow,
  setVerificationMethod,
} from '../../src/utils/purchaseFlow';
import {ErrorCode} from 'react-native-iap';
import type {
  Purchase,
  PurchaseError,
  PurchaseFlowOutcome,
  PurchaseFlowStatus,
} from 'react-native-iap';

jest.mock(
  '@env',
  () => ({
    AMAZON_RVS_SANDBOX: 'false',
    IAPKIT_API_KEY: 'test-api-key',
    IAPKIT_BASE_URL: 'http://192.168.0.10:3100',
  }),
  {virtual: true},
);

describe('PurchaseFlow Screen', () => {
  const requestPurchaseMock = RNIap.requestPurchase as jest.Mock;
  const alertSpy = jest.spyOn(Alert, 'alert');

  const sampleProducts = [
    {
      id: 'dev.hyo.martie.10bulbs',
      title: '10 Bulbs',
      description: 'Get 10 bulbs for your garden',
      displayPrice: '$0.99',
      price: 0.99,
      currency: 'USD',
      type: 'in-app',
    },
    {
      id: 'dev.hyo.martie.30bulbs',
      title: '30 Bulbs',
      description: 'Get 30 bulbs for your garden',
      displayPrice: '$2.99',
      price: 2.99,
      currency: 'USD',
      type: 'in-app',
    },
  ];

  // Android product with discount offers (cross-platform)
  const androidProductWithOffers = {
    id: 'dev.hyo.martie.10bulbs',
    title: '10 Bulbs',
    description: 'Get 10 bulbs for your garden',
    displayPrice: '$0.99',
    price: 0.99,
    currency: 'USD',
    type: 'in-app' as const,
    platform: 'android' as const,
    nameAndroid: '10 Bulbs',
    discountOffers: [
      {
        id: 'base-offer',
        displayPrice: '$0.99',
        price: 0.99,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-base-123',
        offerTagsAndroid: ['bestseller'],
        fullPriceMicrosAndroid: null,
        percentageDiscountAndroid: null,
        formattedDiscountAmountAndroid: null,
        discountAmountMicrosAndroid: null,
        limitedQuantityInfoAndroid: null,
        validTimeWindowAndroid: null,
        preorderDetailsAndroid: null,
        rentalDetailsAndroid: null,
      },
      {
        id: 'discount-offer',
        displayPrice: '$0.79',
        price: 0.79,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-discount-456',
        offerTagsAndroid: ['sale', 'limited'],
        fullPriceMicrosAndroid: '990000',
        percentageDiscountAndroid: 20,
        formattedDiscountAmountAndroid: '$0.20',
        discountAmountMicrosAndroid: '200000',
        limitedQuantityInfoAndroid: {
          maximumQuantity: 100,
          remainingQuantity: 45,
        },
        validTimeWindowAndroid: {
          startTimeMillis: '1702300800000',
          endTimeMillis: '1702905600000',
        },
        preorderDetailsAndroid: null,
        rentalDetailsAndroid: null,
      },
    ],
  };

  // Android product with preorder details
  const androidProductWithPreorder = {
    id: 'dev.hyo.martie.preorder',
    title: 'Preorder Item',
    description: 'A preorder product',
    displayPrice: '$9.99',
    price: 9.99,
    currency: 'USD',
    type: 'in-app' as const,
    platform: 'android' as const,
    nameAndroid: 'Preorder Item',
    discountOffers: [
      {
        id: null,
        displayPrice: '$9.99',
        price: 9.99,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-preorder-789',
        offerTagsAndroid: [],
        fullPriceMicrosAndroid: null,
        percentageDiscountAndroid: null,
        formattedDiscountAmountAndroid: null,
        discountAmountMicrosAndroid: null,
        limitedQuantityInfoAndroid: null,
        validTimeWindowAndroid: null,
        preorderDetailsAndroid: {
          preorderReleaseTimeMillis: '1704067200000',
          preorderPresaleEndTimeMillis: '1703980800000',
        },
        rentalDetailsAndroid: null,
      },
    ],
  };

  // Android product with rental details
  const androidProductWithRental = {
    id: 'dev.hyo.martie.rental',
    title: 'Rental Item',
    description: 'A rental product',
    displayPrice: '$4.99',
    price: 4.99,
    currency: 'USD',
    type: 'in-app' as const,
    platform: 'android' as const,
    nameAndroid: 'Rental Item',
    discountOffers: [
      {
        id: null,
        displayPrice: '$4.99',
        price: 4.99,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-rental-abc',
        offerTagsAndroid: [],
        fullPriceMicrosAndroid: null,
        percentageDiscountAndroid: null,
        formattedDiscountAmountAndroid: null,
        discountAmountMicrosAndroid: null,
        limitedQuantityInfoAndroid: null,
        validTimeWindowAndroid: null,
        preorderDetailsAndroid: null,
        rentalDetailsAndroid: {
          rentalPeriod: 'P7D',
          rentalExpirationPeriod: 'P30D',
        },
      },
    ],
  };

  // Android product with absolute discount (no percentage)
  const androidProductWithAbsoluteDiscount = {
    id: 'dev.hyo.martie.absolute',
    title: 'Absolute Discount Item',
    description: 'A product with absolute discount',
    displayPrice: '$1.99',
    price: 1.99,
    currency: 'USD',
    type: 'in-app' as const,
    platform: 'android' as const,
    nameAndroid: 'Absolute Discount Item',
    discountOffers: [
      {
        id: 'abs-discount',
        displayPrice: '$1.99',
        price: 1.99,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-abs-xyz',
        offerTagsAndroid: [],
        fullPriceMicrosAndroid: '2990000',
        percentageDiscountAndroid: null,
        formattedDiscountAmountAndroid: '$1.00',
        discountAmountMicrosAndroid: '1000000',
        limitedQuantityInfoAndroid: null,
        validTimeWindowAndroid: null,
        preorderDetailsAndroid: null,
        rentalDetailsAndroid: null,
      },
    ],
  };

  const bulbs: Purchase = {
    id: 'transaction-1',
    productId: 'dev.hyo.martie.10bulbs',
    purchaseToken: 'apple-jws',
    purchaseState: 'purchased',
    quantity: 1,
    isAutoRenewing: false,
    transactionDate: 1,
    store: 'apple',
    storeId: 'apple',
  };

  let options: Parameters<typeof RNIap.useIAP>[0];

  const mockIapState = (
    overrides: Partial<ReturnType<typeof RNIap.useIAP>> & {
      connected?: boolean;
    } = {},
  ) => {
    const fetchProducts = jest.fn(() => Promise.resolve());

    (RNIap.useIAP as jest.Mock).mockImplementation((hookOptions) => {
      options = hookOptions;
      return {
        connected: true,
        products: sampleProducts,
        fetchProducts,
        ...overrides,
      };
    });

    return {fetchProducts};
  };

  const report = async (
    purchase: Purchase,
    status: PurchaseFlowStatus,
  ): Promise<void> => {
    const outcome: PurchaseFlowOutcome<Purchase> = {purchase, status};
    await act(async () => {
      options?.onPurchaseFlowOutcome?.(outcome);
    });
  };

  const fail = async (error: PurchaseError): Promise<void> => {
    await act(async () => {
      options?.onPurchaseError?.(error);
    });
  };

  beforeEach(() => {
    setVerificationMethod('iapkit-localhost');
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockIapState();
  });

  it('renders loading state when not connected', async () => {
    mockIapState({connected: false, products: []});

    const {getByText} = await render(<PurchaseFlow />);

    expect(getByText('Connecting to Store...')).toBeTruthy();
  });

  it('fetches products when connected', async () => {
    const {fetchProducts} = mockIapState();

    await render(<PurchaseFlow />);

    await waitFor(() => {
      expect(fetchProducts).toHaveBeenCalledWith({
        skus: PRODUCT_IDS,
        type: 'in-app',
      });
    });
  });

  it('hands the app purchase flow to useIAP', async () => {
    await render(<PurchaseFlow />);

    expect(options?.purchaseFlow).toBe(purchaseFlow);
  });

  it('displays fetched products', async () => {
    const {getByText} = await render(<PurchaseFlow />);

    expect(getByText('10 Bulbs')).toBeTruthy();
    expect(getByText('30 Bulbs')).toBeTruthy();
    expect(getByText('Local (IAPKit)')).toBeTruthy();
  });

  it('initiates purchase when purchase button pressed', async () => {
    const {getAllByText} = await render(<PurchaseFlow />);

    const purchaseButtons = getAllByText('Purchase');
    await fireEvent.press(purchaseButtons[0]!);

    expect(requestPurchaseMock).toHaveBeenCalledWith({
      request: {
        apple: {
          sku: 'dev.hyo.martie.10bulbs',
          quantity: 1,
        },
        google: {
          skus: ['dev.hyo.martie.10bulbs'],
        },
      },
      type: 'in-app',
    });
  });

  it('stays processing until the requested product has an outcome', async () => {
    const screen = await render(<PurchaseFlow />);

    await fireEvent.press(screen.getAllByText('Purchase')[0]!);
    expect(screen.getAllByText('Processing...')).toHaveLength(2);

    await report(
      {...bulbs, id: 'recovered', productId: 'dev.hyo.martie.30bulbs'},
      {status: 'entitled', alreadyGranted: false},
    );
    expect(screen.getAllByText('Processing...')).toHaveLength(2);

    await report(bulbs, {status: 'entitled', alreadyGranted: false});
    expect(screen.queryByText('Processing...')).toBeNull();
    expect(screen.getByText('Purchase verified. Access granted.')).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
  });

  it('ignores outcomes for products outside this screen', async () => {
    const screen = await render(<PurchaseFlow />);

    await fireEvent.press(screen.getAllByText('Purchase')[0]!);
    await report(
      {...bulbs, productId: 'dev.hyo.martie.premium'},
      {status: 'failed', error: new Error('offline')},
    );

    expect(screen.getByText('Processing purchase...')).toBeTruthy();
    expect(screen.getAllByText('Processing...')).toHaveLength(2);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows a failed verification and leaves the purchase to recovery', async () => {
    const screen = await render(<PurchaseFlow />);

    await report(bulbs, {status: 'failed', error: new Error('offline')});

    expect(
      screen.getByText('Purchase verification failed: offline'),
    ).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      'Verification Failed',
      'Purchase verification failed: offline',
    );
  });

  it('retains a receipt in None mode and recovers it after a method is chosen', async () => {
    Platform.OS = 'android';
    const screen = await render(<PurchaseFlow />);

    await fireEvent.press(screen.getByText('Local (IAPKit)'));
    await fireEvent.press(
      screen.getAllByTestId('verification-method-option')[3]!,
    );
    expect(purchaseFlow.recoverPurchases).not.toHaveBeenCalled();
    await report(bulbs, {status: 'verified'});
    expect(screen.getByText(/Receipt retained/)).toBeTruthy();

    await fireEvent.press(screen.getByText('None (Skip)'));
    await fireEvent.press(
      screen.getAllByTestId('verification-method-option')[1]!,
    );
    expect(screen.getByText('Local (IAPKit)')).toBeTruthy();
    expect(purchaseFlow.recoverPurchases).toHaveBeenCalledTimes(1);
  });

  it('renders Android verification choices together in the requested order', async () => {
    Platform.OS = 'android';
    const {getAllByTestId, getByText} = await render(<PurchaseFlow />);

    await fireEvent.press(getByText('Local (IAPKit)'));

    const choices = getAllByTestId('verification-method-option');
    expect(choices.map((choice) => choice.props.accessibilityLabel)).toEqual([
      'Local (Device)',
      'Local (IAPKit)',
      'IAPKit',
      'None (Skip)',
    ]);

    await fireEvent.press(choices[3]!);
    await waitFor(() => {
      expect(getByText('None (Skip)')).toBeTruthy();
    });
  });

  it('releases processing and reports a purchase error', async () => {
    const screen = await render(<PurchaseFlow />);

    await fireEvent.press(screen.getAllByText('Purchase')[0]!);
    await fail({
      code: ErrorCode.NetworkError,
      message: 'Something went wrong',
    });

    expect(screen.queryByText('Processing...')).toBeNull();
    expect(
      screen.getByText(
        `Purchase failed: Something went wrong (code: ${ErrorCode.NetworkError})`,
      ),
    ).toBeTruthy();
  });

  it('handles user cancelled error correctly', async () => {
    const {getByText} = await render(<PurchaseFlow />);

    await fail({
      code: ErrorCode.UserCancelled,
      message: 'User cancelled the purchase',
    });

    expect(getByText('Purchase cancelled by user')).toBeTruthy();
  });

  it('releases processing when the request itself fails', async () => {
    requestPurchaseMock.mockRejectedValueOnce({
      code: ErrorCode.ServiceError,
      message: 'Store unavailable',
    });
    const screen = await render(<PurchaseFlow />);

    await fireEvent.press(screen.getAllByText('Purchase')[0]!);

    expect(screen.queryByText('Processing...')).toBeNull();
    expect(screen.getByText('Purchase failed: Store unavailable')).toBeTruthy();
  });

  // Android discount offers tests (cross-platform)
  describe('Android Discount Offers (Cross-platform)', () => {
    it('displays product details modal with discount offers', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Product Details')).toBeTruthy();
        expect(getByText('Discount Offers (2)')).toBeTruthy();
      });
    });

    it('displays offer with percentage discount', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('20% off')).toBeTruthy();
      });
    });

    it('displays offer with full price when discounted', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Full Price (micros):')).toBeTruthy();
        expect(getByText('990000')).toBeTruthy();
      });
    });

    it('displays limited quantity info', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Limited Quantity:')).toBeTruthy();
        expect(getByText('45 / 100 remaining')).toBeTruthy();
      });
    });

    it('displays valid time window', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Valid Window:')).toBeTruthy();
      });
    });

    it('displays offer tags', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getAllByText('Tags:').length).toBeGreaterThanOrEqual(1);
        expect(getByText('sale, limited')).toBeTruthy();
      });
    });

    it('displays preorder details', async () => {
      mockIapState({products: [androidProductWithPreorder]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Pre-order Release:')).toBeTruthy();
      });
    });

    it('displays rental details', async () => {
      mockIapState({products: [androidProductWithRental]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Rental:')).toBeTruthy();
        expect(getByText('Period: P30D')).toBeTruthy();
      });
    });

    it('displays formatted discount amount', async () => {
      mockIapState({products: [androidProductWithAbsoluteDiscount]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('$1.00')).toBeTruthy();
      });
    });

    it('closes modal when close button pressed', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText, queryByText} = await render(
        <PurchaseFlow />,
      );

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Product Details')).toBeTruthy();
      });

      // Close modal
      await fireEvent.press(getByText('Close'));

      await waitFor(() => {
        expect(queryByText('Discount Offers (2)')).toBeNull();
      });
    });

    it('displays offer ID when present', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('base-offer')).toBeTruthy();
        expect(getByText('discount-offer')).toBeTruthy();
      });
    });
  });
});
