import {registerPlugin} from '@capacitor/core';
import type {CapacitorIapNativePlugin} from './definitions';

// No web implementation: the wrappers in index.ts reject on web with an
// unsupported-platform error before reaching the bridge.
export const CapacitorIap =
  registerPlugin<CapacitorIapNativePlugin>('CapacitorIap');
