import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Colors, Radius } from '../../constants/Theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = Radius.sm, style }: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.gray100, Colors.gray200]
    ),
  }));

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius }, animStyle, style]}
    />
  );
}

export function TripCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={180} borderRadius={Radius.xl} />
      <View style={styles.content}>
        <Skeleton height={20} width="70%" />
        <Skeleton height={14} width="50%" />
        <View style={styles.row}>
          <Skeleton height={14} width={80} />
          <Skeleton height={14} width={60} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: 16,
  },
  content: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', gap: 12 },
});
