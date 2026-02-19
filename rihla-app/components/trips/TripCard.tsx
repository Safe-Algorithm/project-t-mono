import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Trip } from '../../types/trip';
import { Colors, Radius, FontSize, Shadow, Spacing } from '../../constants/Theme';
import StarRating from '../ui/StarRating';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  compact?: boolean;
  testID?: string;
}

function getLocalizedName(trip: Trip, lang: string): string {
  return (lang === 'ar' ? trip.name_ar : trip.name_en) ?? trip.name_en ?? trip.name_ar ?? 'Unnamed Trip';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMinPrice(trip: Trip): number | null {
  if (!trip.packages?.length) return null;
  return Math.min(...trip.packages.map((p) => Number(p.price)));
}

export default function TripCard({ trip, onPress, isFavorite = false, onFavoriteToggle, compact = false, testID }: TripCardProps) {
  const { t, i18n } = useTranslation();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const coverImage = trip.images?.[0];
  const minPrice = getMinPrice(trip);
  const name = getLocalizedName(trip, i18n.language);

  if (compact) {
    return (
      <AnimatedTouchable
        style={[styles.compactCard, animStyle]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        activeOpacity={1}
      >
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.compactImage} />
        ) : (
          <View style={[styles.compactImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={28} color={Colors.gray300} />
          </View>
        )}
        <View style={styles.compactContent}>
          <Text style={styles.compactName} numberOfLines={1}>{name}</Text>
          <Text style={styles.compactProvider} numberOfLines={1}>{trip.provider?.company_name}</Text>
          {minPrice !== null && (
            <Text style={styles.price}>SAR {minPrice.toLocaleString()}</Text>
          )}
        </View>
      </AnimatedTouchable>
    );
  }

  return (
    <AnimatedTouchable
      style={[styles.card, animStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      activeOpacity={1}
      testID={testID}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color={Colors.gray300} />
          </View>
        )}

        {/* Gradient overlay */}
        <View style={styles.imageOverlay} />

        {/* Favorite button */}
        {onFavoriteToggle && (
          <TouchableOpacity style={styles.favoriteBtn} onPress={onFavoriteToggle} testID="fav-btn">
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? Colors.error : Colors.white}
            />
          </TouchableOpacity>
        )}

        {/* Price badge */}
        {minPrice !== null && (
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>From SAR {minPrice.toLocaleString()}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>

        <View style={styles.providerRow}>
          <Ionicons name="business-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.provider} numberOfLines={1}>{trip.provider?.company_name}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
            <Text style={styles.metaText}>{formatDate(trip.start_date)}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={Colors.primary} />
            <Text style={styles.metaText}>{t('trip.maxPeople')} {trip.max_participants}</Text>
          </View>
          {trip.average_rating !== undefined && trip.average_rating > 0 && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <StarRating rating={trip.average_rating} size={12} />
                <Text style={styles.metaText}>{trip.average_rating.toFixed(1)}</Text>
              </View>
            </>
          )}
        </View>

        {trip.amenities && trip.amenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {trip.amenities.slice(0, 3).map((a) => (
              <View key={a} style={styles.amenityChip}>
                <Text style={styles.amenityText}>{a.replace(/_/g, ' ')}</Text>
              </View>
            ))}
            {trip.amenities.length > 3 && (
              <View style={styles.amenityChip}>
                <Text style={styles.amenityText}>+{trip.amenities.length - 3}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    marginBottom: 16,
    ...Shadow.md,
  },
  imageContainer: { position: 'relative' },
  image: { width: '100%', height: 200 },
  imagePlaceholder: {
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  priceBadgeText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  content: { padding: 14, gap: 8 },
  name: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, lineHeight: 22 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  provider: { fontSize: FontSize.sm, color: Colors.textTertiary, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  metaDivider: { width: 1, height: 12, backgroundColor: Colors.border },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amenityChip: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  amenityText: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: '500', textTransform: 'capitalize' },
  price: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },

  // Compact
  compactCard: {
    width: 180,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  compactImage: { width: '100%', height: 110 },
  compactContent: { padding: 10, gap: 4 },
  compactName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  compactProvider: { fontSize: FontSize.xs, color: Colors.textTertiary },
});
