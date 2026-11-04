import {renderAllProducts} from './screens/allProducts';
import {renderAlternativeBilling} from './screens/alternativeBilling';
import {renderAppOwnership} from './screens/appOwnership';
import {renderAvailablePurchases} from './screens/availablePurchases';
import {renderHome} from './screens/home';
import {renderOfferCode} from './screens/offerCode';
import {renderPurchaseFlow} from './screens/purchaseFlow';
import {renderSubscriptionFlow} from './screens/subscriptionFlow';
import './utils/connection';

/** A screen renders into the container and returns its cleanup. */
export type Screen = (container: HTMLElement) => () => void;

export const routes: Record<string, {title: string; render: Screen}> = {
  'all-products': {title: 'All Products', render: renderAllProducts},
  'purchase-flow': {title: 'Purchase Flow', render: renderPurchaseFlow},
  'subscription-flow': {
    title: 'Subscription Flow',
    render: renderSubscriptionFlow,
  },
  'available-purchases': {
    title: 'Available Purchases',
    render: renderAvailablePurchases,
  },
  'offer-code': {title: 'Offer Code', render: renderOfferCode},
  'alternative-billing': {
    title: 'Alternative Billing',
    render: renderAlternativeBilling,
  },
  'app-ownership': {title: 'App Ownership', render: renderAppOwnership},
};

const container = document.getElementById('app')!;
const title = document.getElementById('title')!;
const back = document.getElementById('back')!;
let cleanup: () => void = () => {};

function navigate(): void {
  cleanup();
  container.replaceChildren();
  const route = routes[location.hash.replace(/^#\/?/, '')];
  title.textContent = route?.title ?? 'capacitor-iap';
  back.hidden = !route;
  cleanup = (route?.render ?? renderHome)(container);
}

window.addEventListener('hashchange', navigate);
navigate();
