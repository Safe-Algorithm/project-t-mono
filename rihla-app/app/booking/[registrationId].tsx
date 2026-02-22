import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Clipboard, Linking, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRegistration, useTripUpdates, useMarkUpdateRead, usePreparePayment, useConfirmPayment, CardDetails } from '../../hooks/useTrips';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { TripUpdate } from '../../types/trip';
import { useQueryClient } from '@tanstack/react-query';

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
  const { registrationId, autoPayment } = useLocalSearchParams<{ registrationId: string; autoPayment?: string }>();
  const { data: registration, isLoading } = useRegistration(registrationId ?? null);
  const { data: updates } = useTripUpdates(registration?.trip_id ?? null);
  const markRead = useMarkUpdateRead();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [card, setCard] = useState<CardDetails>({ name: '', number: '', month: 0, year: 0, cvc: '' });
  const preparePayment = usePreparePayment();
  const confirmPayment = useConfirmPayment();
  const autoPaymentTriggered = useRef(false);
  const [spotSecondsLeft, setSpotSecondsLeft] = useState<number | null>(null);

  // Auto-open card modal when arriving from the booking flow (one-tap pay)
  useEffect(() => {
    if (
      autoPayment === 'true' &&
      !autoPaymentTriggered.current &&
      registration?.status === 'pending_payment'
    ) {
      autoPaymentTriggered.current = true;
      setShowCardModal(true);
    }
  }, [autoPayment, registration?.status]);

  // Live countdown for spot reservation
  useEffect(() => {
    if (registration?.status !== 'pending_payment' || !registration.spot_reserved_until) {
      setSpotSecondsLeft(null);
      return;
    }
    const expiry = new Date(
      registration.spot_reserved_until.endsWith('Z')
        ? registration.spot_reserved_until
        : registration.spot_reserved_until + 'Z'
    ).valueOf();
    const tick = () => setSpotSecondsLeft(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [registration?.status, registration?.spot_reserved_until]);

  const bookingRef = registration?.booking_reference ?? `BOOK-${registrationId?.slice(0, 8).toUpperCase()}`;

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const handleCopy = useCallback(() => {
    Clipboard.setString(bookingRef);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [bookingRef]);

  const handleMarkRead = useCallback((updateId: string) => {
    markRead.mutate(updateId);
  }, [markRead]);

  const handlePayNow = useCallback(async () => {
    if (!registrationId) return;
    if (!card.name || !card.number || !card.month || !card.year || !card.cvc) {
      Alert.alert(t('booking.title'), t('booking.cardRequired'));
      return;
    }
    setShowCardModal(false);
    setPayLoading(true);
    try {
      // Step 1: Get payment details from our backend.
      // We pass our deep link so the backend callback can redirect back here
      // without hardcoding the scheme — the app owns its own URL scheme.
      const prep = await preparePayment.mutateAsync({
        registrationId,
        paymentMethod: 'creditcard',
        redirectUrl: 'rihlaapp://payment-callback',
      });

      // Step 2: Call Moyasar directly from the app with the publishable key
      // Card data never touches our backend (Moyasar policy)
      const publishableKey = process.env.EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY ?? '';
      const moyasarRes = await fetch('https://api.moyasar.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(publishableKey + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: prep.amount_halalas,
          currency: prep.currency,
          description: prep.description,
          callback_url: prep.callback_url,
          source: {
            type: 'creditcard',
            name: card.name,
            number: card.number,
            month: card.month,
            year: card.year,
            cvc: card.cvc,
          },
          metadata: { payment_db_id: prep.payment_db_id },
        }),
      });
      const moyasarData = await moyasarRes.json();
      if (!moyasarRes.ok) {
        const msg = moyasarData?.message || t('common.error');
        Alert.alert(t('booking.title'), msg);
        return;
      }

      // Step 3: Tell our backend the Moyasar payment ID
      await confirmPayment.mutateAsync({
        paymentDbId: prep.payment_db_id,
        moyasarPaymentId: moyasarData.id,
      });

      // Step 4: If 3DS required, open transaction_url; otherwise mark confirmed locally
      const transactionUrl = moyasarData?.source?.transaction_url;
      if (transactionUrl) {
        await Linking.openURL(transactionUrl);
      } else if (moyasarData.status === 'paid') {
        qc.invalidateQueries({ queryKey: ['registrations', 'me'] });
        qc.invalidateQueries({ queryKey: ['registrations', registrationId] });
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      Alert.alert(t('booking.title'), typeof detail === 'string' ? detail : t('common.error'));
    } finally {
      setPayLoading(false);
    }
  }, [registrationId, card, preparePayment, confirmPayment, qc, t]);

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
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const tripName = trip
    ? ((i18n.language === 'ar' ? (trip.name_ar || trip.name_en) : (trip.name_en || trip.name_ar)) || 'Trip')
    : 'Trip';
  const startDate = trip ? new Date(trip.start_date).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const endDate = trip ? new Date(trip.end_date).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
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
          <Text style={s.providerName}>{trip?.provider?.company_name}</Text>
        </View>

        {/* Success banner for confirmed bookings */}
        {registration.status === 'confirmed' && (
          <View style={s.successCard}>
            <View style={s.successIconRow}>
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
              <Text style={s.successTitle}>{t('booking.confirmed')}</Text>
            </View>
            <Text style={s.successSubtitle}>{t('booking.successMessage')}</Text>
          </View>
        )}

        {/* Spot reserved + Pay card — shown when payment is still pending (retry after failure / return from 3DS) */}
        {registration.status === 'pending_payment' && (
          <View style={s.payNowCard}>
            <View style={s.spotReservedRow}>
              <Ionicons name="time-outline" size={18} color={colors.warning ?? '#F59E0B'} />
              <Text style={s.spotReservedText}>
                {spotSecondsLeft !== null && spotSecondsLeft > 0
                  ? t('booking.spotExpiresIn', {
                      minutes: Math.floor(spotSecondsLeft / 60),
                      seconds: spotSecondsLeft % 60,
                    })
                  : spotSecondsLeft === 0
                    ? t('booking.spotExpired')
                    : t('booking.pendingPayment')}
              </Text>
            </View>
            <Button
              title={t('booking.payNow')}
              onPress={() => setShowCardModal(true)}
              loading={payLoading}
              fullWidth
              size="lg"
            />
          </View>
        )}

        {/* Card Input Modal */}
        <Modal visible={showCardModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            <Pressable style={s.modalOverlay} onPress={() => setShowCardModal(false)}>
              <Pressable style={s.cardModal} onPress={(e) => e.stopPropagation()}>
                <View style={s.cardModalHandle} />
                <Text style={s.cardModalTitle}>{t('booking.cardDetails')}</Text>
                <View style={s.cardFields}>
                  <Text style={s.cardLabel}>{t('booking.cardName')}</Text>
                  <TextInput
                    style={s.cardInput}
                    value={card.name}
                    onChangeText={(v) => setCard((c) => ({ ...c, name: v }))}
                    placeholder="John Doe"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                  />
                  <Text style={s.cardLabel}>{t('booking.cardNumber')}</Text>
                  <TextInput
                    style={s.cardInput}
                    value={card.number}
                    onChangeText={(v) => setCard((c) => ({ ...c, number: v.replace(/\s/g, '') }))}
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardLabel}>{t('booking.cardMonth')}</Text>
                      <TextInput
                        style={s.cardInput}
                        value={card.month ? String(card.month) : ''}
                        onChangeText={(v) => setCard((c) => ({ ...c, month: parseInt(v) || 0 }))}
                        placeholder="MM"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardLabel}>{t('booking.cardYear')}</Text>
                      <TextInput
                        style={s.cardInput}
                        value={card.year ? String(card.year) : ''}
                        onChangeText={(v) => setCard((c) => ({ ...c, year: parseInt(v) || 0 }))}
                        placeholder="YYYY"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardLabel}>{t('booking.cardCvc')}</Text>
                      <TextInput
                        style={s.cardInput}
                        value={card.cvc}
                        onChangeText={(v) => setCard((c) => ({ ...c, cvc: v }))}
                        placeholder="CVV"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                      />
                    </View>
                  </View>
                </View>
                <Button title={t('booking.payNow')} onPress={handlePayNow} loading={payLoading} fullWidth size="lg" />
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Trip Details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('trip.details') ?? 'Trip Details'}</Text>
          <View style={s.infoCard}>
            {registration.trip?.trip_reference && (
              <>
                <InfoRow label={t('trip.tripReference')} value={registration.trip.trip_reference} />
                <View style={s.divider} />
              </>
            )}
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
                {p.name && <InfoRow label={t('common.name')} value={p.name} />}
                {p.email && <InfoRow label="Email" value={p.email} />}
                {p.phone && <InfoRow label={t('common.phone')} value={p.phone} />}
                {p.date_of_birth && <InfoRow label={t('common.dob')} value={p.date_of_birth} />}
                {p.gender && <InfoRow label={t('common.gender')} value={p.gender} />}
                {p.passport_number && <InfoRow label={t('common.passport')} value={p.passport_number} />}
                {p.id_iqama_number && <InfoRow label={t('common.nationalId')} value={p.id_iqama_number} />}
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
    payNowCard: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 20, gap: 12, ...Shadow.sm, borderLeftWidth: 4, borderLeftColor: c.warning ?? '#F59E0B' },
    payNowInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    payNowText: { fontSize: FontSize.md, fontWeight: '600', color: c.warning ?? '#F59E0B' },
    spotReservedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    spotReservedText: { fontSize: FontSize.sm, fontWeight: '600', color: c.warning ?? '#F59E0B', flex: 1 },
    successCard: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 20, gap: 8, ...Shadow.sm, borderLeftWidth: 4, borderLeftColor: c.success },
    successIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    successTitle: { fontSize: FontSize.lg, fontWeight: '800', color: c.success },
    successSubtitle: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    cardModal: { backgroundColor: c.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: 24, paddingBottom: 40, gap: 16, ...Shadow.lg },
    cardModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.gray200, alignSelf: 'center', marginBottom: 8 },
    cardModalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    cardFields: { gap: 12 },
    cardLabel: { fontSize: FontSize.sm, fontWeight: '600', color: c.textSecondary, marginBottom: 4 },
    cardInput: { borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.md, color: c.textPrimary, backgroundColor: c.background },
    cardRow: { flexDirection: 'row', gap: 10 },
  });
}
