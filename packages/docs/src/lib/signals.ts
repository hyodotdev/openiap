import { signal } from '@preact/signals-react';

// Search Modal state signal (object-based pattern for extensibility)
export const searchModalSignal = signal({
  isOpen: false,
});

export const openSearchModal = () => {
  searchModalSignal.value = { isOpen: true };
};

export const closeSearchModal = () => {
  searchModalSignal.value = { isOpen: false };
};
