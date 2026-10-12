// Candidates for keyboard focus; isTabbable keeps the ones Tab reaches.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]';

type DrawerKeyEvent = Pick<
  KeyboardEvent,
  'key' | 'shiftKey' | 'defaultPrevented' | 'preventDefault'
>;
type DrawerRoot = Pick<HTMLElement, 'querySelectorAll' | 'contains'>;

/** In the tab order and rendered, so collapsed menu links and closed sections are skipped. */
function isTabbable(element: HTMLElement): boolean {
  return element.tabIndex >= 0 && element.getClientRects().length > 0;
}

/**
 * Escape closes an open drawer and Tab cycles inside it. Keys another handler
 * already took, or pressed in an open dialog above the drawer such as the
 * search modal, are left alone.
 */
export function handleDrawerKey(
  event: DrawerKeyEvent,
  root: DrawerRoot | null,
  active: Element | null,
  close: () => void
): void {
  if (event.defaultPrevented || active?.closest('dialog[open]')) return;
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key !== 'Tab' || !root) return;

  const tabbable = Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(isTabbable);
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  if (!first) return;
  const edge = event.shiftKey ? first : last;
  const target =
    active === edge
      ? event.shiftKey
        ? last
        : first
      : root.contains(active)
        ? null
        : first;
  if (!target) return;
  event.preventDefault();
  target.focus();
}
