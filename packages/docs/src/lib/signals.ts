import { signal } from '@preact/signals-react';

// Search Modal state - use boolean directly
export const searchModalSignal = signal(false);

export const openSearchModal = () => {
  searchModalSignal.value = true;
};

export const closeSearchModal = () => {
  searchModalSignal.value = false;
};
