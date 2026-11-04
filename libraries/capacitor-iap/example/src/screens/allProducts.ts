import {fetchProducts} from 'capacitor-iap';
import {PRODUCT_IDS, SUBSCRIPTION_PRODUCT_IDS} from '../utils/constants';
import {actionButton, card, errorText, h, statusLine} from '../utils/ui';
import {connection} from '../utils/connection';

/** Every in-app product and subscription in one `all` query. */
export function renderAllProducts(container: HTMLElement): () => void {
  const list = h('div', {class: 'list'});
  const status = statusLine();

  const load = async () => {
    status.set('Loading products…');
    try {
      const products =
        (await fetchProducts({
          skus: [...PRODUCT_IDS, ...SUBSCRIPTION_PRODUCT_IDS],
          type: 'all',
        })) ?? [];
      list.replaceChildren(
        ...products.map((product) =>
          card(
            product.title,
            h('span', {class: 'muted'}, `${product.id} · ${product.type}`),
            h('strong', {}, product.displayPrice),
            h('span', {}, product.description),
          ),
        ),
      );
      status.set(`${products.length} products loaded`);
    } catch (error) {
      status.set(errorText(error));
    }
  };

  container.append(actionButton('Reload products', load), status.element, list);
  void connection.then(load, (error: unknown) => status.set(errorText(error)));
  return () => {};
}
