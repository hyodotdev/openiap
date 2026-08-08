import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import type {VerificationMethod} from '../hooks/useVerificationMethod';

const VERIFICATION_METHOD_OPTIONS: readonly {
  description: string;
  label: string;
  value: VerificationMethod;
}[] = [
  {
    value: 'local',
    label: 'Local (Device)',
    description: 'Verify directly with Apple or Google on this device.',
  },
  {
    value: 'iapkit-localhost',
    label: 'Local (IAPKit)',
    description: 'Route verification through your local IAPKit server.',
  },
  {
    value: 'iapkit',
    label: 'IAPKit',
    description: 'Verify through the hosted IAPKit service.',
  },
  {
    value: 'ignore',
    label: 'None (Skip)',
    description: 'Skip verification for this example flow.',
  },
];

interface VerificationMethodSelectorModalProps {
  onDismiss: () => void;
  onSelect: (method: VerificationMethod) => void;
  selectedMethod: VerificationMethod;
  visible: boolean;
}

export default function VerificationMethodSelectorModal({
  onDismiss,
  onSelect,
  selectedMethod,
  visible,
}: VerificationMethodSelectorModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay} testID="verification-method-selector">
        <Pressable
          accessibilityLabel="Close verification method selector"
          onPress={onDismiss}
          style={styles.backdrop}
          testID="verification-method-backdrop"
        />
        <View style={styles.sheet}>
          <Text style={styles.title}>Select Verification Method</Text>
          <Text style={styles.message}>
            Choose how to verify purchases after completion
          </Text>
          {VERIFICATION_METHOD_OPTIONS.map((option) => {
            const isSelected = selectedMethod === option.value;
            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="button"
                accessibilityState={{selected: isSelected}}
                key={option.value}
                onPress={() => onSelect(option.value)}
                style={({pressed}) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
                testID="verification-method-option"
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                </View>
                {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({pressed}) => [
              styles.cancelButton,
              pressed && styles.optionPressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
  },
  message: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 16,
    marginTop: 4,
  },
  option: {
    alignItems: 'center',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: '#eef6ff',
    borderColor: '#007aff',
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    color: '#007aff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 12,
  },
  cancelText: {
    color: '#007aff',
    fontSize: 16,
    fontWeight: '600',
  },
});
