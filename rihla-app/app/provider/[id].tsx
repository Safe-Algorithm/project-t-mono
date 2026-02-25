import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useProviderProfile, useInfiniteProviderTrips } from '../../hooks/useTrips';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import StarRating from '../../components/ui/StarRating';
import TripCard from '../../components/trips/TripCard';
import { Trip } from '../../types/trip';

const COVER_HEIGHT = 160;
const AVATAR_SIZE = 80;
const AVATAR_OVERLAP = AVATAR_SIZE / 2;

export default function ProviderProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: provider, isLoading } = useProviderProfile(id);

  const {
    data: tripsData,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteProviderTrips(id);

  const trips = useMemo(() => tripsData?.pages.flat() ?? [], [tripsData]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderTrip = useCallback(({ item }: { item: Trip }) => (
    <TripCard trip={item} onPress={() => router.push(`/trip/${item.id}`)} />
  ), []);

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={{ padding: 20, gap: 16 }}>
          <View style={s.skeletonProfile}>
            <Skeleton width={80} height={80} borderRadius={40} />
            <Skeleton height={24} width="60%" />
            <Skeleton height={16} width="40%" />
          </View>
          <Skeleton height={100} />
          <Skeleton height={180} />
        </View>
      </SafeAreaView>
    );
  }

  if (!provider) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.gray300} />
          <Text style={s.errorText}>{t('provider.title')}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.backLink}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const bio = (i18n.language === 'ar' ? provider.bio_ar : provider.bio_en) ?? provider.bio_en ?? provider.bio_ar;

  const ListHeader = (
    <>
      {/* Cover + Avatar hero section */}
      <View style={[s.profileCard, { paddingTop: COVER_HEIGHT + AVATAR_OVERLAP + 12 }]}>
        <View style={[s.coverContainer, { height: COVER_HEIGHT }]}>
          {provider.company_cover_url ? (
            <Image source={{ uri: provider.company_cover_url }} style={s.coverImage} resizeMode="cover" />
          ) : (
            <View style={s.coverPlaceholder}>
              <Ionicons name="image-outline" size={32} color={colors.gray300} />
            </View>
          )}
        </View>
        <View style={[s.avatarWrapper, { top: COVER_HEIGHT - AVATAR_OVERLAP, width: AVATAR_SIZE + 6, height: AVATAR_SIZE + 6, borderRadius: (AVATAR_SIZE + 6) / 2 }]}>
          {provider.company_avatar_url ? (
            <Image source={{ uri: provider.company_avatar_url }} style={[s.avatar, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]} />
          ) : (
            <View style={[s.avatarPlaceholder, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}>
              <Text style={s.avatarInitials}>{provider.company_name?.[0]?.toUpperCase() ?? 'P'}</Text>
            </View>
          )}
        </View>
        <Text style={s.companyName}>{provider.company_name}</Text>
        {provider.average_rating > 0 && (
          <View style={s.ratingRow}>
            <StarRating rating={provider.average_rating} size={16} />
            <Text style={s.ratingText}>{provider.average_rating.toFixed(1)} ({provider.total_reviews} reviews)</Text>
          </View>
        )}
        <View style={s.statsRow}>
          <StatItem icon="map-outline" value={String(provider.total_trips)} label={t('provider.totalTrips')} colors={colors} s={s} />
          <View style={s.statDivider} />
          <StatItem icon="compass-outline" value={String(provider.active_trips)} label={t('provider.activeTrips')} colors={colors} s={s} />
          <View style={s.statDivider} />
          <StatItem icon="star-outline" value={provider.average_rating > 0 ? provider.average_rating.toFixed(1) : '—'} label={t('provider.avgRating')} colors={colors} s={s} />
        </View>
      </View>

      {/* Contact + Bio */}
      <View style={s.content}>
        {(provider.company_email || provider.company_phone) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('personalInfo.phone')}</Text>
            <View style={s.contactCard}>
              {provider.company_email && (
                <View style={s.contactRow}>
                  <Ionicons name="mail-outline" size={16} color={colors.primary} />
                  <Text style={s.contactText}>{provider.company_email}</Text>
                </View>
              )}
              {provider.company_phone && (
                <View style={s.contactRow}>
                  <Ionicons name="call-outline" size={16} color={colors.primary} />
                  <Text style={s.contactText}>{provider.company_phone}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        {bio && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('trip.aboutTrip')}</Text>
            <Text style={s.bio}>{bio}</Text>
          </View>
        )}
        {trips.length > 0 && (
          <Text style={s.sectionTitle}>{t('provider.tripsBy', { name: provider.company_name })}</Text>
        )}
      </View>
    </>
  );

  return (
    <View style={s.container}>
      <SafeAreaView style={s.headerSafe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('provider.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetchingNextPage
            ? <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.primary} />
            : <View style={{ height: 32 }} />
        }
      />
    </View>
  );
}

function StatItem({ icon, value, label, colors, s }: { icon: any; value: string; label: string; colors: any; s: any }) {
  return (
    <View style={s.statItem}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    headerSafe: { backgroundColor: c.surface },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    errorText: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    backLink: { fontSize: FontSize.md, color: c.primary, fontWeight: '600' },
    profileCard: { backgroundColor: c.surface, alignItems: 'center', paddingBottom: 24, paddingHorizontal: 20, gap: 10, borderBottomWidth: 1, borderBottomColor: c.border, position: 'relative' },
    coverContainer: { position: 'absolute', top: 0, left: 0, right: 0 },
    coverImage: { width: '100%', height: '100%' },
    coverPlaceholder: { width: '100%', height: '100%', backgroundColor: c.gray100, alignItems: 'center', justifyContent: 'center' },
    avatarWrapper: { position: 'absolute', left: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center' },
    avatarInitials: { fontSize: FontSize.xxl, fontWeight: '800', color: c.primary },
    companyName: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ratingText: { fontSize: FontSize.sm, color: c.textSecondary, fontWeight: '500' },
    statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.gray50, borderRadius: Radius.xl, paddingVertical: 16, paddingHorizontal: 8, width: '100%', marginTop: 4 },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, height: 40, backgroundColor: c.border },
    statValue: { fontSize: FontSize.xl, fontWeight: '800', color: c.textPrimary },
    statLabel: { fontSize: FontSize.xs, color: c.textTertiary, fontWeight: '500' },
    listContent: { paddingBottom: 0 },
    content: { padding: 20, gap: 0 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: c.textPrimary, marginBottom: 12 },
    contactCard: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, gap: 12, ...Shadow.sm },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    contactText: { fontSize: FontSize.md, color: c.textPrimary },
    bio: { fontSize: FontSize.md, color: c.textSecondary, lineHeight: 24 },
    skeletonProfile: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  });
}
