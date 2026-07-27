/* eslint-disable import/first */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

// Minimal Nitro mock used by index/useIAP under the hood
const mockIap: any = {
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),
  fetchProducts: jest.fn(async () => []),
  getAvailablePurchases: jest.fn(async () => []),
  finishTransaction: jest.fn(async () => true),
  addPurchaseUpdatedListener: jest.fn(),
  removePurchaseUpdatedListener: jest.fn(),
  addPurchaseErrorListener: jest.fn(),
  removePurchaseErrorListener: jest.fn(),
  addPromotedProductListenerIOS: jest.fn(),
  removePromotedProductListenerIOS: jest.fn(),
  addSubscriptionBillingIssueListener: jest.fn(),
  removeSubscriptionBillingIssueListener: jest.fn(),
  openRedeemOfferCodeAndroid: jest.fn(async () => true),
};

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => mockIap),
  },
}));

// Mock Android platform
jest.mock('react-native', () => ({
  Platform: {OS: 'android', select: (obj: any) => obj.android},
}));

// Import after mocks
import * as IAP from '../../index';
import {useIAP} from '../../hooks/useIAP';
import type {DeveloperProvidedBillingDetailsAndroid} from '../../types';

describe('hooks/useIAP Android', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(IAP, 'initConnection').mockResolvedValue(true as any);
    jest.spyOn(IAP, 'getAvailablePurchases').mockResolvedValue([] as any);
    jest.spyOn(IAP, 'getActiveSubscriptions').mockResolvedValue([] as any);
    jest.spyOn(IAP, 'hasActiveSubscriptions').mockResolvedValue(false as any);
    jest.spyOn(IAP, 'finishTransaction').mockResolvedValue(undefined as any);
    jest.spyOn(IAP, 'purchaseUpdatedListener').mockImplementation(() => {
      return {remove: jest.fn()};
    });
    jest.spyOn(IAP, 'purchaseErrorListener').mockImplementation(() => {
      return {remove: jest.fn()};
    });
    // promotedProductListenerIOS won't be called on Android but mock anyway
    jest
      .spyOn(IAP, 'promotedProductListenerIOS')
      .mockImplementation(() => ({remove: jest.fn()}));
  });

  it('passes enableBillingProgramAndroid config to initConnection on Android', async () => {
    let api: any;
    const Harness = () => {
      api = useIAP({
        enableBillingProgramAndroid: 'user-choice-billing',
      });
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });

    // Allow effects to run and connection to settle
    await act(async () => {});
    expect(api.connected).toBe(true);

    // Verify initConnection was called with the billing program config
    expect(IAP.initConnection).toHaveBeenCalledWith({
      enableBillingProgramAndroid: 'user-choice-billing',
    });
  });

  it('passes the Billing Choice renderer to initConnection on Android', async () => {
    let api: any;
    const Harness = () => {
      api = useIAP({
        enableBillingProgramAndroid: 'billing-choice',
        billingChoiceScreenTypeAndroid: 'developer-rendered',
      });
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    expect(api.connected).toBe(true);
    expect(IAP.initConnection).toHaveBeenCalledWith({
      enableBillingProgramAndroid: 'billing-choice',
      billingChoiceScreenTypeAndroid: 'developer-rendered',
    });
  });

  it('registers userChoiceBillingAndroid listener when callback is provided', async () => {
    const mockUserChoiceBillingListener = jest
      .spyOn(IAP, 'userChoiceBillingListenerAndroid' as any)
      .mockImplementation(() => ({remove: jest.fn()}));

    let api: any;
    const onUserChoiceBilling = jest.fn();
    const Harness = () => {
      api = useIAP({
        onUserChoiceBillingAndroid: onUserChoiceBilling,
      });
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    expect(api.connected).toBe(true);
    expect(mockUserChoiceBillingListener).toHaveBeenCalled();
  });

  it('forwards developer-provided Billing Choice events from the hook', async () => {
    let listener:
      | Parameters<typeof IAP.developerProvidedBillingListenerAndroid>[0]
      | undefined;
    jest
      .spyOn(IAP, 'developerProvidedBillingListenerAndroid')
      .mockImplementation((callback) => {
        listener = callback;
        return {remove: jest.fn()};
      });

    const onDeveloperProvidedBillingAndroid = jest.fn();
    const Harness = () => {
      useIAP({onDeveloperProvidedBillingAndroid});
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    const details: DeveloperProvidedBillingDetailsAndroid = {
      externalTransactionToken: 'external-token',
      products: [{id: 'premium', type: 'in-app'}],
    };
    listener?.(details);

    expect(onDeveloperProvidedBillingAndroid).toHaveBeenCalledWith(details);
  });

  it('exposes all Billing Choice APIs through the hook', async () => {
    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    expect(api.getBillingChoiceInfoAndroid).toBe(
      IAP.getBillingChoiceInfoAndroid,
    );
    expect(api.isBillingProgramAvailableAndroid).toBe(
      IAP.isBillingProgramAvailableAndroid,
    );
    expect(api.createBillingProgramReportingDetailsAndroid).toBe(
      IAP.createBillingProgramReportingDetailsAndroid,
    );
    expect(api.launchExternalLinkAndroid).toBe(IAP.launchExternalLinkAndroid);
    expect(api.showBillingProgramInformationDialogAndroid).toBe(
      IAP.showBillingProgramInformationDialogAndroid,
    );
    expect(api.showInAppMessagesAndroid).toBe(IAP.showInAppMessagesAndroid);
  });

  it('exposes openRedeemOfferCodeAndroid through the hook on Android', async () => {
    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    expect(api.openRedeemOfferCodeAndroid).toBe(IAP.openRedeemOfferCodeAndroid);
  });

  it('reconnect uses Android billing config', async () => {
    let api: any;
    const Harness = () => {
      api = useIAP({
        enableBillingProgramAndroid: 'user-choice-billing',
      });
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    (IAP.initConnection as jest.Mock).mockClear();
    jest.spyOn(IAP, 'initConnection').mockResolvedValueOnce(true as any);

    let result: boolean | undefined;
    await act(async () => {
      result = await api.reconnect();
    });

    expect(result).toBe(true);
    expect(IAP.initConnection).toHaveBeenCalledWith({
      enableBillingProgramAndroid: 'user-choice-billing',
    });
  });
});
