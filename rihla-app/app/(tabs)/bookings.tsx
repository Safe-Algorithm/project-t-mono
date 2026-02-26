import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useInfiniteRegistrations, useAllMyTripUpdates } from '../../hooks/useTrips';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import Badge from '../../components/ui/Badge';
import { TripRegistration } from '../../types/trip';

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'primary'> = {
  confirmed: 'success',
  pending: 'warning',
  cancelled: 'error',
  completed: 'neutral',
  pending_payment: 'warning',
};

function BookingCard({ reg }: { reg: TripRegistration }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const statusVariant = STATUS_VARIANTS[reg.status] ?? 'neutral';
  const statusLabel = t(`bookings.status.${reg.status}` as any, { defaultValue: reg.status });
  const tripName = (i18n.language === 'ar' ? (reg.trip?.name_ar || reg.trip?.name_en) : (reg.trip?.name_en || reg.trip?.name_ar)) || 'Trip';
  const startDate = reg.trip?.start_date
    ? (() => {
        const d = new Date(reg.trip.start_date.endsWith('Z') ? reg.trip.start_date : reg.trip.start_date + 'Z');
        return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          timeZone: (reg.trip as any).timezone ?? 'Asia/Riyadh',
        });
      })()
    : '';

  return (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/booking/${reg.id}`)} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.tripName} numberOfLines={1}>{tripName}</Text>
          <Text style={s.pkgName}>{reg.trip?.provider?.company_name ?? ''}</Text>
        </View>
        <Badge label={statusLabel} variant={statusVariant} size="sm" />
      </View>
      <View style={s.cardMeta}>
        {startDate && (
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            <Text style={s.metaText}>{startDate}</Text>
          </View>
        )}
        <View style={s.metaItem}>
          <Ionicons name="people-outline" size={13} color={colors.primary} />
          <Text style={s.metaText}>{t('bookings.participants', { count: reg.total_participants })}</Text>
        </View>
        <View style={s.metaItem}>
          <Ionicons name="receipt-outline" size={13} color={colors.textTertiary} />
          <Text style={s.refText}>{reg.booking_reference ?? reg.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>
      <View style={s.cardFooter}>
        <Text style={s.dateBooked}>
          {t('bookings.booked', { date: new Date(reg.registration_date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' }) })}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function BookingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteRegistrations();

  // useMyRegistrations is still used by useAllMyTripUpdates internally
  const { data: allUpdates } = useAllMyTripUpdates();
  const unreadCount = allUpdates?.filter((u) => !u.read).length ?? 0;

  const registrations = useMemo(() => data?.pages.flat() ?? [], [data]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const ListFooter = isFetchingNextPage
    ? <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.primary} />
    : null;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('bookings.title')}</Text>
        <View style={s.headerRight}>
          {registrations.length > 0 && (
            <Text style={s.count}>{registrations.length}</Text>
          )}
          <TouchableOpacity style={s.updatesBtn} onPress={() => router.push('/trip-updates')}>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unreadCount > 0 && (
              <View style={s.unreadDot}>
                <Text style={s.unreadDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {isLoading ? (
        <View style={s.list}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={s.skeletonCard}>
              <Skeleton height={20} width="70%" />
              <Skeleton height={14} width="40%" />
              <Skeleton height={14} width="60%" />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={registrations}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <BookingCard reg={item} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={ListFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={64} color={colors.gray300} />
              <Text style={s.emptyTitle}>{t('bookings.noBookingsTitle')}</Text>
              <Text style={s.emptyText}>{t('bookings.noBookingsText')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    count: { backgroundColor: c.primary, color: c.white, fontSize: FontSize.sm, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, overflow: 'hidden' },
    updatesBtn: { position: 'relative', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    unreadDot: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    unreadDotText: { color: c.white, fontSize: 9, fontWeight: '800' },
    list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
    card: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, gap: 10, ...Shadow.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    tripName: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    pkgName: { fontSize: FontSize.sm, color: c.textTertiary, marginTop: 2 },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: FontSize.sm, color: c.textSecondary, fontWeight: '500' },
    refText: { fontSize: FontSize.xs, color: c.textTertiary, fontFamily: 'monospace' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
    dateBooked: { fontSize: FontSize.xs, color: c.textTertiary },
    skeletonCard: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, gap: 10, ...Shadow.sm },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    emptyText: { fontSize: FontSize.md, color: c.textTertiary, textAlign: 'center', paddingHorizontal: 32 },
  });
}
