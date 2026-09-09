import { signal } from '@preact/signals-react';

export const CODE_LANGUAGES = [
  'swift',
  'kotlin',
  'typescript',
  'dart',
  'csharp',
  'kmp',
  'gdscript',
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const DEFAULT_CODE_LANGUAGE: CodeLanguage = 'swift';
const CODE_LANGUAGE_STORAGE_KEY = 'openiap-docs-code-language';

const getStoredCodeLanguage = (): CodeLanguage => {
  const isCodeLanguage = (value: string | null): value is CodeLanguage =>
    CODE_LANGUAGES.some((language) => language === value);

  if (typeof window === 'undefined') {
    return DEFAULT_CODE_LANGUAGE;
  }

  try {
    const storedLanguage = window.localStorage.getItem(
      CODE_LANGUAGE_STORAGE_KEY
    );
    return isCodeLanguage(storedLanguage)
      ? storedLanguage
      : DEFAULT_CODE_LANGUAGE;
  } catch {
    return DEFAULT_CODE_LANGUAGE;
  }
};

export const codeLanguageSignal = signal<CodeLanguage>(getStoredCodeLanguage());

export const setCodeLanguage = (language: CodeLanguage): void => {
  codeLanguageSignal.value = language;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CODE_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Keep the preference in memory when browser storage is unavailable.
  }
};

// Search Modal state - use boolean directly
export const searchModalSignal = signal(false);

export const openSearchModal = () => {
  searchModalSignal.value = true;
};

export const closeSearchModal = () => {
  searchModalSignal.value = false;
};

export interface CommerceArchitecturePart {
  label: string;
  title: string;
  description: string;
  reference: string;
  referenceLabel: string;
  step?: number;
  packageName?: string;
}

export interface CommerceArchitectureModalState {
  part: CommerceArchitecturePart;
  onShowExample: (step: number) => void;
  onClose: () => void;
}

export const commerceArchitectureModalSignal =
  signal<CommerceArchitectureModalState | null>(null);

export const subscribeToCommerceArchitecture = (
  onStoreChange: () => void
): (() => void) => commerceArchitectureModalSignal.subscribe(onStoreChange);

export const getCommerceArchitectureSnapshot =
  (): CommerceArchitectureModalState | null =>
    commerceArchitectureModalSignal.value;

export const openCommerceArchitectureModal = (
  modal: CommerceArchitectureModalState
): void => {
  commerceArchitectureModalSignal.value = modal;
};

export const closeCommerceArchitectureModal = (): void => {
  commerceArchitectureModalSignal.value = null;
};
