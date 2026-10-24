import type {PurchaseFlowPurchase} from '../purchase-flow-core';
import * as legacy from '../purchase-flow';

it('keeps the retained compatibility facade callable without native bindings', async () => {
  const purchase: PurchaseFlowPurchase = {
    id: 'tx',
    productId: 'premium',
    store: 'apple',
    storeId: 'apple',
    purchaseToken: 'synthetic-jws',
    purchaseState: 'purchased',
  };
  const options: legacy.IapkitConfirmationOptions = {};
  const result: legacy.IapkitVerificationResult = {
    iapkit: {
      store: 'apple',
      storeId: 'apple',
      isValid: true,
      state: 'entitled',
      productId: 'premium',
    },
  };
  const props: legacy.IapkitVerificationProps =
    legacy.toIapkitVerificationProps(purchase, options);
  expect(props).toEqual({
    provider: 'iapkit',
    iapkit: {apple: {jws: 'synthetic-jws'}},
  });
  const expected = {status: 'entitled', alreadyGranted: false};
  expect(
    legacy.readIapkitVerification(result, purchase, {isConsumable: false}),
  ).toEqual(expected);
  await expect(
    legacy.createIapkitConfirmation(async () => result, options)(purchase, {
      isConsumable: false,
    }),
  ).resolves.toEqual(expected);
  await expect(
    legacy.createDeviceConfirmationIOS(async () => [purchase])(purchase, {
      isConsumable: false,
    }),
  ).resolves.toEqual(expected);
});
