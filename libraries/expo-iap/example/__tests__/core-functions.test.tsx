import * as ExpoIap from 'expo-iap';

describe('Core Functions Tests', () => {
  describe('Core Module Exports', () => {
    it('should export initConnection function', () => {
      expect(ExpoIap.initConnection).toBeDefined();
      expect(typeof ExpoIap.initConnection).toBe('function');
    });

    it('should export endConnection function', () => {
      expect(ExpoIap.endConnection).toBeDefined();
      expect(typeof ExpoIap.endConnection).toBe('function');
    });

    it('should export fetchProducts function', () => {
      expect(ExpoIap.fetchProducts).toBeDefined();
      expect(typeof ExpoIap.fetchProducts).toBe('function');
    });

    // v3: legacy helpers removed

    it('should export requestPurchase function', () => {
      expect(ExpoIap.requestPurchase).toBeDefined();
      expect(typeof ExpoIap.requestPurchase).toBe('function');
    });

    it('should export finishTransaction function', () => {
      expect(ExpoIap.finishTransaction).toBeDefined();
      expect(typeof ExpoIap.finishTransaction).toBe('function');
    });

    it('should export getAvailablePurchases function', () => {
      expect(ExpoIap.getAvailablePurchases).toBeDefined();
      expect(typeof ExpoIap.getAvailablePurchases).toBe('function');
    });

    it('should export getStorefront function', () => {
      expect(ExpoIap.getStorefront).toBeDefined();
      expect(typeof ExpoIap.getStorefront).toBe('function');
    });

    it('should export openRedeemOfferCode function', () => {
      expect(ExpoIap.openRedeemOfferCode).toBeDefined();
      expect(typeof ExpoIap.openRedeemOfferCode).toBe('function');
    });
  });

  describe('Event Listeners', () => {
    it('should export purchaseUpdatedListener', () => {
      expect(ExpoIap.purchaseUpdatedListener).toBeDefined();
      expect(typeof ExpoIap.purchaseUpdatedListener).toBe('function');
    });

    it('should export purchaseErrorListener', () => {
      expect(ExpoIap.purchaseErrorListener).toBeDefined();
      expect(typeof ExpoIap.purchaseErrorListener).toBe('function');
    });
  });

  describe('Hook', () => {
    it('should export useIAP hook', () => {
      expect(ExpoIap.useIAP).toBeDefined();
      expect(typeof ExpoIap.useIAP).toBe('function');
    });
  });

  describe('Android Functions', () => {
    it('should export deepLinkToSubscriptionsAndroid', () => {
      expect(ExpoIap.deepLinkToSubscriptionsAndroid).toBeDefined();
      expect(typeof ExpoIap.deepLinkToSubscriptionsAndroid).toBe('function');
    });

    it('should export verifyPurchase', () => {
      expect(ExpoIap.verifyPurchase).toBeDefined();
      expect(typeof ExpoIap.verifyPurchase).toBe('function');
    });

    it('should export acknowledgePurchaseAndroid', () => {
      expect(ExpoIap.acknowledgePurchaseAndroid).toBeDefined();
      expect(typeof ExpoIap.acknowledgePurchaseAndroid).toBe('function');
    });

    it('should export openRedeemOfferCodeAndroid', () => {
      expect(ExpoIap.openRedeemOfferCodeAndroid).toBeDefined();
      expect(typeof ExpoIap.openRedeemOfferCodeAndroid).toBe('function');
    });

    it('should export Billing Programs Android functions', () => {
      expect(ExpoIap.isBillingProgramAvailableAndroid).toBeDefined();
      expect(typeof ExpoIap.isBillingProgramAvailableAndroid).toBe('function');
      expect(ExpoIap.launchExternalLinkAndroid).toBeDefined();
      expect(typeof ExpoIap.launchExternalLinkAndroid).toBe('function');
      expect(ExpoIap.createBillingProgramReportingDetailsAndroid).toBeDefined();
      expect(typeof ExpoIap.createBillingProgramReportingDetailsAndroid).toBe(
        'function',
      );
    });
  });

  describe('Enums and Constants', () => {
    it('should export OpenIapEvent enum', () => {
      expect(ExpoIap.OpenIapEvent).toBeDefined();
      expect(ExpoIap.OpenIapEvent.PurchaseUpdated).toBe('purchase-updated');
      expect(ExpoIap.OpenIapEvent.PurchaseError).toBe('purchase-error');
    });

    it('should export ErrorCode enum', () => {
      expect(ExpoIap.ErrorCode).toBeDefined();
      expect(typeof ExpoIap.ErrorCode).toBe('object');
    });
  });

  describe('Type Guards', () => {
    it('should export isProductIOS function', () => {
      expect(ExpoIap.isProductIOS).toBeDefined();
      expect(typeof ExpoIap.isProductIOS).toBe('function');
    });

    it('should export isProductAndroid function', () => {
      expect(ExpoIap.isProductAndroid).toBeDefined();
      expect(typeof ExpoIap.isProductAndroid).toBe('function');
    });
  });
});
