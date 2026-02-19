import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, FlatList, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTrip, useTripRating, useTripReviews, useFavorites, useToggleFavorite } from '../../hooks/useTrips';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../constants/Theme';
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
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedPackage, setSelectedPackage] = useState<TripPackage | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const { data: trip, isLoading } = useTrip(id);
  const { data: rating } = useTripRating(id);
  const { data: reviews } = useTripReviews(id);
  const { data: favorites } = useFavorites();
  const toggleFav = useToggleFavorite();

  const isFav = favorites?.some((t) => t.id === id) ?? false;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
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
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color={Colors.gray300} />
          <Text style={styles.errorText}>{t('trip.notFound')}</Text>
          <Button title={t('trip.goBack')} onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const name = (i18n.language === 'ar' ? trip.name_ar : trip.name_en) ?? trip.name_en ?? trip.name_ar ?? 'Trip';
  const description = (i18n.language === 'ar' ? trip.description_ar : trip.description_en) ?? trip.description_en ?? trip.description_ar ?? '';
  const images = trip.images ?? [];
  const activePackages = trip.packages?.filter((p) => p.is_active) ?? [];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* Sticky image header */}
        <View>
          {images.length > 0 ? (
            <View>
              <FlatList
                data={images}
                keyExtractor={(_, i) => String(i)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setImageIndex(Math.round(e.nativeEvent.contentOffset.x / W))
                }
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.heroImage} />
                )}
              />
              {/* Image dots */}
              {images.length > 1 && (
                <View style={styles.imageDots}>
                  {images.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.imageDot, i === imageIndex && styles.imageDotActive]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Ionicons name="image-outline" size={64} color={Colors.gray300} />
            </View>
          )}

          {/* Overlay buttons */}
          <SafeAreaView style={styles.imageOverlay} edges={['top']}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.favBtn}
              onPress={() => toggleFav.mutate({ tripId: id, isFav })}
            >
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={22}
                color={isFav ? Colors.error : Colors.white}
              />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          {/* Title & provider */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripName}>{name}</Text>
              <TouchableOpacity
                style={styles.providerRow}
                onPress={() => router.push(`/provider/${trip.provider_id}`)}
              >
                <Ionicons name="business-outline" size={14} color={Colors.primary} />
                <Text style={styles.providerName}>{trip.provider?.company_name}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            {!trip.is_active && <Badge label={t('trip.inactive')} variant="error" />}
          </View>

          {/* Rating */}
          {rating && rating.total_reviews > 0 && (
            <View style={styles.ratingRow}>
              <StarRating rating={rating.average_rating} size={16} />
              <Text style={styles.ratingText}>
                {t('trip.rating', { rating: rating.average_rating.toFixed(1), count: rating.total_reviews })}
              </Text>
            </View>
          )}

          {/* Key info */}
          <View style={styles.infoGrid}>
            <InfoChip icon="calendar-outline" label={t('trip.start')} value={formatDate(trip.start_date, locale)} />
            <InfoChip icon="calendar" label={t('trip.end')} value={formatDate(trip.end_date, locale)} />
            <InfoChip icon="people-outline" label={t('trip.maxPeople')} value={t('trip.people', { count: trip.max_participants })} />
            <InfoChip
              icon="refresh-outline"
              label={t('booking.package')}
              value={trip.is_refundable ? t('trip.refundable') : t('trip.nonRefundable')}
            />
          </View>

          {/* Meeting place */}
          {trip.has_meeting_place && trip.meeting_location && (
            <View style={styles.meetingBox}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.meetingLabel}>{t('trip.meetingPoint')}</Text>
                <Text style={styles.meetingValue}>{trip.meeting_location}</Text>
                {trip.meeting_time && (
                  <Text style={styles.meetingTime}>
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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('trip.aboutTrip')}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>
          )}

          {/* Amenities */}
          {trip.amenities && trip.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('trip.whatsIncluded')}</Text>
              <View style={styles.amenitiesGrid}>
                {trip.amenities.map((a) => (
                  <View key={a} style={styles.amenityItem}>
                    <View style={styles.amenityIcon}>
                      <Ionicons
                        name={(AMENITY_ICONS[a] ?? 'checkmark-outline') as any}
                        size={20}
                        color={Colors.primary}
                      />
                    </View>
                    <Text style={styles.amenityLabel}>
                      {t(`amenities.${a}` as any, { defaultValue: a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Extra fees */}
          {trip.extra_fees && trip.extra_fees.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('trip.additionalFees')}</Text>
              {trip.extra_fees.map((fee) => (
                <View key={fee.id} style={styles.feeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeName}>{(i18n.language === 'ar' ? fee.name_ar : fee.name_en) ?? fee.name_en ?? fee.name_ar}</Text>
                    {((i18n.language === 'ar' ? fee.description_ar : fee.description_en) ?? fee.description_en ?? fee.description_ar) && (
                      <Text style={styles.feeDesc}>{(i18n.language === 'ar' ? fee.description_ar : fee.description_en) ?? fee.description_en ?? fee.description_ar}</Text>
                    )}
                  </View>
                  <Text style={styles.feeAmount}>SAR {Number(fee.amount).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Packages */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('trip.choosePackage')}</Text>
            {activePackages.length === 0 ? (
              <Text style={styles.noPackages}>{t('trip.noPackages')}</Text>
            ) : (
              <View style={styles.packages}>
                {activePackages.map((pkg) => {
                  const pkgName = (i18n.language === 'ar' ? pkg.name_ar : pkg.name_en) ?? pkg.name_en ?? pkg.name_ar ?? 'Package';
                  const pkgDesc = (i18n.language === 'ar' ? pkg.description_ar : pkg.description_en) ?? pkg.description_en ?? pkg.description_ar;
                  const isSelected = selectedPackage?.id === pkg.id;
                  return (
                    <TouchableOpacity
                      key={pkg.id}
                      style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                      onPress={() => setSelectedPackage(isSelected ? null : pkg)}
                    >
                      <View style={styles.packageHeader}>
                        <Text style={[styles.packageName, isSelected && styles.packageNameSelected]}>
                          {pkgName}
                        </Text>
                        <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
                          SAR {Number(pkg.price).toLocaleString()}
                        </Text>
                      </View>
                      {pkgDesc && (
                        <Text style={styles.packageDesc} numberOfLines={2}>{pkgDesc}</Text>
                      )}
                      {pkg.required_fields.length > 0 && (
                        <View style={styles.fieldsRow}>
                          <Ionicons name="document-text-outline" size={12} color={Colors.textTertiary} />
                          <Text style={styles.fieldsText}>
                            {t('trip.requiredFields', { count: pkg.required_fields.length })}
                          </Text>
                        </View>
                      )}
                      {isSelected && (
                        <View style={styles.selectedCheck}>
                          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Reviews */}
          {reviews && reviews.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('trip.reviews')}</Text>
              {reviews.slice(0, 3).map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{r.user_name?.[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewName}>{r.user_name}</Text>
                      <StarRating rating={r.rating} size={13} />
                    </View>
                    <Text style={styles.reviewDate}>
                      {new Date(r.created_at).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        {selectedPackage ? (
          <View style={styles.bottomContent}>
            <View>
              <Text style={styles.bottomLabel}>{t('trip.selectedPackage')}</Text>
              <Text style={styles.bottomPrice}>
                SAR {Number(selectedPackage.price).toLocaleString()}
              </Text>
            </View>
            <Button
              title={t('trip.bookNow')}
              onPress={() => router.push(`/booking/${id}?packageId=${selectedPackage.id}`)}
              style={styles.bookBtn}
              size="lg"
            />
          </View>
        ) : (
          <Text style={styles.selectHint}>{t('trip.selectHint')}</Text>
        )}
      </View>
    </View>
  );
}

function InfoChip({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoChip}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <View>
        <Text style={styles.infoChipLabel}>{label}</Text>
        <Text style={styles.infoChipValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingHeader: { paddingTop: 56, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },

  heroImage: { width: W, height: 300 },
  heroPlaceholder: { backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
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
  imageDotActive: { backgroundColor: Colors.white, width: 18 },

  content: { padding: 20, gap: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  tripName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, lineHeight: 30 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  providerName: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ratingText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    paddingHorizontal: 12, paddingVertical: 10,
    flex: 1, minWidth: '45%',
    ...Shadow.sm,
  },
  infoChipLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  infoChipValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '700' },

  meetingBox: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg, padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  meetingLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  meetingValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },
  meetingTime: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  description: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityItem: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '47%' },
  amenityIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  amenityLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500', flex: 1 },

  feeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  feeName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600' },
  feeDesc: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  feeAmount: { fontSize: FontSize.md, color: Colors.accent, fontWeight: '700' },

  packages: { gap: 12 },
  packageCard: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.xl, padding: 16,
    backgroundColor: Colors.white, ...Shadow.sm,
  },
  packageCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  packageName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  packageNameSelected: { color: Colors.primaryDark },
  packagePrice: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.accent },
  packagePriceSelected: { color: Colors.primary },
  packageDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  fieldsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldsText: { fontSize: FontSize.xs, color: Colors.textTertiary },
  selectedCheck: { position: 'absolute', top: 12, right: 12 },
  noPackages: { fontSize: FontSize.md, color: Colors.textTertiary, fontStyle: 'italic' },

  reviewCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: 14, marginBottom: 10, ...Shadow.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  reviewName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  reviewDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  reviewComment: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 28,
    ...Shadow.lg,
  },
  bottomContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  bottomPrice: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  bookBtn: { minWidth: 140 },
  selectHint: { fontSize: FontSize.md, color: Colors.textTertiary, textAlign: 'center', fontWeight: '500' },
});
