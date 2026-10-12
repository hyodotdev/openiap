import {useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {verifyAppOwnership} from 'react-native-iap';
import {getErrorMessage} from '../utils/errorUtils';

export default function AppOwnershipCard() {
  const [projectNumber, setProjectNumber] = useState('');
  const [requestHash, setRequestHash] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const checkOwnership = async () => {
    const cloudProjectNumber = projectNumber.trim();
    const digest = requestHash.trim();
    if (Boolean(cloudProjectNumber) !== Boolean(digest)) {
      setResult(
        'developer-error: Enter both Google fields or leave both empty.',
      );
      return;
    }
    setBusy(true);
    setResult('');
    try {
      const evidence = await verifyAppOwnership(
        cloudProjectNumber && digest
          ? {google: {cloudProjectNumber, requestHash: digest}}
          : undefined,
      );
      if (mounted.current)
        setResult(
          [
            `Status: ${evidence.status}`,
            `Store ID: ${evidence.storeId}`,
            `Reason: ${evidence.reason ?? 'none'}`,
            `Signed AppTransaction length: ${evidence.signedAppTransactionIOS?.length ?? 0}`,
            `Integrity token length: ${evidence.integrityTokenAndroid?.length ?? 0}`,
          ].join('\n'),
        );
    } catch (error) {
      if (mounted.current) {
        const code =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          typeof error.code === 'string'
            ? `${error.code}: `
            : '';
        setResult(code + getErrorMessage(error));
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>App ownership</Text>
      <Text style={styles.text}>
        Google Play requires a linked Cloud project number and a request hash
        from your backend. Unknown is inconclusive; send evidence to your
        backend for verification.
      </Text>
      <TextInput
        accessibilityLabel="Google Cloud project number"
        placeholder="Google Cloud project number"
        value={projectNumber}
        onChangeText={setProjectNumber}
        editable={!busy}
        keyboardType="number-pad"
        style={styles.input}
      />
      <TextInput
        accessibilityLabel="Request hash"
        placeholder="Request hash"
        value={requestHash}
        onChangeText={setRequestHash}
        editable={!busy}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Check app ownership"
        disabled={busy}
        onPress={checkOwnership}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {busy ? 'Checking app ownership…' : 'Check app ownership'}
        </Text>
      </TouchableOpacity>
      {result ? (
        <Text selectable style={styles.text}>
          {result}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  title: {color: '#111827', fontSize: 18, fontWeight: '600'},
  text: {color: '#111827', fontSize: 14},
  input: {
    color: '#111827',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {color: '#ffffff', fontWeight: '600'},
});
