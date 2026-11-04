import {Capacitor} from '@capacitor/core';
import {
  getAvailablePurchases,
  getPendingTransactionsIOS,
  restorePurchases,
  type Purchase,
} from 'capacitor-iap';
import {
  describePurchaseOutcome,
  getReceiptPurchaseFlow,
} from '../utils/purchaseFlow';
import {actionButton, card, errorText, h, statusLine} from '../utils/ui';
import {connection} from '../utils/connection';

const purchaseCard = (purchase: Purchase) =>
  card(
    purchase.productId,
    h(
      'span',
      {class: 'muted'},
      `${purchase.storeId} · ${purchase.purchaseState}`,
    ),
    h(
      'span',
      {class: 'muted'},
      new Date(purchase.transactionDate).toLocaleString(),
    ),
  );

/** Owned purchases, pending iOS transactions, and restore. */
export function renderAvailablePurchases(container: HTMLElement): () => void {
  const status = statusLine();
  const owned = h('div', {class: 'list'});
  const pending = h('div', {class: 'list'});

  const refresh = async () => {
    try {
      const purchases = await getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
      });
      owned.replaceChildren(
        ...(purchases.length
          ? purchases.map(purchaseCard)
          : [h('span', {class: 'muted'}, 'Nothing owned')]),
      );
      if (Capacitor.getPlatform() === 'ios') {
        pending.replaceChildren(
          ...(await getPendingTransactionsIOS()).map(purchaseCard),
        );
      }
    } catch (error) {
      status.set(errorText(error));
    }
  };

  // Restore asks the store, then confirms finished purchases again.
  const restore = async () => {
    status.set('Restoring…');
    try {
      await restorePurchases();
      const outcomes = await getReceiptPurchaseFlow().recoverPurchases({
        includeFinished: true,
      });
      status.set(
        outcomes.length
          ? outcomes
              .map(
                ({purchase, status: outcome}) =>
                  `${purchase.productId}: ${describePurchaseOutcome(outcome)}`,
              )
              .join('\n')
          : 'Nothing to restore',
      );
      await refresh();
    } catch (error) {
      status.set(errorText(error));
    }
  };

  container.append(
    actionButton('Restore purchases', restore),
    status.element,
    card('Available purchases', owned),
  );
  if (Capacitor.getPlatform() === 'ios') {
    container.append(card('Pending transactions (iOS)', pending));
  }
  void connection.then(refresh, (error: unknown) =>
    status.set(errorText(error)),
  );
  return () => {};
}
