/** The no-backend purchase flow sample, shared by Quickstart and Purchase flow. */
export const IAPKIT_FLOW_SAMPLE = `const flow = createPurchaseFlow({
  confirmWithBackend: confirmWithIapkit({
    apiKey: 'openiap-kit_pk_<your-publishable-key>',
    grant: async (purchase, {isConsumable}) => {
      if (isConsumable) await wallet.creditOnce(purchase.id, purchase.productId);
    },
  }),
  isConsumable: (productId) => CONSUMABLE_IDS.includes(productId),
});`;
