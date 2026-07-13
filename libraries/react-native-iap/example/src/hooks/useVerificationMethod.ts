import {useState, useCallback, useRef, useEffect} from 'react';
import {Platform, ActionSheetIOS} from 'react-native';

export type VerificationMethod =
  | 'ignore'
  | 'local'
  | 'iapkit-localhost'
  | 'iapkit';

export function getDefaultVerificationMethod(
  iapkitApiKey?: string | null,
  iapkitBaseUrl?: string | null,
): VerificationMethod {
  if (!iapkitApiKey?.trim()) {
    return 'ignore';
  }

  return iapkitBaseUrl?.trim() ? 'iapkit-localhost' : 'iapkit';
}

interface UseVerificationMethodReturn {
  verificationMethod: VerificationMethod;
  verificationMethodRef: React.MutableRefObject<VerificationMethod>;
  setVerificationMethod: React.Dispatch<
    React.SetStateAction<VerificationMethod>
  >;
  verificationMethodSelectorVisible: boolean;
  hideVerificationMethodSelector: () => void;
  selectVerificationMethod: (method: VerificationMethod) => void;
  showVerificationMethodSelector: () => void;
  getVerificationMethodLabel: () => string;
}

/**
 * Hook to manage verification method selection with platform-specific UI
 */
export function useVerificationMethod(
  initialMethod: VerificationMethod = 'ignore',
): UseVerificationMethodReturn {
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod>(initialMethod);
  const [verificationMethodSelectorVisible, setSelectorVisible] =
    useState(false);
  const verificationMethodRef = useRef<VerificationMethod>(verificationMethod);

  // Keep ref in sync with state
  useEffect(() => {
    verificationMethodRef.current = verificationMethod;
  }, [verificationMethod]);

  const hideVerificationMethodSelector = useCallback(() => {
    setSelectorVisible(false);
  }, []);

  const selectVerificationMethod = useCallback((method: VerificationMethod) => {
    setVerificationMethod(method);
    setSelectorVisible(false);
  }, []);

  const getVerificationMethodLabel = useCallback((): string => {
    switch (verificationMethod) {
      case 'ignore':
        return 'None (Skip)';
      case 'local':
        return 'Local (Device)';
      case 'iapkit-localhost':
        return 'Local (IAPKit)';
      case 'iapkit':
        return 'IAPKit';
      default:
        return 'Unknown';
    }
  }, [verificationMethod]);

  const showVerificationMethodSelector = useCallback(() => {
    if (Platform.OS === 'ios') {
      const options = [
        'Local (Device)',
        'Local (IAPKit)',
        'IAPKit',
        'None (Skip)',
        'Cancel',
      ];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 4,
          title: 'Select Verification Method',
          message: 'Choose how to verify purchases after completion',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            selectVerificationMethod('local');
          } else if (buttonIndex === 1) {
            selectVerificationMethod('iapkit-localhost');
          } else if (buttonIndex === 2) {
            selectVerificationMethod('iapkit');
          } else if (buttonIndex === 3) {
            selectVerificationMethod('ignore');
          }
        },
      );
    } else {
      setSelectorVisible(true);
    }
  }, [selectVerificationMethod]);

  return {
    verificationMethod,
    verificationMethodRef,
    setVerificationMethod,
    verificationMethodSelectorVisible,
    hideVerificationMethodSelector,
    selectVerificationMethod,
    showVerificationMethodSelector,
    getVerificationMethodLabel,
  };
}
