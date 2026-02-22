import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Clipboard, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRegistration, useTripUpdates, useMarkUpdateRead } from '../../hooks/useTrips';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { TripUpdate } from '../../types/trip';

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'primary'> = {
  confirmed: 'success',
  pending: 'warning',
  pending_payment: 'warning',
  cancelled: 'error',
  completed: 'neutral',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function UpdateBubble({ update, onRead }: { update: TripUpdate; onRead: (id: string) => void }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const isTargeted = !!update.registration_id;

  return (
    <TouchableOpacity
      style={[s.bubble, !update.read && s.bubbleUnread]}
      onPress={() => { if (!update.read) onRead(update.id); }}
      activeOpacity={0.85}
    >
      <View style={s.bubbleHeader}>
        <View style={s.bubbleTitleRow}>
          {isTargeted && (
            <View style={s.targetedBadge}>
              <Ionicons name="person" size={10} color={colors.primary} />
            </View>
          )}
          <Text style={s.bubbleTitle}>{update.title}</Text>
        </View>
        <View style={s.bubbleRight}>
          <Text style={s.bubbleTime}>
            {new Date(update.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
          {!update.read && <View style={s.unreadDot} />}
        </View>
      </View>
      <Text style={s.bubbleBody}>{update.body}</Text>
    </TouchableOpacity>
  );
}

export default function BookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const { data: registration, isLoading } = useRegistration(registrationId ?? null);
  const { data: updates } = useTripUpdates(registration?.trip_id ?? null);
  const markRead = useMarkUpdateRead();
  const [copied, setCopied] = useState(false);

  const bookingRef = registration?.booking_reference ?? `BOOK-${registrationId?.slice(0, 8).toUpperCase()}`;

  const handleCopy = useCallback(() => {
    Clipboard.setString(bookingRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [bookingRef]);

  const handleMarkRead = useCallback((updateId: string) => {
    markRead.mutate(updateId);
  }, [markRead]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name={i18n.language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Skeleton height={24} width="60%" />
          <Skeleton height={16} width="40%" />
          <Skeleton height={120} />
          <Skeleton height={80} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!registration) {
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

  const trip = registration.trip;
  const tripName = (i18n.language === 'ar' ? (trip.name_ar || trip.name_en) : (trip.name_en || trip.name_ar)) || 'Trip';
  const startDate = new Date(trip.start_date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endDate = new Date(trip.end_date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const statusVariant = STATUS_VARIANTS[registration.status] ?? 'neutral';
  const statusLabel = t(`bookings.status.${registration.status}` as any, { defaultValue: registration.status });
  const unreadCount = updates?.filter((u) => !u.read).length ?? 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name={i18n.language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{tripName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Status + Ref */}
        <View style={s.card}>
          <View style={s.cardTopRow}>
            <Badge label={statusLabel} variant={statusVariant} />
            <TouchableOpacity style={s.refRow} onPress={handleCopy}>
              <Text style={s.refValue}>{bookingRef}</Text>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? colors.success : colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={s.tripName}>{tripName}</Text>
          <Text style={s.providerName}>{trip.provider?.company_name}</Text>
        </View>

        {/* Trip Details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('trip.details') ?? 'Trip Details'}</Text>
          <View style={s.infoCard}>
            <InfoRow label={t('bookings.booked', { date: '' }).replace(' ', '')} value={new Date(registration.registration_date).toLocaleDateString()} />
            <View style={s.divider} />
            <InfoRow label={t('trip.startDate') ?? 'Start Date'} value={startDate} />
            <View style={s.divider} />
            <InfoRow label={t('trip.endDate') ?? 'End Date'} value={endDate} />
            <View style={s.divider} />
            <InfoRow label={t('booking.participants')} value={String(registration.total_participants)} />
            <View style={s.divider} />
            <InfoRow label={t('booking.totalAmount')} value={`${Number(registration.total_amount).toLocaleString()} SAR`} />
          </View>
        </View>

        {/* Participants */}
        {registration.participants?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('booking.participantDetails')}</Text>
            {registration.participants.map((p, i) => (
              <View key={p.id} style={s.participantCard}>
                <Text style={s.participantTitle}>{t('booking.participant', { number: i + 1 })}</Text>
                {p.name && <InfoRow label={t('common.name') ?? 'Name'} value={p.name} />}
                {p.email && <InfoRow label="Email" value={p.email} />}
                {p.phone && <InfoRow label={t('common.phone') ?? 'Phone'} value={p.phone} />}
                {p.date_of_birth && <InfoRow label={t('common.dob') ?? 'Date of Birth'} value={p.date_of_birth} />}
                {p.gender && <InfoRow label={t('common.gender') ?? 'Gender'} value={p.gender} />}
                {p.passport_number && <InfoRow label="Passport" value={p.passport_number} />}
                {p.national_id && <InfoRow label="National ID" value={p.national_id} />}
              </View>
            ))}
          </View>
        )}

        {/* Trip Updates */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>{t('trip.updates') ?? 'Trip Updates'}</Text>
            {unreadCount > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {!updates || updates.length === 0 ? (
            <View style={s.emptyUpdates}>
              <Ionicons name="notifications-outline" size={32} color={colors.gray300} />
              <Text style={s.emptyUpdatesText}>{t('trip.noUpdates') ?? 'No updates yet'}</Text>
            </View>
          ) : (
            <View style={s.updatesList}>
              {updates.map((u) => (
                <UpdateBubble key={u.id} update={u} onRead={handleMarkRead} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    errorText: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary, flex: 1, textAlign: 'center' },
    scroll: { padding: 16, gap: 0 },
    card: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 20, ...Shadow.sm, gap: 6 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    refRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    refValue: { fontSize: FontSize.sm, fontWeight: '700', color: c.primary, fontFamily: 'monospace' },
    tripName: { fontSize: FontSize.xl, fontWeight: '800', color: c.textPrimary },
    providerName: { fontSize: FontSize.sm, color: c.textTertiary },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: c.textPrimary, marginBottom: 12 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    infoCard: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, ...Shadow.sm },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    infoLabel: { fontSize: FontSize.sm, color: c.textSecondary },
    infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: c.textPrimary, flex: 1, textAlign: 'right' },
    divider: { height: 1, backgroundColor: c.border },
    participantCard: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 10, ...Shadow.sm },
    participantTitle: { fontSize: FontSize.md, fontWeight: '700', color: c.primary, marginBottom: 8 },
    updatesList: { gap: 10 },
    bubble: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 14, ...Shadow.sm, borderLeftWidth: 3, borderLeftColor: c.border },
    bubbleUnread: { borderLeftColor: c.primary, backgroundColor: c.primarySurface },
    bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    bubbleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    bubbleTitle: { fontSize: FontSize.md, fontWeight: '700', color: c.textPrimary, flex: 1 },
    bubbleRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    bubbleTime: { fontSize: FontSize.xs, color: c.textTertiary },
    bubbleBody: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20 },
    targetedBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
    unreadBadge: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
    unreadBadgeText: { color: c.white, fontSize: FontSize.xs, fontWeight: '700' },
    emptyUpdates: { alignItems: 'center', paddingVertical: 32, gap: 8 },
    emptyUpdatesText: { fontSize: FontSize.sm, color: c.textTertiary },
  });
}
