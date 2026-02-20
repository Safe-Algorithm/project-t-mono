import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  padded?: boolean;
}

export default function Card({ children, style, elevated = false, padded = true }: CardProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <View style={[s.card, elevated && s.elevated, padded && s.padded, style]}>
      {children}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: Radius.xl, ...Shadow.md },
    elevated: { ...Shadow.lg },
    padded: { padding: 16 },
  });
}
