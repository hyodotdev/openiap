import {initConnection} from 'capacitor-iap';
import {getReceiptPurchaseFlow} from './purchaseFlow';

/** Resolves once the store is connected; screens wait for it before store calls. */
export const connection: Promise<void> = initConnection().then((connected) => {
  if (!connected) throw new Error('initConnection returned false');
});

// Recover purchases left unfinished by an earlier session.
connection
  .then(() => getReceiptPurchaseFlow().recoverPurchases())
  .catch((error: unknown) => console.warn('Store connection failed:', error));
