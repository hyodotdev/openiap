declare module '@amazon-devices/keplerscript-appstore-iap-lib' {
  export const PurchasingService: {
    getProductData(request: {skus: string[]}): Promise<unknown>;
    getPurchaseUpdates(request: {reset: boolean}): Promise<unknown>;
    getUserData(request: Record<string, never>): Promise<unknown>;
    notifyFulfillment(request: {
      fulfillmentResult: number;
      receiptId: string;
    }): Promise<unknown>;
    purchase(request: {sku: string}): Promise<unknown>;
  };
}
