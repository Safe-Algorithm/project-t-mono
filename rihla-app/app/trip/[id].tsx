import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, FlatList, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTrip, useTripRating, useTripReviews, useFavorites, useToggleFavorite } from '../../hooks/useTrips';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import StarRating from '../../components/ui/StarRating';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { TripPackage } from '../../types/trip';

const { width: W } = Dimensions.get('window');

const AMENITY_ICONS: Record<string, string> = {
  flight_tickets: 'airplane-outline',
  bus: 'bus-outline',
  tour_guide: 'person-outline',
  tours: 'map-outline',
  hotel: 'bed-outline',
  meals: 'restaurant-outline',
  insurance: 'shield-checkmark-outline',
  visa_assistance: 'document-text-outline',
};

function formatDate(d: string, locale = 'en-US') {
  return new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TripDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [imageIndex, setImageIndex] = useState(0);
  const isRTL = i18n.language === 'ar';

  const { data: trip, isLoading } = useTrip(id);
  const { data: rating } = useTripRating(id);
  const { data: reviews } = useTripReviews(id);
  const { data: favorites } = useFavorites();
  const toggleFav = useToggleFavorite();

  const isFav = favorites?.some((t) => t.id === id) ?? false;

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingHeader}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name={i18n.language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Skeleton height={240} borderRadius={Radius.xxl} />
          <Skeleton height={28} width="80%" />
          <Skeleton height={16} width="50%" />
          <Skeleton height={100} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.gray300} />
          <Text style={s.errorText}>{t('trip.notFound')}</Text>
          <Button title={t('trip.goBack')} onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const name = (i18n.language === 'ar' ? (trip.name_ar || trip.name_en) : (trip.name_en || trip.name_ar)) || 'Trip';
  const description = (i18n.language === 'ar' ? (trip.description_ar || trip.description_en) : (trip.description_en || trip.description_ar)) || '';
  const images = trip.images ?? [];
  const activePackages = trip.packages?.filter((p) => p.is_active) ?? [];

  const now = new Date();
  const isPastDeadline = trip.registration_deadline ? new Date(trip.registration_deadline) < now : false;
  const isTripEnded = new Date(trip.end_date) < now;
  const isBookable = trip.is_active && trip.available_spots > 0 && !isPastDeadline && !isTripEnded;

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* Sticky image header */}
        <View>
          {images.length > 0 ? (
            <View>
              <FlatList
                data={isRTL ? [...images].reverse() : images}
                keyExtractor={(_, i) => String(i)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const rawIndex = Math.round(e.nativeEvent.contentOffset.x / W);
                  setImageIndex(isRTL ? images.length - 1 - rawIndex : rawIndex);
                }}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={s.heroImage} />
                )}
              />
              {/* Image dots */}
              {images.length > 1 && (
                <View style={s.imageDots}>
                  {images.map((_, i) => (
                    <View
                      key={i}
                      style={[s.imageDot, i === imageIndex && s.imageDotActive]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[s.heroImage, s.heroPlaceholder]}>
              <Ionicons name="image-outline" size={64} color={colors.gray300} />
            </View>
          )}

          {/* Overlay buttons */}
          <SafeAreaView style={s.imageOverlay} edges={['top']}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name={i18n.language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.favBtn}
              onPress={() => toggleFav.mutate({ tripId: id, isFav })}
            >
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={22}
                color={isFav ? colors.error : colors.white}
              />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={s.content}>
          {/* Title & provider */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.tripName}>{name}</Text>
              <TouchableOpacity
                style={s.providerRow}
                onPress={() => router.push(`/provider/${trip.provider_id}`)}
              >
                <Ionicons name="business-outline" size={14} color={colors.primary} />
                <Text style={s.providerName}>{trip.provider?.company_name}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {!trip.is_active && <Badge label={t('trip.inactive')} variant="error" />}
          </View>

          {/* Rating */}
          {rating && rating.total_reviews > 0 && (
            <View style={s.ratingRow}>
              <StarRating rating={rating.average_rating} size={16} />
              <Text style={s.ratingText}>
                {t('trip.rating', { rating: rating.average_rating.toFixed(1), count: rating.total_reviews })}
              </Text>
            </View>
          )}

          {/* Key info */}
          <View style={s.infoGrid}>
            <InfoChip icon="calendar-outline" label={t('trip.start')} value={formatDate(trip.start_date, locale)} colors={colors} s={s} />
            <InfoChip icon="calendar" label={t('trip.end')} value={formatDate(trip.end_date, locale)} colors={colors} s={s} />
            <InfoChip
              icon="people-outline"
              label={t('trip.availableSpots')}
              value={trip.available_spots === 0 ? t('trip.soldOut') : t('trip.spotsLeft', { count: trip.available_spots })}
              colors={colors} s={s}
            />
            {trip.is_refundable != null && (
              <InfoChip
                icon="refresh-outline"
                label={t('booking.package')}
                value={trip.is_refundable ? t('trip.refundable') : t('trip.nonRefundable')}
                colors={colors} s={s}
              />
            )}
          </View>

          {/* Route: Starting city → Destinations */}
          {(trip.starting_city || (trip.destinations && trip.destinations.length > 0)) && (
            <View style={s.routeBox}>
              <Ionicons name="navigate-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.routeLabel}>{t('trip.route')}</Text>
                <View style={s.routeRow}>
                  {trip.starting_city && (
                    <View style={s.routeChip}>
                      <Ionicons name="location" size={12} color={colors.primary} />
                      <Text style={s.routeChipText}>
                        {i18n.language === 'ar'
                          ? trip.starting_city.name_ar || trip.starting_city.name_en
                          : trip.starting_city.name_en || trip.starting_city.name_ar}
                      </Text>
                    </View>
                  )}
                  {trip.starting_city && trip.destinations && trip.destinations.length > 0 && (
                    <Ionicons
                      name={i18n.language === 'ar' ? 'arrow-back' : 'arrow-forward'}
                      size={14}
                      color={colors.textTertiary}
                    />
                  )}
                  {(trip.destinations ?? []).map((dest, i) => (
                    <React.Fragment key={dest.id}>
                      <View style={s.routeChip}>
                        <Ionicons name="flag-outline" size={12} color={colors.accent} />
                        <Text style={[s.routeChipText, { color: colors.accent }]}>
                          {i18n.language === 'ar' ? dest.name_ar || dest.name_en : dest.name_en || dest.name_ar}
                        </Text>
                      </View>
                      {i < (trip.destinations?.length ?? 0) - 1 && (
                        <Text style={s.routeSep}>·</Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>
                {trip.is_international && (
                  <View style={s.intlBadge}>
                    <Ionicons name="globe-outline" size={12} color={colors.primary} />
                    <Text style={s.intlText}>{t('trip.internationalTrip')}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Meeting place */}
          {trip.has_meeting_place && trip.meeting_location && (
            <View style={s.meetingBox}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.meetingLabel}>{t('trip.meetingPoint')}</Text>
                <Text style={s.meetingValue}>{trip.meeting_location}</Text>
                {trip.meeting_time && (
                  <Text style={s.meetingTime}>
                    {new Date(trip.meeting_time).toLocaleString(locale, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Description */}
          {description.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('trip.aboutTrip')}</Text>
              <Text style={s.description}>{description}</Text>
            </View>
          )}

          {/* Amenities */}
          {trip.amenities && trip.amenities.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('trip.whatsIncluded')}</Text>
              <View style={s.amenitiesGrid}>
                {trip.amenities.map((a) => (
                  <View key={a} style={s.amenityItem}>
                    <View style={s.amenityIcon}>
                      <Ionicons
                        name={(AMENITY_ICONS[a] ?? 'checkmark-outline') as any}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={s.amenityLabel}>
                      {t(`amenities.${a}` as any, { defaultValue: a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Extra fees */}
          {trip.extra_fees && trip.extra_fees.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('trip.additionalFees')}</Text>
              {trip.extra_fees.map((fee) => (
                <View key={fee.id} style={s.feeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.feeName}>{i18n.language === 'ar' ? (fee.name_ar ?? fee.name_en) : (fee.name_en ?? fee.name_ar)}</Text>
                    {(i18n.language === 'ar' ? (fee.description_ar ?? fee.description_en) : (fee.description_en ?? fee.description_ar)) && (
                      <Text style={s.feeDesc}>{i18n.language === 'ar' ? (fee.description_ar ?? fee.description_en) : (fee.description_en ?? fee.description_ar)}</Text>
                    )}
                  </View>
                  <Text style={s.feeAmount}>{t('booking.priceFormat', { price: Number(fee.amount).toLocaleString() })}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Packages — only shown for packaged trips */}
          {trip.is_packaged_trip && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('trip.choosePackage')}</Text>
              {activePackages.length === 0 ? (
                <Text style={s.noPackages}>{t('trip.noPackages')}</Text>
              ) : (
                <View style={s.packages}>
                  {activePackages.map((pkg) => {
                    const pkgName = (i18n.language === 'ar' ? (pkg.name_ar || pkg.name_en) : (pkg.name_en || pkg.name_ar)) || 'Package';
                    const pkgDesc = i18n.language === 'ar' ? (pkg.description_ar || pkg.description_en) : (pkg.description_en || pkg.description_ar);
                    return (
                      <View key={pkg.id} style={s.packageCard}>
                        <View style={s.packageHeader}>
                          <Text style={s.packageName}>{pkgName}</Text>
                          <Text style={s.packagePrice}>
                            {t('booking.priceFormat', { price: Number(pkg.price).toLocaleString() })}
                          </Text>
                        </View>
                        {pkgDesc && <Text style={s.packageDesc} numberOfLines={2}>{pkgDesc}</Text>}
                        {/* Amenities */}
                        {pkg.amenities && pkg.amenities.length > 0 && (
                          <View style={s.pkgAmenitiesRow}>
                            {pkg.amenities.map((a) => (
                              <View key={a} style={s.pkgAmenityChip}>
                                <Ionicons name={(AMENITY_ICONS[a] ?? 'checkmark-outline') as any} size={11} color={colors.primary} />
                                <Text style={s.pkgAmenityText}>
                                  {t(`amenities.${a}` as any, { defaultValue: a.replace(/_/g, ' ') })}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <View style={s.pkgMetaRow}>
                          {pkg.available_spots != null && (
                            <View style={s.pkgMetaChip}>
                              <Ionicons
                                name="people-outline"
                                size={12}
                                color={pkg.available_spots === 0 ? colors.error : colors.textTertiary}
                              />
                              <Text style={[s.pkgMetaText, pkg.available_spots === 0 && { color: colors.error }]}>
                                {pkg.available_spots === 0
                                  ? t('trip.soldOut')
                                  : t('trip.spotsLeft', { count: pkg.available_spots })}
                              </Text>
                            </View>
                          )}
                          {pkg.is_refundable != null && (
                            <View style={s.pkgMetaChip}>
                              <Ionicons
                                name={pkg.is_refundable ? 'refresh-outline' : 'close-circle-outline'}
                                size={12}
                                color={pkg.is_refundable ? colors.success : colors.error}
                              />
                              <Text style={[s.pkgMetaText, { color: pkg.is_refundable ? colors.success : colors.error }]}>
                                {pkg.is_refundable ? t('trip.refundable') : t('trip.nonRefundable')}
                              </Text>
                            </View>
                          )}
                          {pkg.required_fields.length > 0 && (
                            <View style={s.pkgMetaChip}>
                              <Ionicons name="document-text-outline" size={12} color={colors.textTertiary} />
                              <Text style={s.pkgMetaText}>{t('trip.requiredFields', { count: pkg.required_fields.length })}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Reviews */}
          {reviews && reviews.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('trip.reviews')}</Text>
              {reviews.slice(0, 3).map((r) => (
                <View key={r.id} style={s.reviewCard}>
                  <View style={s.reviewHeader}>
                    <View style={s.reviewAvatar}>
                      <Text style={s.reviewAvatarText}>{r.user_name?.[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reviewName}>{r.user_name}</Text>
                      <StarRating rating={r.rating} size={13} />
                    </View>
                    <Text style={s.reviewDate}>
                      {new Date(r.created_at).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  {r.comment && <Text style={s.reviewComment}>{r.comment}</Text>}
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {isTripEnded ? (
          <Text style={s.selectHint}>{t('trip.tripEnded')}</Text>
        ) : isPastDeadline ? (
          <Text style={s.selectHint}>{t('trip.registrationClosed')}</Text>
        ) : !trip.is_active ? (
          <Text style={s.selectHint}>{t('trip.inactive')}</Text>
        ) : trip.available_spots === 0 ? (
          <Text style={s.selectHint}>{t('trip.soldOut')}</Text>
        ) : !trip.is_packaged_trip ? (
          // Simple trip: show price + direct Book Now
          <View style={s.bottomContent}>
            {trip.price != null && (
              <View>
                <Text style={s.bottomLabel}>{t('trip.pricePerPerson')}</Text>
                <Text style={s.bottomPrice}>
                  {t('booking.priceFormat', { price: Number(trip.price).toLocaleString() })}
                </Text>
              </View>
            )}
            <Button
              title={t('trip.bookNow')}
              onPress={() => router.push(`/book/${id}`)}
              style={trip.price != null ? s.bookBtn : undefined}
              fullWidth={trip.price == null}
              size="lg"
            />
          </View>
        ) : (
          // Packaged trip: go directly to booking (package selection happens in booking flow)
          <Button
            title={t('trip.bookNow')}
            onPress={() => router.push(`/book/${id}`)}
            fullWidth size="lg"
          />
        )}
      </View>
    </View>
  );
}

function InfoChip({ icon, label, value, colors, s }: { icon: any; label: string; value: string; colors: any; s: any }) {
  return (
    <View style={s.infoChip}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View>
        <Text style={s.infoChipLabel}>{label}</Text>
        <Text style={s.infoChipValue}>{value}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  loadingHeader: { paddingTop: 56, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },

  heroImage: { width: W, height: 300 },
  heroPlaceholder: { backgroundColor: c.gray100, alignItems: 'center', justifyContent: 'center' },
  imageOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  favBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageDots: {
    position: 'absolute', bottom: 12,
    flexDirection: 'row', alignSelf: 'center', gap: 6,
  },
  imageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  imageDotActive: { backgroundColor: c.white, width: 18 },

  content: { padding: 20, gap: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  tripName: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary, lineHeight: 30 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  providerName: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600' },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ratingText: { fontSize: FontSize.sm, color: c.textSecondary, fontWeight: '500' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.surface, borderRadius: Radius.lg,
    paddingHorizontal: 12, paddingVertical: 10,
    flex: 1, minWidth: '45%',
    ...Shadow.sm,
  },
  infoChipLabel: { fontSize: FontSize.xs, color: c.textTertiary, fontWeight: '500' },
  infoChipValue: { fontSize: FontSize.sm, color: c.textPrimary, fontWeight: '700' },

  routeBox: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: c.gray50,
    borderRadius: Radius.lg, padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: c.primary,
  },
  routeLabel: { fontSize: FontSize.xs, color: c.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  routeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  routeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surface, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: c.border },
  routeChipText: { fontSize: FontSize.xs, color: c.textPrimary, fontWeight: '600' },
  routeSep: { fontSize: FontSize.sm, color: c.textTertiary },
  intlBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  intlText: { fontSize: FontSize.xs, color: c.primary, fontWeight: '600' },
  meetingBox: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: c.primarySurface,
    borderRadius: Radius.lg, padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: c.primary,
  },
  meetingLabel: { fontSize: FontSize.xs, color: c.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  meetingValue: { fontSize: FontSize.md, color: c.textPrimary, fontWeight: '600', marginTop: 2 },
  meetingTime: { fontSize: FontSize.sm, color: c.textSecondary, marginTop: 2 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: c.textPrimary, marginBottom: 12 },
  description: { fontSize: FontSize.md, color: c.textSecondary, lineHeight: 24 },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityItem: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '47%' },
  amenityIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: c.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  amenityLabel: { fontSize: FontSize.sm, color: c.textPrimary, fontWeight: '500', flex: 1 },

  feeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  feeName: { fontSize: FontSize.md, color: c.textPrimary, fontWeight: '600' },
  feeDesc: { fontSize: FontSize.sm, color: c.textTertiary, marginTop: 2 },
  feeAmount: { fontSize: FontSize.md, color: c.accent, fontWeight: '700' },

  packages: { gap: 12 },
  packageCard: {
    borderWidth: 1.5, borderColor: c.border,
    borderRadius: Radius.xl, padding: 16,
    backgroundColor: c.surface, ...Shadow.sm,
  },
  packageCardSelected: { borderColor: c.primary, backgroundColor: c.primarySurface },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  packageName: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary, flex: 1 },
  packageNameSelected: { color: c.primaryDark },
  packagePrice: { fontSize: FontSize.lg, fontWeight: '800', color: c.accent },
  packagePriceSelected: { color: c.primary },
  packageDesc: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20, marginBottom: 8 },
  fieldsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldsText: { fontSize: FontSize.xs, color: c.textTertiary },
  noPackages: { fontSize: FontSize.md, color: c.textTertiary, fontStyle: 'italic' },
  pkgAmenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 4 },
  pkgAmenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.primarySurface, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pkgAmenityText: { fontSize: FontSize.xs, color: c.primary, fontWeight: '600' },
  pkgMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pkgMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pkgMetaText: { fontSize: FontSize.xs, color: c.textTertiary, fontWeight: '500' },

  reviewCard: {
    backgroundColor: c.surface, borderRadius: Radius.xl,
    padding: 14, marginBottom: 10, ...Shadow.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: FontSize.md, fontWeight: '700', color: c.primary },
  reviewName: { fontSize: FontSize.sm, fontWeight: '700', color: c.textPrimary, marginBottom: 2 },
  reviewDate: { fontSize: FontSize.xs, color: c.textTertiary },
  reviewComment: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: c.surface,
    borderTopWidth: 1, borderTopColor: c.border,
    paddingHorizontal: 20, paddingTop: 14,
    ...Shadow.lg,
  },
  bottomContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomLabel: { fontSize: FontSize.xs, color: c.textTertiary, fontWeight: '500' },
  bottomPrice: { fontSize: FontSize.xl, fontWeight: '800', color: c.textPrimary },
  bookBtn: { minWidth: 140 },
    selectHint: { fontSize: FontSize.md, color: c.textTertiary, textAlign: 'center', fontWeight: '500' },
  });
}
