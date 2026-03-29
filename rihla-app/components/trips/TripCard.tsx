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
import { Radius, FontSize, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
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

function countryCodeToFlag(code: string): string {
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)));
}

function getLocalizedName(trip: Trip, lang: string): string {
  if (lang === 'ar') return trip.name_ar || trip.name_en || 'Unnamed Trip';
  return trip.name_en || trip.name_ar || 'Unnamed Trip';
}

function getDestLabel(trip: Trip, lang: string): string | null {
  const dests = trip.destinations ?? [];
  if (!trip.starting_city && dests.length === 0) return null;
  const isAr = lang === 'ar';
  const getName = (en: string | null, ar: string | null) =>
    isAr ? ar || en || '' : en || ar || '';

  // Starting city: flag + city name (always city, never place/country)
  let from: string | null = null;
  if (trip.starting_city) {
    const sc = trip.starting_city;
    const flag = sc.country_code ? countryCodeToFlag(sc.country_code) : '';
    const city = getName(sc.name_en, sc.name_ar);
    from = `${flag} ${city}`;
  }

  let to: string | null = null;
  if (dests.length > 0) {
    const isDomestic = !trip.is_international;

    if (isDomestic) {
      // Domestic (guided or package): place name if set, else city name — deduplicated
      const seen = new Set<string>();
      const labels: string[] = [];
      for (const dest of dests) {
        const place = getName(dest.place_name_en ?? null, dest.place_name_ar ?? null);
        const city = getName(dest.name_en, dest.name_ar);
        const label = place || city;
        if (label && !seen.has(label)) {
          seen.add(label);
          labels.push(label);
        }
      }
      to = labels.join(' · ') || null;
    } else {
      // International (guided or package): deduplicated country names with flag
      const seen = new Set<string>();
      const labels: string[] = [];
      for (const dest of dests) {
        const key = dest.country_code || '';
        if (key && !seen.has(key)) {
          seen.add(key);
          const country = getName(dest.country_name_en ?? null, dest.country_name_ar ?? null);
          const flag = countryCodeToFlag(key);
          const label = country ? `${flag} ${country}` : flag;
          if (label) labels.push(label);
        }
      }
      to = labels.join(' · ') || null;
    }
  }

  const arrow = isAr ? ' \u203a ' : ' \u2192 ';
  const RLM = '\u200f';
  if (from && to) return isAr ? `${RLM}${from}${arrow}${to}` : `${from}${arrow}${to}`;
  if (from) return isAr ? `${RLM}${from}` : from;
  return isAr && to ? `${RLM}${to}` : to;
}

function formatDate(dateStr: string, _lang: string, tz?: string): string {
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz ?? 'Asia/Riyadh' };
  const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')}`;
}

function getMinPrice(trip: Trip): number | null {
  // Simple trip with flexible pricing — lowest tier rate
  if (!trip.is_packaged_trip && trip.simple_trip_use_flexible_pricing && trip.simple_trip_pricing_tiers?.length) {
    const sorted = [...trip.simple_trip_pricing_tiers].sort((a, b) => a.from_participant - b.from_participant);
    return Number(sorted[0].price_per_person);
  }
  if (trip.price != null) return Number(trip.price);
  if (!trip.packages?.length) return null;
  // For packaged trips: use the minimum starting price across packages
  return Math.min(...trip.packages.map((p) => {
    if (p.use_flexible_pricing && p.pricing_tiers?.length) {
      const sorted = [...p.pricing_tiers].sort((a, b) => a.from_participant - b.from_participant);
      return Number(sorted[0].price_per_person);
    }
    return Number(p.price);
  }));
}

function isFlexibleTrip(trip: Trip): boolean {
  if (!trip.is_packaged_trip && trip.simple_trip_use_flexible_pricing && (trip.simple_trip_pricing_tiers?.length ?? 0) > 1) return true;
  if (trip.is_packaged_trip && trip.packages?.some(p => p.use_flexible_pricing && (p.pricing_tiers?.length ?? 0) > 1)) return true;
  return false;
}

function getDisplayAmenities(trip: Trip): string[] | null {
  if (trip.amenities && trip.amenities.length > 0) return trip.amenities;
  if (!trip.packages?.length) return null;
  let best: string[] = [];
  for (const pkg of trip.packages) {
    if ((pkg.amenities?.length ?? 0) > best.length) best = pkg.amenities ?? [];
  }
  return best.length > 0 ? best : null;
}

export default function TripCard({ trip, onPress, isFavorite = false, onFavoriteToggle, compact = false, testID }: TripCardProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const coverImage = trip.images?.[0];
  const minPrice = getMinPrice(trip);
  const displayAmenities = getDisplayAmenities(trip);
  const name = getLocalizedName(trip, i18n.language);
  const packageCount = trip.packages?.length ?? 0;
  const flexible = isFlexibleTrip(trip);
  const priceKey = (trip.is_packaged_trip || flexible) ? 'trip.fromPrice' : 'trip.priceOnly';
  const routeLabel = getDestLabel(trip, i18n.language);

  if (compact) {
    return (
      <AnimatedTouchable
        style={[s.compactCard, animStyle]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        activeOpacity={1}
      >
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={s.compactImage} />
        ) : (
          <View style={[s.compactImage, s.imagePlaceholder]}>
            <Ionicons name="image-outline" size={28} color={colors.gray300} />
          </View>
        )}
        <View style={s.compactContent}>
          <Text style={s.compactName} numberOfLines={1}>{name}</Text>
          <Text style={s.compactProvider} numberOfLines={1}>{trip.provider?.company_name}</Text>
          {minPrice !== null && (
            <Text style={s.price}>{t(priceKey as any, { price: minPrice.toLocaleString() })}</Text>
          )}
          {flexible && (
            <View style={s.flexBadgeCompact}>
              <Text style={s.flexBadgeCompactText}>{t('trip.flexiblePricingBadge', 'Flexible')}</Text>
            </View>
          )}
        </View>
      </AnimatedTouchable>
    );
  }

  return (
    <AnimatedTouchable
      style={[s.card, animStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      activeOpacity={1}
      testID={testID}
    >
      <View style={s.imageContainer}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={s.image} />
        ) : (
          <View style={[s.image, s.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color={colors.gray300} />
          </View>
        )}
        <View style={s.imageOverlay} />
        {onFavoriteToggle && (
          <TouchableOpacity style={s.favoriteBtn} onPress={onFavoriteToggle} testID="fav-btn">
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? colors.error : colors.white}
            />
          </TouchableOpacity>
        )}
        {minPrice !== null && (
          <View style={[s.priceBadgeRow, i18n.language === 'ar' && s.priceBadgeRowRtl]}>
            <View style={[s.priceBadge, flexible && s.priceBadgeFlexible]}>
              <Text style={s.priceBadgeText}>{t(priceKey as any, { price: minPrice.toLocaleString() })}</Text>
            </View>
            {flexible && (
              <View style={s.flexBadge}>
                <Text style={s.flexBadgeText}>{t('trip.flexiblePricingBadge', 'Flexible')}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={s.content}>
        <Text style={s.name} numberOfLines={2}>{name}</Text>
        <View style={s.providerRow}>
          <Ionicons name="business-outline" size={13} color={colors.textTertiary} />
          <Text style={s.provider} numberOfLines={1}>{trip.provider?.company_name}</Text>
        </View>
        {trip.trip_type && (
          <View style={[
            s.tripTypeBadge,
            trip.trip_type === 'guided' ? s.tripTypeBadgeGuided : s.tripTypeBadgePackage,
          ]}>
            <Ionicons
              name={trip.trip_type === 'guided' ? 'compass-outline' : 'gift-outline'}
              size={11}
              color={trip.trip_type === 'guided' ? '#92400e' : '#6b21a8'}
            />
            <Text style={[
              s.tripTypeBadgeText,
              trip.trip_type === 'guided' ? s.tripTypeBadgeTextGuided : s.tripTypeBadgeTextPackage,
            ]}>
              {trip.trip_type === 'guided' ? t('trip.guidedTripBadge') : t('trip.tourismPackageBadge')}
            </Text>
          </View>
        )}
        {routeLabel && (
          <View style={s.routeRow}>
            <Ionicons name="navigate-outline" size={13} color={colors.primary} />
            <Text
              style={[s.routeText, i18n.language === 'ar' && s.routeTextRtl]}
              numberOfLines={1}
            >
              {routeLabel}
            </Text>
          </View>
        )}
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            <Text style={s.metaText}>{formatDate(trip.start_date, i18n.language, trip.timezone)}</Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Ionicons name="people-outline" size={13} color={trip.available_spots === 0 ? colors.error : colors.primary} />
            <Text style={[s.metaText, trip.available_spots === 0 && { color: colors.error }]}>
              {trip.available_spots === 0
                ? t('trip.soldOut')
                : t('trip.spotsLeft', { count: trip.available_spots })}
            </Text>
          </View>
          {trip.average_rating !== undefined && trip.average_rating > 0 && (
            <>
              <View style={s.metaDivider} />
              <View style={s.metaItem}>
                <StarRating rating={trip.average_rating} size={12} />
                <Text style={s.metaText}>{trip.average_rating.toFixed(1)}</Text>
              </View>
            </>
          )}
        </View>
        {displayAmenities && displayAmenities.length > 0 && (
          <View style={s.amenitiesRow}>
            {displayAmenities.slice(0, 3).map((a) => (
              <View key={a} style={s.amenityChip}>
                <Text style={s.amenityText}>{t(`amenities.${a}` as any, { defaultValue: a.replace(/_/g, ' ') })}</Text>
              </View>
            ))}
            {displayAmenities.length > 3 && (
              <View style={s.amenityChip}>
                <Text style={s.amenityText}>+{displayAmenities.length - 3}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </AnimatedTouchable>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: { width: CARD_WIDTH, backgroundColor: c.surface, borderRadius: Radius.xxl, overflow: 'hidden', marginBottom: 16, ...Shadow.md },
    imageContainer: { position: 'relative' },
    image: { width: '100%', height: 200 },
    imagePlaceholder: { backgroundColor: c.gray100, alignItems: 'center', justifyContent: 'center' },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'transparent' },
    favoriteBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
    priceBadgeRow: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'flex-start' },
    priceBadgeRowRtl: {},
    priceBadge: { backgroundColor: c.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
    priceBadgeText: { color: c.white, fontSize: FontSize.sm, fontWeight: '700' },
    content: { padding: 14, gap: 8 },
    name: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary, lineHeight: 22 },
    providerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    provider: { fontSize: FontSize.sm, color: c.textTertiary, flex: 1 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    routeText: { fontSize: FontSize.xs, color: c.primary, fontWeight: '600', flex: 1 },
    routeTextRtl: { writingDirection: 'rtl' },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: FontSize.xs, color: c.textSecondary, fontWeight: '500' },
    metaDivider: { width: 1, height: 12, backgroundColor: c.border },
    amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    amenityChip: { backgroundColor: c.primarySurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    amenityText: { fontSize: FontSize.xs, color: c.primaryDark, fontWeight: '500', textTransform: 'capitalize' },
    price: { fontSize: FontSize.md, fontWeight: '700', color: c.primary },
    compactCard: { width: 180, backgroundColor: c.surface, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.sm },
    compactImage: { width: '100%', height: 110 },
    compactContent: { padding: 10, gap: 4 },
    compactName: { fontSize: FontSize.sm, fontWeight: '700', color: c.textPrimary },
    compactProvider: { fontSize: FontSize.xs, color: c.textTertiary },
    tripTypeBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, alignSelf: 'flex-start' as const, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
    tripTypeBadgeGuided: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
    tripTypeBadgePackage: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
    tripTypeBadgeText: { fontSize: FontSize.xs, fontWeight: '700' as const },
    tripTypeBadgeTextGuided: { color: '#92400e' },
    tripTypeBadgeTextPackage: { color: '#6b21a8' },
    flexBadge: { backgroundColor: 'rgba(14,165,233,0.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    flexBadgeCompact: { alignSelf: 'flex-start' as const, backgroundColor: c.primarySurface, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, marginTop: 2 },
    flexBadgeText: { color: c.white, fontSize: FontSize.xs, fontWeight: '700' as const },
    flexBadgeCompactText: { color: c.primaryDark, fontSize: FontSize.xs, fontWeight: '700' as const },
    priceBadgeFlexible: {},
  });
}
