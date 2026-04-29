import { signal } from "@preact/signals-react";
import type { SubscriptionPlanId } from "@/convex";

// Auth Modal State
const SELECTED_PLAN_STORAGE_KEY = "openiap-kit:selected-plan";

function storeSelectedTier(tier: SubscriptionPlanId | null) {
  if (typeof window === "undefined") return;

  if (tier) {
    window.localStorage.setItem(SELECTED_PLAN_STORAGE_KEY, tier);
  } else {
    window.localStorage.removeItem(SELECTED_PLAN_STORAGE_KEY);
  }
}

function readStoredTier(): SubscriptionPlanId | null {
  if (typeof window === "undefined") return null;

  const tier = window.localStorage.getItem(SELECTED_PLAN_STORAGE_KEY);
  if (tier === "developer" || tier === "pro" || tier === "enterprise") {
    return tier;
  }
  return null;
}

type AuthModalState = {
  isOpen: boolean;
  selectedTier: SubscriptionPlanId | null;
};

export const authModalSignal = signal<AuthModalState>({
  isOpen: false,
  selectedTier: null,
});

export const openAuthModal = (tier?: SubscriptionPlanId) => {
  const selectedTier = tier || readStoredTier();
  storeSelectedTier(selectedTier ?? null);
  authModalSignal.value = { isOpen: true, selectedTier: selectedTier ?? null };
};

export const closeAuthModal = () => {
  authModalSignal.value = {
    isOpen: false,
    selectedTier: authModalSignal.value.selectedTier,
  };
};

// Hook to use auth modal state
export const useAuthModal = () => {
  return authModalSignal.value;
};

export const getPersistedPlanSelection = (): SubscriptionPlanId | null => {
  return authModalSignal.value.selectedTier ?? readStoredTier();
};

export const clearPersistedPlanSelection = () => {
  storeSelectedTier(null);
  authModalSignal.value = {
    isOpen: authModalSignal.value.isOpen,
    selectedTier: null,
  };
};
