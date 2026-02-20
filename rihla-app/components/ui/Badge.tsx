import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Radius, FontSize, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function Badge({ label, variant = 'primary', size = 'md', style }: BadgeProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <View style={[s.badge, s[variant], size === 'sm' && s.small, style]}>
      <Text style={[s.text, s[`text_${variant}`], size === 'sm' && s.smallText]}>
        {label}
      </Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, alignSelf: 'flex-start' },
    small: { paddingHorizontal: 7, paddingVertical: 2 },
    primary: { backgroundColor: c.primarySurface },
    success: { backgroundColor: c.successLight },
    warning: { backgroundColor: c.warningLight },
    error: { backgroundColor: c.errorLight },
    neutral: { backgroundColor: c.gray100 },
    text: { fontSize: FontSize.sm, fontWeight: '600' },
    smallText: { fontSize: FontSize.xs },
    text_primary: { color: c.primaryDark },
    text_success: { color: c.success },
    text_warning: { color: c.warning },
    text_error: { color: c.error },
    text_neutral: { color: c.textSecondary },
  });
}
