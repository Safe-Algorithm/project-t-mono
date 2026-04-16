import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, FlatList, Linking, Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTrip, useTripRating, useTripReviews, useFavorites, useToggleFavorite, useMyRegistrations } from '../../hooks/useTrips';
import apiClient from '../../lib/api';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import StarRating from '../../components/ui/StarRating';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { TripPackage } from '../../types/trip';
import { minPricePerPerson, maxPricePerPerson, buildTierSummaryRows, formatPrice } from '../../lib/pricingUtils';
import Toast from '../../components/ui/Toast';

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
  international_drivers_license: 'car-outline',
  omra_assistance: 'moon-outline',
};

function formatDate(d: string, locale = 'en-US', tz = 'Asia/Riyadh') {
  const dt = new Date(d.endsWith('Z') ? d : d + 'Z');
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz };
  const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(dt);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')}`;
}

function formatMeetingTime(d: string, locale: string, tz: string) {
  const dt = new Date(d.endsWith('Z') ? d : d + 'Z');
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(dt);
}

export default function TripDetailScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [imageIndex, setImageIndex] = useState(0);
  const [showTripTypeInfo, setShowTripTypeInfo] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { data: trip, isLoading } = useTrip(id);
  const { data: rating } = useTripRating(id);
  const { data: reviews } = useTripReviews(id);
  const { data: favorites } = useFavorites();
  const toggleFav = useToggleFavorite();
  const { data: myRegistrations } = useMyRegistrations();

  useEffect(() => {
    if (trip?.images && trip.images.length > 1) {
      trip.images.forEach((uri) => Image.prefetch(uri));
    }
  }, [trip?.id]);

  const isFav = favorites?.some((t) => t.id === id) ?? false;
  const activeBooking = myRegistrations?.find(
    (r) => r.trip_id === id && !['cancelled', 'completed'].includes(r.status)
  ) ?? null;

  const handleShare = async () => {
    try {
      const shareLang = i18n.language === 'ar' ? 'ar' : 'en';
      const { data } = await apiClient.get<{ share_url: string }>(`/trips/${id}/share?lang=${shareLang}`);
      await Share.share({ message: data.share_url, url: data.share_url });
    } catch {
      setToastMessage(t('trip.shareError', 'Could not generate share link'));
      setToastVisible(true);
    }
  }

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
  const toUtcDate = (s: string) => new Date(s.endsWith('Z') ? s : s + 'Z');
  const isPastDeadline = trip.registration_deadline ? toUtcDate(trip.registration_deadline) < now : false;
  const isTripEnded = toUtcDate(trip.end_date) < now;
  const isBookable = trip.is_active && trip.available_spots > 0 && !isPastDeadline && !isTripEnded;

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* Sticky image header */}
        <View>
          {images.length > 0 ? (
            <View style={{ direction: 'ltr' }}>
              <FlatList
                data={images}
                keyExtractor={(_, i) => String(i)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const rawIndex = Math.round(e.nativeEvent.contentOffset.x / W);
                  setImageIndex(rawIndex);
                }}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={s.heroImage} />
                )}
              />
              {/* Image dots */}
              {images.length > 1 && (
                <View style={s.imageDots}>
                  {images.map((_, i) => (
                    <View key={i} style={[s.imageDot, i === imageIndex && s.imageDotActive]} />
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
            <View style={s.overlayRight}>
              <TouchableOpacity style={s.overlayBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.overlayBtn}
                onPress={() => { if (!toggleFav.isPending) toggleFav.mutate({ tripId: id, isFav }); }}
              >
                <Ionicons
                  name={isFav ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isFav ? colors.error : colors.white}
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <View style={s.content}>
          {/* Already booked banner */}
          {activeBooking && (
            <TouchableOpacity
              style={s.bookedBanner}
              onPress={() => router.push(`/booking/${activeBooking.id}` as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={s.bookedBannerText}>{t('trip.alreadyBooked')}</Text>
              <Ionicons name={i18n.language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.success} />
            </TouchableOpacity>
          )}

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

          {/* Trip Type Badge */}
          {trip.trip_type && (
            <View style={s.tripTypeBadgeRow}>
              <TouchableOpacity
                style={[
                  s.tripTypeBadge,
                  trip.trip_type === 'guided' ? s.tripTypeBadgeGuided : s.tripTypeBadgePackage,
                ]}
                onPress={() => setShowTripTypeInfo((v) => !v)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={trip.trip_type === 'guided' ? 'compass-outline' : 'gift-outline'}
                  size={13}
                  color={trip.trip_type === 'guided' ? '#92400e' : '#6b21a8'}
                />
                <Text style={[
                  s.tripTypeBadgeText,
                  trip.trip_type === 'guided' ? s.tripTypeBadgeTextGuided : s.tripTypeBadgeTextPackage,
                ]}>
                  {trip.trip_type === 'guided' ? t('trip.guidedTripBadge') : t('trip.tourismPackageBadge')}
                </Text>
                <Ionicons
                  name="information-circle-outline"
                  size={13}
                  color={trip.trip_type === 'guided' ? '#92400e' : '#6b21a8'}
                />
              </TouchableOpacity>
              {showTripTypeInfo && (
                <View style={s.tripTypeInfoBox}>
                  <Text style={s.tripTypeInfoText}>
                    {trip.trip_type === 'guided' ? t('trip.guidedTripInfo') : t('trip.tourismPackageInfo')}
                  </Text>
                </View>
              )}
            </View>
          )}

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
          {trip.timezone && (
            <View style={s.tzChip}>
              <Ionicons name="globe-outline" size={13} color={colors.textTertiary} />
              <Text style={s.tzChipText}>{t('trip.allDatesIn', { tz: trip.timezone })}</Text>
            </View>
          )}
          <View style={s.infoGrid}>
            <InfoChip icon="calendar-outline" label={t('trip.start')} value={formatDate(trip.start_date, locale, trip.timezone)} colors={colors} s={s} />
            <InfoChip icon="calendar" label={t('trip.end')} value={formatDate(trip.end_date, locale, trip.timezone)} colors={colors} s={s} />
            <InfoChip
              icon="people-outline"
              label={t('trip.availableSpots')}
              value={trip.available_spots === 0 ? t('trip.soldOut') : t('trip.spotsLeft', { count: trip.available_spots })}
              colors={colors} s={s}
            />
            {trip.registration_deadline && (
              <InfoChip
                icon="time-outline"
                label={t('trip.registrationDeadline')}
                value={formatDate(trip.registration_deadline, locale, trip.timezone)}
                colors={colors} s={s}
              />
            )}
            {trip.is_refundable != null && (
              <InfoChip
                icon={trip.is_refundable ? 'checkmark-circle-outline' : 'close-circle-outline'}
                label={t('trip.refundPolicy')}
                value={trip.is_refundable ? t('trip.refundable') : t('trip.nonRefundable')}
                colors={colors} s={s}
                valueColor={trip.is_refundable ? '#166534' : '#991b1b'}
              />
            )}
          </View>


          {/* Route: Timeline */}
          {(trip.starting_city || (trip.destinations && trip.destinations.length > 0)) && (() => {
            const isAr = i18n.language === 'ar';
            const allStops: { key: string; isStart: boolean; cityName: string; subName?: string; countryName?: string; flag: string }[] = [];
            if (trip.starting_city) {
              const sc = trip.starting_city;
              const flag = sc.country_code ? sc.country_code.toUpperCase().replace(/./g, (c: string) => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))) : '';
              allStops.push({
                key: 'start',
                isStart: true,
                cityName: isAr ? sc.name_ar || sc.name_en : sc.name_en || sc.name_ar,
                countryName: (isAr ? (sc.country_name_ar || sc.country_name_en) : (sc.country_name_en || sc.country_name_ar)) || undefined,
                flag,
              });
            }
            for (const dest of (trip.destinations ?? [])) {
              const flag = dest.country_code ? dest.country_code.toUpperCase().replace(/./g, (c: string) => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))) : '';
              const cityName = isAr ? dest.name_ar || dest.name_en : dest.name_en || dest.name_ar;
              const placeName = isAr ? (dest.place_name_ar || dest.place_name_en) : (dest.place_name_en || dest.place_name_ar);
              const countryName = isAr ? (dest.country_name_ar || dest.country_name_en) : (dest.country_name_en || dest.country_name_ar);
              allStops.push({
                key: dest.id,
                isStart: false,
                cityName: placeName || cityName,
                subName: placeName ? cityName : undefined,
                countryName: countryName || undefined,
                flag,
              });
            }
            return (
              <View style={s.routeBox}>
                <Text style={s.routeLabel}>{t('trip.route')}</Text>
                <View style={s.timelineContainer}>
                  {allStops.map((stop, idx) => (
                    <View key={stop.key} style={s.timelineRow}>
                      <View style={s.timelineLeft}>
                        <View style={[s.timelineDot, stop.isStart && s.timelineDotStart]} />
                        {idx < allStops.length - 1 && <View style={s.timelineLine} />}
                      </View>
                      <View style={s.timelineContent}>
                        <Text style={[s.timelineCityText, stop.isStart && s.timelineCityStart]}>
                          {stop.flag} {stop.cityName}
                        </Text>
                        {stop.subName ? (
                          <Text style={s.timelineSubText}>{stop.subName}</Text>
                        ) : null}
                        {stop.countryName ? (
                          <Text style={s.timelineCountryText}>{stop.countryName}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
                {trip.is_international && (
                  <View style={s.intlBadge}>
                    <Ionicons name="globe-outline" size={12} color={colors.primary} />
                    <Text style={s.intlText}>{t('trip.internationalTrip')}</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Meeting place */}
          {trip.has_meeting_place && trip.meeting_location && (
            <View style={s.meetingBox}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.meetingLabel}>{t('trip.meetingPoint')}</Text>
{(() => {
                  const mpName = i18n.language === 'ar'
                    ? (trip.meeting_place_name_ar || trip.meeting_place_name)
                    : (trip.meeting_place_name || trip.meeting_place_name_ar);
                  return mpName ? <Text style={s.meetingValue}>{mpName}</Text> : null;
                })()}
                <TouchableOpacity
                  onPress={() => Linking.openURL(trip.meeting_location!)}
                  activeOpacity={0.7}
                  style={s.meetingLinkBtn}
                >
                  <Ionicons name="map-outline" size={14} color="#fff" />
                  <Text style={s.meetingLinkText} numberOfLines={1}>{t('trip.openInMaps')}</Text>
                  <Ionicons name="open-outline" size={13} color="#fff" />
                </TouchableOpacity>
                {trip.meeting_time && (
                  <Text style={s.meetingTime}>
                    {formatMeetingTime(trip.meeting_time, i18n.language, trip.timezone ?? 'Asia/Riyadh')}
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.feeName}>{i18n.language === 'ar' ? (fee.name_ar || fee.name_en) : (fee.name_en || fee.name_ar)}</Text>
                      <View style={[s.feeBadge, fee.is_mandatory ? s.feeBadgeRequired : s.feeBadgeOptional]}>
                        <Text style={[s.feeBadgeText, fee.is_mandatory ? s.feeBadgeTextRequired : s.feeBadgeTextOptional]}>
                          {fee.is_mandatory ? t('trip.feeRequired') : t('trip.feeOptional')}
                        </Text>
                      </View>
                    </View>
                    {(i18n.language === 'ar' ? (fee.description_ar || fee.description_en) : (fee.description_en || fee.description_ar)) ? (
                      <Text style={s.feeDesc}>{i18n.language === 'ar' ? (fee.description_ar || fee.description_en) : (fee.description_en || fee.description_ar)}</Text>
                    ) : null}
                  </View>
                  <Text style={s.feeAmount}>{t('booking.priceFormat', { price: Number(fee.amount).toLocaleString() })}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Pricing tiers for simple (non-packaged) flexible pricing trips */}
          {!trip.is_packaged_trip && trip.simple_trip_use_flexible_pricing && trip.simple_trip_pricing_tiers && trip.simple_trip_pricing_tiers.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('trip.pricingTitle')}</Text>
              <Text style={s.tierExplainer}>{t('trip.tieringExplainer')}</Text>
              <View style={s.tierTable}>
                <View style={s.tierTableHeader}>
                  <Text style={s.tierTableHeaderCell}>{t('pricing.participantsLabel')}</Text>
                  <Text style={[s.tierTableHeaderCell, s.tierTableHeaderRight]}>{t('pricing.pricePerPersonLabel')}</Text>
                </View>
                {buildTierSummaryRows(trip.simple_trip_pricing_tiers).map((row, i) => (
                  <View key={i} style={[s.tierTableRow, i % 2 === 1 && s.tierTableRowAlt]}>
                    <View style={s.tierTableRangeCell}>
                      <Ionicons name="people-outline" size={12} color={colors.primary} />
                      <Text style={s.tierTableRangeText}>{row.rangeLabel}</Text>
                    </View>
                    <Text style={s.tierTablePriceCell}>
                      {t('pricing.currencySymbol')} {row.priceFormatted}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tiers — only shown for packaged trips */}
          {trip.is_packaged_trip && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('trip.tiers')}</Text>
              {activePackages.length === 0 ? (
                <Text style={s.noPackages}>{t('trip.noTiers')}</Text>
              ) : (
                <View style={s.packages}>
                  {activePackages.map((pkg) => {
                    const pkgName = (i18n.language === 'ar' ? (pkg.name_ar || pkg.name_en) : (pkg.name_en || pkg.name_ar)) || 'Package';
                    const pkgDesc = i18n.language === 'ar' ? (pkg.description_ar || pkg.description_en) : (pkg.description_en || pkg.description_ar);
                    return (
                      <View key={pkg.id} style={s.packageCard}>
                        <View style={s.packageHeader}>
                          <Text style={s.packageName}>{pkgName}</Text>
                          <View style={{ alignItems: 'flex-end' }}>
                            {pkg.use_flexible_pricing && pkg.pricing_tiers && pkg.pricing_tiers.length > 0 ? (
                              <>
                                <Text style={s.packagePriceFrom}>{t('trip.from', 'From')}</Text>
                                <Text style={s.packagePrice}>
                                  {formatPrice(minPricePerPerson(pkg))}
                                </Text>
                                {minPricePerPerson(pkg) !== maxPricePerPerson(pkg) && (
                                  <Text style={s.packagePriceTo}>
                                    {t('trip.to', 'to')} {formatPrice(maxPricePerPerson(pkg))}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <Text style={s.packagePrice}>
                                {t('booking.priceFormat', { price: Number(pkg.price).toLocaleString() })}
                              </Text>
                            )}
                          </View>
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
                        {/* Flexible pricing tier table */}
                        {pkg.use_flexible_pricing && pkg.pricing_tiers && pkg.pricing_tiers.length > 0 && (
                          <View style={s.tierTable}>
                            <View style={s.tierTableHeader}>
                              <Text style={s.tierTableHeaderCell}>{t('pricing.participantsLabel')}</Text>
                              <Text style={[s.tierTableHeaderCell, s.tierTableHeaderRight]}>{t('pricing.pricePerPersonLabel')}</Text>
                            </View>
                            {buildTierSummaryRows(pkg.pricing_tiers).map((row, i) => (
                              <View key={i} style={[s.tierTableRow, i % 2 === 1 && s.tierTableRowAlt]}>
                                <View style={s.tierTableRangeCell}>
                                  <Ionicons name="people-outline" size={12} color={colors.primary} />
                                  <Text style={s.tierTableRangeText}>{row.rangeLabel}</Text>
                                </View>
                                <Text style={s.tierTablePriceCell}>
                                  {t('pricing.currencySymbol')} {row.priceFormatted}
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
        {activeBooking ? (
          <Button
            title={t('trip.viewMyBooking')}
            onPress={() => router.push(`/booking/${activeBooking.id}` as any)}
            fullWidth size="lg"
          />
        ) : isTripEnded ? (
          <Text style={s.selectHint}>{t('trip.tripEnded')}</Text>
        ) : isPastDeadline ? (
          <Text style={s.selectHint}>{t('trip.registrationClosed')}</Text>
        ) : !trip.is_active ? (
          <Text style={s.selectHint}>{t('trip.inactive')}</Text>
        ) : trip.available_spots === 0 ? (
          <Text style={s.selectHint}>{t('trip.soldOut')}</Text>
        ) : !trip.is_packaged_trip ? (
          // Simple trip: show price + direct Book/Buy button
          <View style={s.bottomContent}>
            {trip.simple_trip_use_flexible_pricing && trip.simple_trip_pricing_tiers && trip.simple_trip_pricing_tiers.length > 0 ? (
              <View>
                <Text style={s.bottomLabel}>{t('trip.from')}</Text>
                <Text style={s.bottomPrice}>
                  {formatPrice(Math.min(...trip.simple_trip_pricing_tiers.map(t => Number(t.price_per_person))))}
                </Text>
              </View>
            ) : trip.price != null ? (
              <View>
                <Text style={s.bottomLabel}>{t('trip.pricePerPerson')}</Text>
                <Text style={s.bottomPrice}>
                  {t('booking.priceFormat', { price: Number(trip.price).toLocaleString() })}
                </Text>
              </View>
            ) : null}
            <Button
              title={trip.trip_type === 'self_arranged' ? t('trip.buyNow') : t('trip.bookNow')}
              onPress={() => router.push(`/book/${id}`)}
              style={(trip.price != null || (trip.simple_trip_use_flexible_pricing && trip.simple_trip_pricing_tiers && trip.simple_trip_pricing_tiers.length > 0)) ? s.bookBtn : undefined}
              fullWidth={trip.price == null && !(trip.simple_trip_use_flexible_pricing && trip.simple_trip_pricing_tiers && trip.simple_trip_pricing_tiers.length > 0)}
              size="lg"
            />
          </View>
        ) : (
          // Packaged / multi-tier trip: go directly to booking
          <Button
            title={trip.trip_type === 'self_arranged' ? t('trip.buyNow') : t('trip.bookNow')}
            onPress={() => router.push(`/book/${id}`)}
            fullWidth size="lg"
          />
        )}
      </View>
    <Toast
      visible={toastVisible}
      message={toastMessage}
      type="error"
      onHide={() => setToastVisible(false)}
    />
    </View>
  );
}

function InfoChip({ icon, label, value, colors, s, valueColor }: { icon: any; label: string; value: string; colors: any; s: any; valueColor?: string }) {
  return (
    <View style={s.infoChip}>
      <Ionicons name={icon} size={16} color={valueColor ?? colors.primary} />
      <View>
        <Text style={s.infoChipLabel}>{label}</Text>
        <Text style={[s.infoChipValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
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
  overlayRight: { flexDirection: 'row', gap: 8 },
  overlayBtn: {
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
    backgroundColor: c.gray50,
    borderRadius: Radius.lg, padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: c.primary,
  },
  routeLabel: { fontSize: FontSize.xs, color: c.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  timelineContainer: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 44 },
  timelineLeft: { width: 20, alignItems: 'center', marginTop: 4 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent, borderWidth: 2, borderColor: c.accent + '60' },
  timelineDotStart: { backgroundColor: c.primary, borderColor: c.primary + '60' },
  timelineLine: { width: 2, flex: 1, backgroundColor: c.border, marginVertical: 2 },
  timelineContent: { flex: 1, paddingBottom: 12, paddingStart: 10 },
  timelineCityText: { fontSize: FontSize.sm, fontWeight: '700', color: c.accent },
  timelineCityStart: { color: c.primary },
  timelineSubText: { fontSize: FontSize.xs, color: c.textSecondary, marginTop: 1 },
  timelineCountryText: { fontSize: FontSize.xs, color: c.textTertiary, marginTop: 1 },
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
  meetingLinkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: c.primary,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
  },
  meetingLinkText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '600', flexShrink: 1 },

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
  feeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  feeBadgeRequired: { backgroundColor: c.errorLight, borderColor: c.error },
  feeBadgeOptional: { backgroundColor: c.gray100 ?? c.background, borderColor: c.border },
  feeBadgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  feeBadgeTextRequired: { color: c.error },
  feeBadgeTextOptional: { color: c.textTertiary },

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
  packagePriceFrom: { fontSize: FontSize.xs, color: c.textTertiary, fontWeight: '500' },
  packagePriceTo: { fontSize: FontSize.xs, color: c.textTertiary, fontWeight: '500' },
  tierBandsContainer: { gap: 4, marginTop: 6, marginBottom: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.border },
  tierBandRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tierBandText: { fontSize: FontSize.xs, color: c.textSecondary, fontWeight: '500' },
  tierBandTextRtl: { textAlign: 'right' as const },
  tierExplainer: { fontSize: FontSize.sm, color: c.textSecondary, marginBottom: 8, lineHeight: 20 },
  packageDesc: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20, marginBottom: 8 },
  fieldsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldsText: { fontSize: FontSize.xs, color: c.textTertiary },
  noPackages: { fontSize: FontSize.md, color: c.textTertiary, fontStyle: 'italic' },

  tripTypeBadgeRow: { marginBottom: 12 },
  tripTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
  },
  tripTypeBadgeGuided: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  tripTypeBadgePackage: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
  tripTypeBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  tripTypeBadgeTextGuided: { color: '#92400e' },
  tripTypeBadgeTextPackage: { color: '#6b21a8' },
  tripTypeInfoBox: {
    marginTop: 6, padding: 10,
    backgroundColor: c.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: c.border,
    ...Shadow.sm,
  },
  tripTypeInfoText: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20 },
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
  bookedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: Radius.xl,
    borderWidth: 1, borderColor: '#BBF7D0',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  bookedBannerText: { flex: 1, fontSize: FontSize.sm, fontWeight: '700', color: '#166534' },

  refundBadgeRow: { flexDirection: 'row', marginTop: 8, marginBottom: 4 },
  refundBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  refundBadgeYes: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  refundBadgeNo: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  refundBadgeText: { fontSize: FontSize.xs, fontWeight: '600' as const },
  refundBadgeTextYes: { color: '#166534' },
  refundBadgeTextNo: { color: '#991b1b' },

  tierTable: { borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border, marginTop: 4 },
  tierTableHeader: { flexDirection: 'row', backgroundColor: c.primarySurface, paddingHorizontal: 12, paddingVertical: 7 },
  tierTableHeaderCell: { flex: 1, fontSize: FontSize.xs, fontWeight: '700' as const, color: c.primaryDark },
  tierTableHeaderRight: { textAlign: 'right' as const },
  tierTableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surface },
  tierTableRowAlt: { backgroundColor: c.background },
  tierTableRangeCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tierTableRangeText: { fontSize: FontSize.sm, fontWeight: '600' as const, color: c.textPrimary },
  tierTablePriceCell: { fontSize: FontSize.sm, fontWeight: '700' as const, color: c.accent, textAlign: 'right' as const },

  tzChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: 4 },
  tzChipText: { fontSize: FontSize.xs, color: c.textTertiary, fontStyle: 'italic' },
  });
}
