import { StoreOutcome } from './fake-store.mjs';

/**
 * Reference OpenIAP implementation over a FakeStore.
 *
 * Its purpose is to make the behavior spec executable and to show adapter
 * authors what "conforming" looks like. It is not a shipped SDK, and a passing
 * run here says nothing about react-native-iap, expo-iap, or the native
 * packages — those must supply their own adapters over their own code.
 */

export class ConformanceError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.code = code;
  }
}

const OUTCOME_TO_ERROR_CODE = {
  [StoreOutcome.UserCancelled]: 'user-cancelled',
  [StoreOutcome.AlreadyOwned]: 'already-owned',
  [StoreOutcome.Unknown]: 'sku-not-found',
};

const STORES_WITH_ALREADY_OWNED = new Set(['Google', 'Amazon', 'Horizon']);

export class ReferenceImplementation {
  /** @param {import('./fake-store.mjs').FakeStore} store */
  constructor(store, { iapStore = 'Google' } = {}) {
    this.store = store;
    this.iapStore = iapStore;
    this.purchaseUpdatedListeners = [];
    this.purchaseErrorListeners = [];
  }

  onPurchaseUpdated(listener) {
    this.purchaseUpdatedListeners.push(listener);
    return () => {
      this.purchaseUpdatedListeners = this.purchaseUpdatedListeners.filter((item) => item !== listener);
    };
  }

  onPurchaseError(listener) {
    this.purchaseErrorListeners.push(listener);
    return () => {
      this.purchaseErrorListeners = this.purchaseErrorListeners.filter((item) => item !== listener);
    };
  }

  async fetchProducts({ skus, type }) {
    if (!skus || skus.length === 0) {
      throw new ConformanceError('empty-sku-list', 'fetchProducts requires at least one sku');
    }
    return this.store.queryProducts(skus, type).map((entry) => ({
      id: entry.sku,
      title: entry.title,
      currency: entry.currency,
      displayPrice: entry.displayPrice,
      type: entry.type,
    }));
  }

  async requestPurchase({ sku }) {
    const result = this.store.purchase(sku);

    if (result.outcome === StoreOutcome.Success) {
      const purchase = this.#toPurchase(result.purchase);
      this.purchaseUpdatedListeners.forEach((listener) => listener(purchase));
      return purchase;
    }

    if (result.outcome === StoreOutcome.Pending) {
      const purchase = this.#toPurchase(result.purchase);
      this.purchaseUpdatedListeners.forEach((listener) => listener(purchase));
      return purchase;
    }

    const mappedCode = OUTCOME_TO_ERROR_CODE[result.outcome] ?? 'unknown';
    const code =
      mappedCode === 'already-owned' && !STORES_WITH_ALREADY_OWNED.has(this.iapStore)
        ? 'unknown'
        : mappedCode;
    const error = new ConformanceError(code, `purchase failed: ${result.outcome}`);
    this.purchaseErrorListeners.forEach((listener) => listener(error));
    throw error;
  }

  async finishTransaction({ purchaseToken, isConsumable = false }) {
    this.store.finish(purchaseToken, { consume: isConsumable });
  }

  /**
   * Returns a platform-shaped verification result. Every variant carries
   * isValid so callers never have to branch on the concrete shape.
   */
  async verifyPurchase({ purchaseToken }) {
    const record = this.store.owned.get(purchaseToken);
    return {
      isValid: record?.state === 'purchased',
      productId: record?.sku,
      store: this.iapStore,
    };
  }

  async getAvailablePurchases() {
    return this.store.queryPurchases().map((record) => this.#toPurchase(record));
  }

  async getUnfinishedPurchaseTokens() {
    return this.store.unfinishedTokens();
  }

  async getActiveSubscriptions() {
    return this.store
      .queryPurchases()
      .filter((record) => record.type === 'subs')
      .map((record) => ({
        productId: record.sku,
        currentPlanId: record.sku,
        purchaseToken: record.token,
        isActive: record.state === 'purchased',
      }));
  }

  async hasActiveSubscriptions() {
    return (await this.getActiveSubscriptions()).some((subscription) => subscription.isActive);
  }

  /** Documented no-op for an operation unsupported by this fake store. */
  async openUnsupportedOperation() {
    return false;
  }

  #toPurchase(record) {
    return {
      id: record.token,
      productId: record.sku,
      purchaseToken: record.token,
      purchaseState: record.state === 'purchased' ? 'Purchased' : 'Pending',
      store: this.iapStore,
    };
  }
}
