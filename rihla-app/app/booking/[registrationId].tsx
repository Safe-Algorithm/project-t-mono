import React, { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Clipboard, Linking, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Image,
} from 'react-native';
import Toast from '../../components/ui/Toast';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRegistration, useTripUpdates, useMarkUpdateRead, usePreparePayment, useConfirmPayment, useTrip, CardDetails } from '../../hooks/useTrips';
import apiClient from '../../lib/api';
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
  awaiting_provider: 'warning',
  processing: 'primary',
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

function UpdateBubble({ update, onRead, highlighted }: { update: TripUpdate; onRead: (id: string) => void; highlighted?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const isTargeted = !!update.registration_id;
  const isImage = (att: { url: string; content_type?: string }) => att.content_type?.startsWith('image/') ?? /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url);

  return (
    <TouchableOpacity
      style={[s.bubble, !update.read && s.bubbleUnread, highlighted && s.bubbleHighlighted]}
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
      {update.is_important && (
        <View style={s.importantBadge}>
          <Text style={s.importantBadgeText}>{t('trip.important')}</Text>
        </View>
      )}
      <Text style={s.bubbleBody}>{update.message}</Text>
      {update.attachments && update.attachments.length > 0 && (
        <View style={s.attachments}>
          {update.attachments.map((att, i) => (
            isImage(att) ? (
              <TouchableOpacity key={i} onPress={() => Linking.openURL(att.url)} activeOpacity={0.85}>
                <Image source={{ uri: att.url }} style={s.attachImage} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={i} style={s.attachFile} onPress={() => Linking.openURL(att.url)} activeOpacity={0.85}>
                <Ionicons name="document-outline" size={18} color={colors.primary} />
                <Text style={s.attachFileName} numberOfLines={1}>{att.filename || 'Attachment'}</Text>
                <Ionicons name="download-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            )
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function BookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { registrationId, autoPayment, focusUpdateId } = useLocalSearchParams<{ registrationId: string; autoPayment?: string; focusUpdateId?: string }>();
  const { data: registration, isLoading } = useRegistration(registrationId ?? null);
  const { data: updates } = useTripUpdates(registration?.trip_id ?? null);
  const { data: tripDetail } = useTrip(registration?.trip_id ?? null);
  const markRead = useMarkUpdateRead();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [card, setCard] = useState<CardDetails>({ name: '', number: '', month: 0, year: 0, cvc: '' });
  const [cardErrors, setCardErrors] = useState<Partial<Record<keyof CardDetails, string>>>({});
  const [cardNumberDisplay, setCardNumberDisplay] = useState('');
  const preparePayment = usePreparePayment();
  const confirmPayment = useConfirmPayment();
  const autoPaymentTriggered = useRef(false);
  const [spotSecondsLeft, setSpotSecondsLeft] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const updateSectionRef = useRef<View>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ refundPct: number; refundAmt: number } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  // Scroll to updates section when arriving from bell with a focusUpdateId
  useEffect(() => {
    if (focusUpdateId && updates && updates.length > 0) {
      setTimeout(() => {
        updateSectionRef.current?.measureLayout(
          scrollViewRef.current as any,
          (_x, y) => { scrollViewRef.current?.scrollTo({ y, animated: true }); },
          () => {}
        );
      }, 400);
    }
  }, [focusUpdateId, updates]);

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

  const handleCancelBooking = useCallback(async () => {
    if (!registrationId || !registration?.trip_id) return;
    setCancelling(true);
    try {
      const { data } = await apiClient.post(
        `/trips/${registration.trip_id}/registrations/${registrationId}/cancel`,
        { reason: cancelReason || undefined },
      );
      setShowCancelModal(false);
      qc.invalidateQueries({ queryKey: ['registrations', 'me'] });
      qc.invalidateQueries({ queryKey: ['registrations', registrationId] });
      const pct: number = data.refund_percentage;
      const amt: number = data.refund_amount;
      setCancelResult({ refundPct: pct, refundAmt: amt });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setToastMessage(typeof detail === 'string' ? detail : t('booking.cancelError'));
      setToastVisible(true);
    } finally {
      setCancelling(false);
    }
  }, [registrationId, registration?.trip_id, cancelReason, qc, t]);

  const validateCard = () => {
    const errs: Partial<Record<keyof CardDetails, string>> = {};
    if (!card.name.trim()) errs.name = t('booking.cardNameRequired', 'Name on card is required');
    const digits = card.number.replace(/\D/g, '');
    if (!digits || digits.length < 13 || digits.length > 19) errs.number = t('booking.cardNumberInvalid', 'Enter a valid card number');
    const m = card.month;
    if (!m || m < 1 || m > 12) errs.month = t('booking.cardMonthInvalid', 'MM (1–12)');
    const y = card.year;
    const currentYY = new Date().getFullYear() % 100;
    if (!y || y < currentYY || y > currentYY + 20) errs.year = t('booking.cardYearInvalid', 'YY');
    if (!card.cvc || card.cvc.length < 3) errs.cvc = t('booking.cardCvcInvalid', '3–4 digits');
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePayNow = useCallback(async () => {
    if (!registrationId) return;
    if (!validateCard()) return;
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
      const publishableKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY ?? '';
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
        const rawMsg: string = moyasarData?.message ?? moyasarData?.errors?.number?.[0] ?? moyasarData?.errors?.cvc?.[0] ?? '';
        const knownErrors: Record<string, string> = {
          'Invalid card number': t('booking.cardNumberInvalid', 'Invalid card number'),
          'invalid_number': t('booking.cardNumberInvalid', 'Invalid card number'),
          'invalid_expiry_month': t('booking.cardMonthInvalid', 'Invalid expiry month'),
          'invalid_expiry_year': t('booking.cardYearInvalid', 'Invalid expiry year'),
          'invalid_cvc': t('booking.cardCvcInvalid', 'Invalid CVV'),
          'card_declined': t('booking.cardDeclined', 'Card was declined. Please try a different card.'),
          'insufficient_funds': t('booking.cardInsufficientFunds', 'Insufficient funds on card.'),
          'Data Validation failed': t('booking.cardValidationFailed', 'Card details are invalid. Please check and try again.'),
        };
        const displayMsg = Object.entries(knownErrors).find(([k]) => rawMsg.toLowerCase().includes(k.toLowerCase()))?.[1] ?? (rawMsg || t('common.error'));
        setShowCardModal(true);
        Alert.alert(t('booking.paymentFailed', 'Payment Failed'), displayMsg);
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

      <ScrollView ref={scrollViewRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Status + Ref */}
        <View style={s.card}>
          <View style={s.cardTopRow}>
            <Badge label={statusLabel} variant={statusVariant} />
            <TouchableOpacity style={s.refRow} onPress={handleCopy}>
              <Text style={s.refValue}>{bookingRef}</Text>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? colors.success : colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => registration.trip_id && router.push(`/trip/${registration.trip_id}` as any)} activeOpacity={0.7}>
            <View style={s.tripNameRow}>
              <Text style={s.tripName}>{tripName}</Text>
              <Ionicons name={i18n.language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <Text style={s.providerName}>{trip?.provider?.company_name}</Text>
        </View>

        {/* Status info banner for self-arranged trip states */}
        {registration.status === 'awaiting_provider' && (
          <View style={s.awaitingCard}>
            <View style={s.statusIconRow}>
              <Ionicons name="hourglass-outline" size={26} color='#EA580C' />
              <Text style={s.awaitingTitle}>{t('bookings.statusInfoTitle.awaiting_provider' as any)}</Text>
            </View>
            <Text style={s.statusInfoText}>{t('bookings.statusInfo.awaiting_provider' as any)}</Text>
            <Text style={s.autoCancelText}>{t('bookings.autoCancelWarning' as any)}</Text>
          </View>
        )}

        {registration.status === 'processing' && (
          <View style={s.processingCard}>
            <View style={s.statusIconRow}>
              <Ionicons name="sync-circle-outline" size={26} color={colors.primary} />
              <Text style={s.processingTitle}>{t('bookings.statusInfoTitle.processing' as any)}</Text>
            </View>
            <Text style={s.statusInfoText}>{t('bookings.statusInfo.processing' as any)}</Text>
          </View>
        )}

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
              onPress={() => { if (!payLoading) setShowCardModal(true); }}
              loading={payLoading}
              disabled={payLoading}
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
                    style={[s.cardInput, cardErrors.name ? s.cardInputError : undefined]}
                    value={card.name}
                    onChangeText={(v) => { setCard((c) => ({ ...c, name: v })); setCardErrors((e) => ({ ...e, name: undefined })); }}
                    placeholder="John Doe"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                  />
                  {cardErrors.name ? <Text style={s.cardFieldError}>{cardErrors.name}</Text> : null}
                  <Text style={s.cardLabel}>{t('booking.cardNumber')}</Text>
                  <TextInput
                    style={[s.cardInput, cardErrors.number ? s.cardInputError : undefined]}
                    value={cardNumberDisplay}
                    onChangeText={(v) => {
                      const digits = v.replace(/\D/g, '').slice(0, 16);
                      const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
                      setCardNumberDisplay(formatted);
                      setCard((c) => ({ ...c, number: digits }));
                      setCardErrors((e) => ({ ...e, number: undefined }));
                    }}
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                  {cardErrors.number ? <Text style={s.cardFieldError}>{cardErrors.number}</Text> : null}
                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardLabel}>{t('booking.cardMonth')}</Text>
                      <TextInput
                        style={[s.cardInput, cardErrors.month ? s.cardInputError : undefined]}
                        value={card.month ? String(card.month).padStart(2, '0') : ''}
                        onChangeText={(v) => { setCard((c) => ({ ...c, month: parseInt(v) || 0 })); setCardErrors((e) => ({ ...e, month: undefined })); }}
                        placeholder="MM"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      {cardErrors.month ? <Text style={s.cardFieldError}>{cardErrors.month}</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardLabel}>{t('booking.cardYear')}</Text>
                      <TextInput
                        style={[s.cardInput, cardErrors.year ? s.cardInputError : undefined]}
                        value={card.year ? String(card.year) : ''}
                        onChangeText={(v) => { setCard((c) => ({ ...c, year: parseInt(v) || 0 })); setCardErrors((e) => ({ ...e, year: undefined })); }}
                        placeholder="YY"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      {cardErrors.year ? <Text style={s.cardFieldError}>{cardErrors.year}</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardLabel}>{t('booking.cardCvc')}</Text>
                      <TextInput
                        style={[s.cardInput, cardErrors.cvc ? s.cardInputError : undefined]}
                        value={card.cvc}
                        onChangeText={(v) => { setCard((c) => ({ ...c, cvc: v })); setCardErrors((e) => ({ ...e, cvc: undefined })); }}
                        placeholder="CVV"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                      />
                      {cardErrors.cvc ? <Text style={s.cardFieldError}>{cardErrors.cvc}</Text> : null}
                    </View>
                  </View>
                </View>
                <Button title={t('booking.payNow')} onPress={handlePayNow} loading={payLoading} disabled={payLoading} fullWidth size="lg" />
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
            {registration.participants.map((p, i) => {
              const pkgName = p.package_id && tripDetail?.packages
                ? (() => {
                    const pkg = tripDetail.packages.find((pk) => pk.id === p.package_id);
                    if (!pkg) return null;
                    return (i18n.language === 'ar' ? (pkg.name_ar || pkg.name_en) : (pkg.name_en || pkg.name_ar)) || null;
                  })()
                : null;
              return (
                <View key={p.id} style={s.participantCard}>
                  <View style={s.participantTitleRow}>
                    <Text style={s.participantTitle}>{t('booking.participant', { number: i + 1 })}</Text>
                    {pkgName && (
                      <View style={s.pkgBadge}>
                        <Text style={s.pkgBadgeText}>{pkgName}</Text>
                      </View>
                    )}
                  </View>
                  {p.name && <InfoRow label={t('common.name')} value={p.name} />}
                  {p.email && <InfoRow label="Email" value={p.email} />}
                  {p.phone && <InfoRow label={t('common.phone')} value={p.phone} />}
                  {p.date_of_birth && <InfoRow label={t('common.dob')} value={p.date_of_birth} />}
                  {p.gender && <InfoRow label={t('common.gender')} value={p.gender} />}
                  {p.passport_number && <InfoRow label={t('common.passport')} value={p.passport_number} />}
                  {p.id_iqama_number && <InfoRow label={t('common.nationalId')} value={p.id_iqama_number} />}
                </View>
              );
            })}
          </View>
        )}

        {/* Refund policy disclosure — shown for active bookings */}
        {registration.status !== 'cancelled' && registration.status !== 'pending_payment' && tripDetail && (
          <View style={tripDetail.is_refundable === false ? s.nonRefundableCard : s.refundablePolicyCard}>
            <View style={s.policyTitleRow}>
              <Ionicons
                name={tripDetail.is_refundable === false ? 'close-circle' : 'shield-checkmark-outline'}
                size={18}
                color={tripDetail.is_refundable === false ? '#DC2626' : '#166534'}
              />
              <Text style={tripDetail.is_refundable === false ? s.nonRefundablePolicyTitle : s.refundablePolicyTitle}>
                {t('booking.refundPolicy')}
              </Text>
            </View>
            {tripDetail.is_refundable === false ? (
              <Text style={s.policyBody}>{t('booking.nonRefundableCheckout')}</Text>
            ) : tripDetail.trip_type === 'self_arranged' ? (
              <>
                <Text style={s.policyBody}>{t('booking.refundableCheckout')}</Text>
                <Text style={s.policyRule}>{'• '}{t('booking.refundRuleSelfArrangedPre')}</Text>
                <Text style={s.policyRule}>{'• '}{t('booking.refundRuleSelfArrangedPost')}</Text>
                <Text style={s.policyCooling}>{'⏱ '}{t('booking.coolingOff')}</Text>
              </>
            ) : (
              <>
                <Text style={s.policyBody}>{t('booking.refundableCheckout')}</Text>
                <Text style={s.policyRule}>{'• '}{t('booking.refundRule72h')}</Text>
                <Text style={s.policyRule}>{'• '}{t('booking.refundRule12to72h')}</Text>
                <Text style={s.policyRule}>{'• '}{t('booking.refundRuleLess12h')}</Text>
                <Text style={s.policyCooling}>{'⏱ '}{t('booking.coolingOff')}</Text>
              </>
            )}
          </View>
        )}

        {/* Cancel booking button — shown for active bookings and unpaid pending spots */}
        {['awaiting_provider', 'processing', 'confirmed', 'pending_payment'].includes(registration.status) && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCancelModal(true)} activeOpacity={0.8}>
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={s.cancelBtnText}>
              {registration.status === 'pending_payment' ? t('booking.cancelPendingPayment') : t('booking.cancelBooking')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Cancel confirmation modal */}
        <Modal visible={showCancelModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            <Pressable style={s.modalOverlay} onPress={() => setShowCancelModal(false)}>
              <Pressable style={s.cardModal} onPress={(e) => e.stopPropagation()}>
                <View style={s.cardModalHandle} />
                <View style={s.cancelModalTitleRow}>
                  <Ionicons name="warning-outline" size={22} color="#DC2626" />
                  <Text style={s.cancelModalTitle}>{t('booking.cancelConfirmTitle')}</Text>
                </View>
                <Text style={s.cancelModalMsg}>{t('booking.cancelConfirmMessage')}</Text>
                <Text style={s.cardLabel}>{t('booking.cancelReason')}</Text>
                <TextInput
                  style={[s.cardInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder={t('booking.cancelReasonPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />
                <View style={{ gap: 10, marginTop: 4 }}>
                  <Button
                    title={cancelling ? t('booking.cancelling') : t('booking.cancelBooking')}
                    onPress={handleCancelBooking}
                    loading={cancelling}
                    disabled={cancelling}
                    fullWidth
                    size="lg"
                    variant="outline"
                  />
                  <Button
                    title={t('common.back')}
                    onPress={() => setShowCancelModal(false)}
                    fullWidth
                    size="lg"
                  />
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Cancellation result card — replaces popup Alert */}
        {cancelResult && (
          <View style={s.cancelResultCard}>
            <View style={s.cancelResultIconRow}>
              <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
              <Text style={s.cancelResultTitle}>{t('booking.cancelSuccess')}</Text>
            </View>
            {cancelResult.refundPct > 0 ? (
              <>
                <Text style={s.cancelResultBody}>
                  {t('booking.cancelRefundInfo', { percentage: cancelResult.refundPct, amount: Number(cancelResult.refundAmt).toLocaleString() })}
                </Text>
                <View style={s.cancelResultTimeline}>
                  <Ionicons name="time-outline" size={16} color="#6B7280" />
                  <Text style={s.cancelResultTimelineText}>{t('booking.refundTimeline', 'Refund will be processed within 3–7 business days.')}</Text>
                </View>
              </>
            ) : (
              <Text style={s.cancelResultBody}>{t('booking.cancelNoRefund')}</Text>
            )}
            <TouchableOpacity style={s.cancelResultDismiss} onPress={() => setCancelResult(null)}>
              <Text style={s.cancelResultDismissText}>{t('common.ok', 'OK')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Trip Updates */}
        <View style={s.section} ref={updateSectionRef}>
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
                <UpdateBubble key={u.id} update={u} onRead={handleMarkRead} highlighted={u.id === focusUpdateId} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="error"
        onHide={() => setToastVisible(false)}
      />
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
    tripNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tripName: { fontSize: FontSize.xl, fontWeight: '800', color: c.textPrimary, flex: 1 },
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
    participantTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    participantTitle: { fontSize: FontSize.md, fontWeight: '700', color: c.primary },
    pkgBadge: { backgroundColor: c.primarySurface, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    pkgBadgeText: { fontSize: FontSize.xs, color: c.primary, fontWeight: '700' },
    updatesList: { gap: 10 },
    bubble: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 14, ...Shadow.sm, borderLeftWidth: 3, borderLeftColor: c.border },
    bubbleUnread: { borderLeftColor: c.primary, backgroundColor: c.primarySurface },
    bubbleHighlighted: { borderWidth: 2, borderColor: c.primary },
    importantBadge: { alignSelf: 'flex-start', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginBottom: 6 },
    importantBadgeText: { fontSize: FontSize.xs, color: '#DC2626', fontWeight: '700' },
    attachments: { marginTop: 10, gap: 8 },
    attachImage: { width: '100%', height: 180, borderRadius: Radius.lg },
    attachFile: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.background, borderRadius: Radius.lg, padding: 10, borderWidth: 1, borderColor: c.border },
    attachFileName: { flex: 1, fontSize: FontSize.sm, color: c.primary, fontWeight: '600' },
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
    awaitingCard: { backgroundColor: '#FFF7ED', borderRadius: Radius.xl, padding: 16, marginBottom: 20, gap: 8, ...Shadow.sm, borderLeftWidth: 4, borderLeftColor: '#EA580C' },
    awaitingTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#EA580C', flex: 1 },
    processingCard: { backgroundColor: c.primarySurface, borderRadius: Radius.xl, padding: 16, marginBottom: 20, gap: 8, ...Shadow.sm, borderLeftWidth: 4, borderLeftColor: c.primary },
    processingTitle: { fontSize: FontSize.lg, fontWeight: '800', color: c.primary, flex: 1 },
    statusIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusInfoText: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20 },
    autoCancelText: { fontSize: FontSize.xs, color: '#EA580C', lineHeight: 18, fontStyle: 'italic' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    cardModal: { backgroundColor: c.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: 24, paddingBottom: 40, gap: 16, ...Shadow.lg },
    cardModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.gray200, alignSelf: 'center', marginBottom: 8 },
    cardModalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    cardFields: { gap: 12 },
    cardLabel: { fontSize: FontSize.sm, fontWeight: '600', color: c.textSecondary, marginBottom: 4 },
    cardInput: { borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.md, color: c.textPrimary, backgroundColor: c.background },
    cardInputError: { borderColor: c.error },
    cardFieldError: { fontSize: FontSize.xs, color: c.error, marginTop: 2 },
    cardRow: { flexDirection: 'row', gap: 10 },

    cancelResultCard: { backgroundColor: '#F0FDF4', borderRadius: Radius.xl, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#16A34A20', gap: 12 },
    cancelResultIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cancelResultTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#166534' },
    cancelResultBody: { fontSize: FontSize.sm, color: '#166534', lineHeight: 20 },
    cancelResultTimeline: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#DCFCE7', borderRadius: Radius.md, padding: 10 },
    cancelResultTimelineText: { fontSize: FontSize.xs, color: '#166534', flex: 1, lineHeight: 18 },
    cancelResultDismiss: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#16A34A', borderRadius: Radius.full },
    cancelResultDismissText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
    cancelBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1.5, borderColor: '#DC2626', borderRadius: Radius.xl,
      paddingVertical: 14, marginBottom: 16, backgroundColor: '#FEF2F2',
    },
    cancelBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#DC2626' },
    cancelModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    cancelModalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#DC2626', flex: 1 },
    cancelModalMsg: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20, marginBottom: 12 },

    nonRefundableCard: {
      backgroundColor: '#FEF2F2', borderRadius: Radius.xl,
      borderWidth: 1.5, borderColor: '#FECACA',
      padding: 14, marginBottom: 16,
    },
    refundablePolicyCard: {
      backgroundColor: '#F0FDF4', borderRadius: Radius.xl,
      borderWidth: 1, borderColor: '#BBF7D0',
      padding: 14, marginBottom: 16,
    },
    policyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    nonRefundablePolicyTitle: { fontSize: FontSize.md, fontWeight: '700', color: '#DC2626', flex: 1 },
    refundablePolicyTitle: { fontSize: FontSize.md, fontWeight: '700', color: '#166534', flex: 1 },
    policyBody: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20, marginBottom: 6 },
    policyRule: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20, marginLeft: 4 },
    policyCooling: { fontSize: FontSize.xs, color: c.textTertiary, lineHeight: 18, marginTop: 6, fontStyle: 'italic' },
  });
}
