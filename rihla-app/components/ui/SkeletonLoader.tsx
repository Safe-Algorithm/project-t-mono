import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Radius, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = Radius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.gray100, colors.gray200]
    ),
  }));

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius }, animStyle, style]}
    />
  );
}

export function TripCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: Radius.xl, overflow: 'hidden', marginBottom: 16 }}>
      <Skeleton height={180} borderRadius={Radius.xl} />
      <View style={{ padding: 16, gap: 10 }}>
        <Skeleton height={20} width="70%" />
        <Skeleton height={14} width="50%" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton height={14} width={80} />
          <Skeleton height={14} width={60} />
        </View>
      </View>
    </View>
  );
}
