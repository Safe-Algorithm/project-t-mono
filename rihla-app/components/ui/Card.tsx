import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Shadow } from '../../constants/Theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  padded?: boolean;
}

export default function Card({ children, style, elevated = false, padded = true }: CardProps) {
  return (
    <View style={[styles.card, elevated && styles.elevated, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    ...Shadow.md,
  },
  elevated: { ...Shadow.lg },
  padded: { padding: 16 },
});
