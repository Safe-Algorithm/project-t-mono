import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 16,
  interactive = false,
  onRate,
}: StarRatingProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        const icon = filled ? 'star' : half ? 'star-half' : 'star-outline';
        if (interactive) {
          return (
            <TouchableOpacity key={i} onPress={() => onRate?.(i + 1)}>
              <Ionicons name={icon} size={size} color={colors.warning} />
            </TouchableOpacity>
          );
        }
        return <Ionicons key={i} name={icon} size={size} color={colors.warning} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
