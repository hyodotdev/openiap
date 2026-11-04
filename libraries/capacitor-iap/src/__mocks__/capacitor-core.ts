/**
 * Jest stand-in for @capacitor/core. Tests pick the platform with
 * `setPlatform`, stub native methods on `nativePlugin`, and fire native events
 * with `emitNativeEvent`.
 */
type Listener = (payload: unknown) => void;

let platform = 'android';
const listeners = new Map<string, Set<Listener>>();
const retained = new Map<string, unknown[]>();

export const setPlatform = (value: string): void => {
  platform = value;
};

export const Capacitor = {
  getPlatform: () => platform,
  isNativePlatform: () => platform === 'ios' || platform === 'android',
};

/** `retainUntilConsumed` holds the event for the first listener, as Capacitor does. */
export const emitNativeEvent = (
  eventName: string,
  payload: unknown,
  {retainUntilConsumed = false} = {},
): void => {
  const current = listeners.get(eventName);
  if (!current?.size) {
    if (retainUntilConsumed) {
      retained.set(eventName, [...(retained.get(eventName) ?? []), payload]);
    }
    return;
  }
  current.forEach((listener) => listener(payload));
};

export const listenerCount = (eventName: string): number =>
  listeners.get(eventName)?.size ?? 0;

export const nativePlugin: Record<string, jest.Mock> = {
  addListener: jest.fn(async (eventName: string, listener: Listener) => {
    const set = listeners.get(eventName) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(eventName, set);
    const held = retained.get(eventName);
    retained.delete(eventName);
    held?.forEach((payload) => listener(payload));
    return {remove: async () => void set.delete(listener)};
  }),
  setPurchaseUpdatedListenerOptions: jest.fn(async () => ({value: true})),
  claimFirstPurchaseNotice: jest.fn(async () => ({value: false})),
};

/**
 * Clears stubbed methods. Native listeners stay attached, as they do for the
 * life of an app, because the SDK attaches one per event and keeps it.
 */
export const resetNativePlugin = (): void => {
  for (const key of Object.keys(nativePlugin)) {
    if (
      ![
        'addListener',
        'setPurchaseUpdatedListenerOptions',
        'claimFirstPurchaseNotice',
      ].includes(key)
    ) {
      delete nativePlugin[key];
    }
  }
  nativePlugin.addListener.mockClear();
  nativePlugin.setPurchaseUpdatedListenerOptions.mockClear();
  nativePlugin.claimFirstPurchaseNotice.mockClear();
};

/** Native rejection as Capacitor delivers it: code plus the OpenIAP payload in data. */
export const nativeRejection = (
  code: string,
  message: string,
  data: Record<string, unknown> = {},
): Error =>
  Object.assign(new Error(message), {code, data: {code, message, ...data}});

// An unstubbed method throws a plain Error, which the SDK never maps to a
// PurchaseError, so a test that reaches it fails instead of passing by accident.
export const registerPlugin = () =>
  new Proxy(
    {},
    {
      get: (_target, method: string) => {
        const implementation = nativePlugin[method];
        if (!implementation) {
          return () => {
            throw new Error(`Native method ${method} is not stubbed`);
          };
        }
        return implementation;
      },
    },
  );
