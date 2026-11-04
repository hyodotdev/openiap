type Child = Node | string | null | undefined | false;

/** Creates an element with attributes and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Partial<Record<string, string>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) element.setAttribute(name, value);
  }
  for (const child of children) {
    if (child) element.append(child);
  }
  return element;
}

/** A button that disables itself while its action runs. */
export function actionButton(
  label: string,
  action: () => Promise<void> | void,
): HTMLButtonElement {
  const button = h('button', {type: 'button'}, label);
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await action();
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

export function card(title: string, ...children: Child[]): HTMLElement {
  return h('section', {class: 'card'}, h('h2', {}, title), ...children);
}

/** A text block screens write their latest result into. */
export function statusLine(): {
  element: HTMLElement;
  set: (text: string) => void;
} {
  const element = h('pre', {id: 'status', class: 'muted'});
  return {element, set: (text) => (element.textContent = text)};
}

export function errorText(error: unknown): string {
  if (error && typeof error === 'object') {
    const {code, message} = error as {code?: unknown; message?: unknown};
    const text = typeof message === 'string' ? message : String(error);
    return typeof code === 'string' ? `${code}: ${text}` : text;
  }
  return String(error);
}
