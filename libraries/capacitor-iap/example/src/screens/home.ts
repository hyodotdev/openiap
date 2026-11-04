import {Capacitor} from '@capacitor/core';
import {getStorefront} from 'capacitor-iap';
import {h} from '../utils/ui';
import {connection} from '../utils/connection';

const ITEMS: [route: string, label: string, description: string][] = [
  ['all-products', 'All Products', 'Every in-app product and subscription'],
  ['purchase-flow', 'Purchase Flow', 'Buy consumables and non-consumables'],
  ['subscription-flow', 'Subscription Flow', 'Subscribe, upgrade, and manage'],
  ['available-purchases', 'Available Purchases', 'Owned items and restore'],
  ['offer-code', 'Offer Code', 'Redeem a promo or offer code'],
  [
    'alternative-billing',
    'Alternative Billing',
    'Android billing programs and iOS external purchase',
  ],
  [
    'app-ownership',
    'App Ownership',
    'Evidence that this install came from its store',
  ],
];

export function renderHome(container: HTMLElement): () => void {
  const storefront = h(
    'p',
    {class: 'muted'},
    `Platform: ${Capacitor.getPlatform()}`,
  );
  container.append(
    storefront,
    ...ITEMS.map(([route, label, description]) =>
      h(
        'a',
        {class: 'card', href: `#/${route}`},
        h('h2', {}, label),
        h('span', {class: 'muted'}, description),
      ),
    ),
  );
  connection
    .then(() => getStorefront())
    .then((code) => (storefront.textContent += ` · Storefront: ${code}`))
    .catch(() => {});
  return () => {};
}
