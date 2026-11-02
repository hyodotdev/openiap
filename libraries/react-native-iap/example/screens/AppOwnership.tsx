import {useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {verifyAppOwnership} from 'react-native-iap';
import {getErrorMessage} from '../src/utils/errorUtils';

/** App Ownership example: evidence that this install came from its store. */
export default function AppOwnership() {
  const [projectNumber, setProjectNumber] = useState('');
  const [requestHash, setRequestHash] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

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
      const code =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string'
          ? `${error.code}: `
          : '';
      setResult(code + getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
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
          style={[styles.button, busy && styles.buttonDisabled]}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#fff',
    color: '#333',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
