import {useState, type ReactNode} from 'react';
import {Platform, StyleSheet, Text, View} from 'react-native';
import {useActionSheet} from '@expo/react-native-action-sheet';
import BackendEntitlementFlow from './BackendEntitlementFlow';
import ExampleButton from './ExampleButton';

interface Props {
  productType: 'in-app' | 'subs';
  children: ReactNode;
}

export default function PurchaseConfirmationScreen({
  productType,
  children,
}: Props) {
  const [appBackend, setAppBackend] = useState(false);
  const {showActionSheetWithOptions} = useActionSheet();
  const changeConfirmation = (): void => {
    showActionSheetWithOptions(
      {
        title: 'Purchase confirmation',
        message:
          'Receipt checks test store verification. Your app backend also checks account ownership and decides app access.',
        options: ['Receipt checks', 'Your app backend', 'Cancel'],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0 || index === 1) setAppBackend(index === 1);
      },
    );
  };
  return (
    <View style={styles.container}>
      {String(Platform.OS) !== 'kepler' ? (
        <View style={styles.selector}>
          <View style={styles.row}>
            <View style={styles.label}>
              <Text style={styles.hint}>Purchase confirmation</Text>
              <Text style={styles.value}>
                {appBackend ? 'Your app backend' : 'Receipt checks'}
              </Text>
            </View>
            <ExampleButton
              title="Change"
              accessibilityLabel="Change purchase confirmation"
              variant="secondary"
              onPress={changeConfirmation}
            />
          </View>
          <Text style={styles.hint}>
            {appBackend
              ? 'Your backend checks the purchase and account ownership, then decides app access.'
              : 'Test receipt verification and transaction finishing. Your app still decides what to unlock.'}
          </Text>
        </View>
      ) : null}
      {appBackend ? (
        <BackendEntitlementFlow productType={productType} />
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFC'},
  selector: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  label: {flex: 1},
  value: {fontSize: 16, fontWeight: '600', color: '#0F172A', lineHeight: 24},
  hint: {fontSize: 13, lineHeight: 19, color: '#475569'},
});
