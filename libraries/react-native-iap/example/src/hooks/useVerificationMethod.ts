import {useState, useCallback} from 'react';
import {Platform, ActionSheetIOS} from 'react-native';
import {
  getVerificationMethod,
  setVerificationMethod,
  type VerificationMethod,
} from '../utils/purchaseFlow';

interface UseVerificationMethodReturn {
  verificationMethod: VerificationMethod;
  verificationMethodSelectorVisible: boolean;
  hideVerificationMethodSelector: () => void;
  selectVerificationMethod: (method: VerificationMethod) => void;
  showVerificationMethodSelector: () => void;
}

/** The verification method selector; the app's purchase flow reads the choice. */
export function useVerificationMethod(): UseVerificationMethodReturn {
  const [verificationMethod, setMethod] = useState(getVerificationMethod);
  const [verificationMethodSelectorVisible, setSelectorVisible] =
    useState(false);

  const hideVerificationMethodSelector = useCallback(() => {
    setSelectorVisible(false);
  }, []);

  const selectVerificationMethod = useCallback((method: VerificationMethod) => {
    setVerificationMethod(method);
    setMethod(method);
    setSelectorVisible(false);
  }, []);

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
          message: 'Verify purchases before completing the transaction',
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
    verificationMethodSelectorVisible,
    hideVerificationMethodSelector,
    selectVerificationMethod,
    showVerificationMethodSelector,
  };
}
