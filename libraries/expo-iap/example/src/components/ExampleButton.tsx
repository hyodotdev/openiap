import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';

type Props = Omit<TouchableOpacityProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary';
};

export default function ExampleButton({
  title,
  variant = 'primary',
  style,
  disabled,
  accessibilityState,
  ...props
}: Props) {
  const secondary = variant === 'secondary';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{...accessibilityState, disabled: Boolean(disabled)}}
      activeOpacity={0.65}
      disabled={disabled}
      {...props}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {backgroundColor: '#FFFFFF', borderColor: '#CBD5E1'},
  disabled: {opacity: 0.45},
  label: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  secondaryLabel: {color: '#1E40AF'},
});
