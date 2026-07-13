import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {ActionSheetIOS, Alert, Platform} from 'react-native';
import PurchaseFlow from '../../screens/PurchaseFlow';
import * as RNIap from 'react-native-iap';
import {PRODUCT_IDS} from '../../src/utils/constants';
import {ErrorCode} from 'react-native-iap';

jest.mock(
  '@env',
  () => ({
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

  let onPurchaseSuccess: ((purchase: any) => Promise<void> | void) | undefined;
  let onPurchaseError: ((error: any) => void) | undefined;

  const mockIapState = (
    overrides: Partial<ReturnType<typeof RNIap.useIAP>> & {
      connected?: boolean;
    } = {},
  ) => {
    const fetchProducts = jest.fn(() => Promise.resolve());
    const getAvailablePurchases = jest.fn(() => Promise.resolve());
    const finishTransaction = jest.fn(() => Promise.resolve());
    const verifyPurchase = jest.fn(() => Promise.resolve({}));
    const verifyPurchaseWithProvider = jest.fn(() =>
      Promise.resolve({
        iapkit: {
          isValid: true,
          state: 'purchased',
          store: 'amazon',
        },
      }),
    );

    (RNIap.useIAP as jest.Mock).mockImplementation((options) => {
      onPurchaseSuccess = options?.onPurchaseSuccess;
      onPurchaseError = options?.onPurchaseError;

      return {
        connected: true,
        products: sampleProducts,
        availablePurchases: [],
        activeSubscriptions: [],
        fetchProducts,
        finishTransaction,
        getAvailablePurchases,
        verifyPurchase,
        verifyPurchaseWithProvider,
        ...overrides,
      };
    });

    return {
      fetchProducts,
      getAvailablePurchases,
      finishTransaction,
      verifyPurchase,
      verifyPurchaseWithProvider,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockIapState();
  });

  it('renders loading state when not connected', () => {
    mockIapState({connected: false, products: []});

    const {getByText} = render(<PurchaseFlow />);

    expect(getByText('Connecting to Store...')).toBeTruthy();
  });

  it('fetches products when connected', async () => {
    const {fetchProducts} = mockIapState();

    render(<PurchaseFlow />);

    await waitFor(() => {
      expect(fetchProducts).toHaveBeenCalledWith({
        skus: PRODUCT_IDS,
        type: 'in-app',
      });
    });
  });

  it('displays fetched products', () => {
    const {getByText} = render(<PurchaseFlow />);

    expect(getByText('10 Bulbs')).toBeTruthy();
    expect(getByText('30 Bulbs')).toBeTruthy();
    expect(getByText('Local (IAPKit)')).toBeTruthy();
  });

  it('initiates purchase when purchase button pressed', () => {
    const {getAllByText} = render(<PurchaseFlow />);

    const purchaseButtons = getAllByText('Purchase');
    fireEvent.press(purchaseButtons[0]!);

    expect(requestPurchaseMock).toHaveBeenCalledWith({
      request: {
        ios: {
          sku: 'dev.hyo.martie.10bulbs',
          quantity: 1,
        },
        android: {
          skus: ['dev.hyo.martie.10bulbs'],
        },
      },
      type: 'in-app',
    });
  });

  it('routes Local (IAPKit) through the configured local server', async () => {
    const {finishTransaction, verifyPurchase, verifyPurchaseWithProvider} =
      mockIapState();

    render(<PurchaseFlow />);

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(verifyPurchase).not.toHaveBeenCalled();
    expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        baseUrl: 'http://192.168.0.10:3100',
        apple: {jws: 'apple-jws'},
      },
    });
    expect(verifyPurchaseWithProvider.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );
  });

  it('keeps Local (Device) on direct Apple/Google verification', async () => {
    const selectorSpy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(0));
    const {finishTransaction, verifyPurchase, verifyPurchaseWithProvider} =
      mockIapState();
    const {getByText} = render(<PurchaseFlow />);

    fireEvent.press(getByText('Local (IAPKit)'));
    await waitFor(() => {
      expect(getByText('Local (Device)')).toBeTruthy();
    });

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-device-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'device-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(verifyPurchase).toHaveBeenCalledWith({
      apple: {sku: 'dev.hyo.martie.10bulbs'},
      google: {
        sku: 'dev.hyo.martie.10bulbs',
        accessToken: 'YOUR_OAUTH_ACCESS_TOKEN',
        packageName: 'dev.hyo.martie',
        purchaseToken: 'device-apple-jws',
        isSub: false,
      },
    });
    expect(verifyPurchaseWithProvider).not.toHaveBeenCalled();
    expect(verifyPurchase.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );

    selectorSpy.mockRestore();
  });

  it('omits the local base URL when hosted IAPKit is selected', async () => {
    const selectorSpy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(2));
    const {verifyPurchaseWithProvider} = mockIapState();
    const {getByText} = render(<PurchaseFlow />);

    fireEvent.press(getByText('Local (IAPKit)'));
    await waitFor(() => {
      expect(getByText('IAPKit')).toBeTruthy();
    });

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-2',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'hosted-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        apple: {jws: 'hosted-apple-jws'},
      },
    });

    selectorSpy.mockRestore();
  });

  it('renders Android verification choices together in the requested order', async () => {
    Platform.OS = 'android';
    const {getAllByTestId, getByText} = render(<PurchaseFlow />);

    fireEvent.press(getByText('Local (IAPKit)'));

    const options = getAllByTestId('verification-method-option');
    expect(options.map((option) => option.props.accessibilityLabel)).toEqual([
      'Local (Device)',
      'Local (IAPKit)',
      'IAPKit',
      'None (Skip)',
    ]);

    fireEvent.press(options[3]!);
    await waitFor(() => {
      expect(getByText('None (Skip)')).toBeTruthy();
    });
  });

  it('updates state on purchase success callback', async () => {
    const {finishTransaction} = mockIapState();

    const {getByText, queryByText} = render(<PurchaseFlow />);

    expect(
      queryByText(/Purchase completed and finished successfully/),
    ).toBeNull();

    await act(async () => {
      await onPurchaseSuccess?.({
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'token-123',
        purchaseState: 'purchased',
        transactionDate: Date.now(),
      });
    });

    await waitFor(() => {
      expect(
        getByText(/Purchase completed and finished successfully/),
      ).toBeTruthy();
    });
    expect(finishTransaction).toHaveBeenCalledWith({
      purchase: expect.objectContaining({
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'token-123',
      }),
      isConsumable: true,
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
  });

  it('updates message on purchase error callback', async () => {
    mockIapState();

    const {getByText} = render(<PurchaseFlow />);

    await act(async () => {
      onPurchaseError?.({
        code: ErrorCode.NetworkError,
        message: 'Something went wrong',
      });
    });

    await waitFor(() => {
      expect(
        getByText(
          `Purchase failed: Something went wrong (code: ${ErrorCode.NetworkError})`,
        ),
      ).toBeTruthy();
    });
  });

  it('handles user cancelled error correctly', async () => {
    mockIapState();

    const {getByText} = render(<PurchaseFlow />);

    await act(async () => {
      onPurchaseError?.({
        code: ErrorCode.UserCancelled,
        message: 'User cancelled the purchase',
      });
    });

    await waitFor(() => {
      expect(getByText('Purchase cancelled by user')).toBeTruthy();
    });
  });

  // Android discount offers tests (cross-platform)
  describe('Android Discount Offers (Cross-platform)', () => {
    it('displays product details modal with discount offers', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Product Details')).toBeTruthy();
        expect(getByText('Discount Offers (2)')).toBeTruthy();
      });
    });

    it('displays offer with percentage discount', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('20% off')).toBeTruthy();
      });
    });

    it('displays offer with full price when discounted', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Full Price (micros):')).toBeTruthy();
        expect(getByText('990000')).toBeTruthy();
      });
    });

    it('displays limited quantity info', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Limited Quantity:')).toBeTruthy();
        expect(getByText('45 / 100 remaining')).toBeTruthy();
      });
    });

    it('displays valid time window', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Valid Window:')).toBeTruthy();
      });
    });

    it('displays offer tags', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getAllByText('Tags:').length).toBeGreaterThanOrEqual(1);
        expect(getByText('sale, limited')).toBeTruthy();
      });
    });

    it('displays preorder details', async () => {
      mockIapState({products: [androidProductWithPreorder]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Pre-order Release:')).toBeTruthy();
      });
    });

    it('displays rental details', async () => {
      mockIapState({products: [androidProductWithRental]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Rental:')).toBeTruthy();
        expect(getByText('Period: P30D')).toBeTruthy();
      });
    });

    it('displays formatted discount amount', async () => {
      mockIapState({products: [androidProductWithAbsoluteDiscount]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('$1.00')).toBeTruthy();
      });
    });

    it('closes modal when close button pressed', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText, queryByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Product Details')).toBeTruthy();
      });

      // Close modal
      fireEvent.press(getByText('Close'));

      await waitFor(() => {
        expect(queryByText('Discount Offers (2)')).toBeNull();
      });
    });

    it('displays offer ID when present', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('base-offer')).toBeTruthy();
        expect(getByText('discount-offer')).toBeTruthy();
      });
    });
  });
});
