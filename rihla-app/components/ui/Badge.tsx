import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, FontSize } from '../../constants/Theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function Badge({ label, variant = 'primary', size = 'md', style }: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], size === 'sm' && styles.small, style]}>
      <Text style={[styles.text, styles[`text_${variant}`], size === 'sm' && styles.smallText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  small: { paddingHorizontal: 7, paddingVertical: 2 },
  primary: { backgroundColor: Colors.primarySurface },
  success: { backgroundColor: Colors.successLight },
  warning: { backgroundColor: Colors.warningLight },
  error: { backgroundColor: Colors.errorLight },
  neutral: { backgroundColor: Colors.gray100 },
  text: { fontSize: FontSize.sm, fontWeight: '600' },
  smallText: { fontSize: FontSize.xs },
  text_primary: { color: Colors.primaryDark },
  text_success: { color: Colors.success },
  text_warning: { color: Colors.warning },
  text_error: { color: Colors.error },
  text_neutral: { color: Colors.textSecondary },
});
