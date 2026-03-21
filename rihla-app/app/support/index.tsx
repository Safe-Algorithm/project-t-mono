import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { FontSize, Radius, Shadow } from '../../constants/Theme';
import { ThemeColors } from '../../constants/Theme';
import { listAdminTickets, listMyTripTickets, SupportTicket, TripSupportTicket } from '../../lib/supportApi';

const STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6',
  in_progress: '#F59E0B',
  waiting_on_user: '#F97316',
  resolved: '#10B981',
  closed: '#94A3B8',
};

function TicketRow({
  subject, status, category, date, onPress, colors,
}: {
  subject: string; status: string; category?: string; date: string;
  onPress: () => void; colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  return (
    <TouchableOpacity style={s.ticketRow} onPress={onPress} activeOpacity={0.7}>
      <View style={s.ticketRowLeft}>
        <Text style={s.ticketSubject} numberOfLines={1}>{subject}</Text>
        <Text style={s.ticketMeta}>
          {category ? `${category} · ` : ''}{new Date(date).toLocaleDateString()}
        </Text>
      </View>
      <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[status] ?? '#94A3B8' }]} />
    </TouchableOpacity>
  );
}

export default function SupportIndexScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { t } = useTranslation();

  const { data: adminTickets, isLoading: loadingAdmin, refetch: refetchAdmin } =
    useQuery<SupportTicket[]>({
      queryKey: ['support-admin-tickets'],
      queryFn: async () => (await listAdminTickets()).data,
    });

  const { data: tripTickets, isLoading: loadingTrip, refetch: refetchTrip } =
    useQuery<TripSupportTicket[]>({
      queryKey: ['support-trip-tickets'],
      queryFn: async () => (await listMyTripTickets()).data,
    });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchAdmin(), refetchTrip()]);
    setRefreshing(false);
  }, [refetchAdmin, refetchTrip]);

  const loading = loadingAdmin || loadingTrip;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('support.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        )}

        {/* Contact Admin */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{t('support.adminSectionTitle')}</Text>
            <TouchableOpacity
              style={s.newBtn}
              onPress={() => router.push('/support/admin-ticket' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={s.newBtnText}>{t('support.newTicket')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.sectionDesc}>{t('support.adminSectionDesc')}</Text>

          {!loading && (!adminTickets || adminTickets.length === 0) ? (
            <View style={s.emptyBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textTertiary} />
              <Text style={s.emptyText}>{t('support.noAdminTickets')}</Text>
            </View>
          ) : (
            <View style={s.card}>
              {adminTickets?.slice(0, 5).map((t) => (
                <TicketRow
                  key={t.id}
                  subject={t.subject}
                  status={t.status}
                  category={t.category}
                  date={t.created_at}
                  colors={colors}
                  onPress={() => router.push({ pathname: '/support/admin-ticket' as any, params: { ticketId: t.id } })}
                />
              ))}
              {(adminTickets?.length ?? 0) > 5 && (
                <TouchableOpacity
                  style={s.seeAll}
                  onPress={() => router.push('/support/admin-ticket' as any)}
                >
                  <Text style={s.seeAllText}>{t('support.seeAll', { count: adminTickets!.length })}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Trip tickets */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{t('support.tripSectionTitle')}</Text>
          </View>
          <Text style={s.sectionDesc}>{t('support.tripSectionDesc')}</Text>

          {!loading && (!tripTickets || tripTickets.length === 0) ? (
            <View style={s.emptyBox}>
              <Ionicons name="trail-sign-outline" size={32} color={colors.textTertiary} />
              <Text style={s.emptyText}>{t('support.noTripTickets')}</Text>
              <Text style={s.emptyHint}>{t('support.goToBooking')}</Text>
            </View>
          ) : (
            <View style={s.card}>
              {tripTickets?.slice(0, 5).map((t) => (
                <TicketRow
                  key={t.id}
                  subject={t.subject}
                  status={t.status}
                  date={t.created_at}
                  colors={colors}
                  onPress={() =>
                    router.push({
                      pathname: '/support/trip-ticket' as any,
                      params: { ticketId: t.id },
                    })
                  }
                />
              ))}
              {(tripTickets?.length ?? 0) > 5 && (
                <TouchableOpacity style={s.seeAll}>
                  <Text style={s.seeAllText}>{t('support.seeAll', { count: tripTickets!.length })}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.textPrimary },
    scroll: { padding: 16, paddingBottom: 40 },
    section: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: colors.textPrimary },
    sectionDesc: { fontSize: FontSize.sm, color: colors.textSecondary, marginBottom: 12, lineHeight: 20 },
    newBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: Radius.full,
    },
    newBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
    card: {
      backgroundColor: colors.surface, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: colors.border,
      overflow: 'hidden',
      ...Shadow.sm,
    },
    ticketRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    ticketRowLeft: { flex: 1 },
    ticketSubject: { fontSize: FontSize.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
    ticketMeta: { fontSize: 12, color: colors.textTertiary },
    statusDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 12, flexShrink: 0 },
    emptyBox: {
      alignItems: 'center', paddingVertical: 28,
      backgroundColor: colors.surface, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: colors.border,
    },
    emptyText: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 8, fontWeight: '500' },
    emptyHint: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
    seeAll: { paddingVertical: 12, alignItems: 'center' },
    seeAllText: { fontSize: FontSize.sm, color: colors.primary, fontWeight: '600' },
  });
