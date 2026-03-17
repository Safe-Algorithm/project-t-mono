import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Clipboard, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import Button from '../../components/ui/Button';
import { useRegistration } from '../../hooks/useTrips';

export default function BookingSuccessScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const { data: registration } = useRegistration(registrationId ?? null);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    opacity.value = withDelay(300, withSpring(1));
  }, []);

  // Countdown timer for spot reservation
  useEffect(() => {
    if (!registration?.spot_reserved_until) return;
    const update = () => {
      const raw = registration.spot_reserved_until!;
      const utcStr = raw.endsWith('Z') || raw.includes('+') ? raw : raw + 'Z';
      const diff = Math.max(0, Math.floor((new Date(utcStr).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [registration?.spot_reserved_until]);

  const bookingRef = registration?.booking_reference ?? `BOOK-${registrationId?.slice(0, 8).toUpperCase()}`;
  const isConfirmed = registration?.status === 'confirmed';
  const isAwaitingProvider = registration?.status === 'awaiting_provider' || registration?.status === 'processing';
  const isExpired = secondsLeft !== null && secondsLeft === 0 && registration?.status === 'pending_payment';

  const handleCopy = useCallback(() => {
    Clipboard.setString(bookingRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [bookingRef]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: (1 - opacity.value) * 20 }],
  }));

  const minutes = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const seconds = secondsLeft !== null ? secondsLeft % 60 : 0;

  return (
    <View style={s.container}>
      <Animated.View style={[s.iconWrap, iconStyle]}>
        <Ionicons
          name={isConfirmed ? 'checkmark-circle' : isAwaitingProvider ? 'checkmark-circle' : isExpired ? 'close-circle' : 'time'}
          size={100}
          color={isConfirmed ? colors.success : isAwaitingProvider ? colors.primary : isExpired ? colors.error : colors.warning ?? '#F59E0B'}
        />
      </Animated.View>
      <Animated.View style={[s.content, contentStyle]}>
        <Text style={s.title}>
          {isConfirmed ? t('booking.confirmed') : isAwaitingProvider ? t('booking.paymentReceived') : isExpired ? t('booking.spotExpired') : t('booking.successTitle')}
        </Text>
        <Text style={s.subtitle}>
          {isAwaitingProvider ? t('booking.awaitingProviderMessage') : t('booking.successMessage')}
        </Text>

        {/* Booking Reference Card */}
        <View style={s.refCard}>
          <Text style={s.refLabel}>{t('booking.bookingRef')}</Text>
          <View style={s.refRow}>
            <Text style={s.refValue}>{bookingRef}</Text>
            <TouchableOpacity onPress={handleCopy} style={s.copyBtn}>
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={20}
                color={copied ? colors.success : colors.primary}
              />
            </TouchableOpacity>
          </View>
          {copied && <Text style={s.copiedText}>{t('common.done')}</Text>}
        </View>

        {/* Awaiting provider badge */}
        {isAwaitingProvider && (
          <View style={[s.pendingBadge, { backgroundColor: colors.primarySurface ?? '#EFF6FF' }]}>
            <Ionicons name="hourglass-outline" size={14} color={colors.primary} />
            <Text style={[s.pendingText, { color: colors.primary }]}>{t('bookings.status.awaiting_provider')}</Text>
          </View>
        )}

        {/* Countdown timer (only when pending_payment) */}
        {!isConfirmed && !isAwaitingProvider && !isExpired && secondsLeft !== null && (
          <View style={[s.timerBox, { backgroundColor: colors.warning ? `${colors.warning}20` : '#FEF3C7' }]}>
            <Ionicons name="timer-outline" size={16} color={colors.warning ?? '#F59E0B'} />
            <Text style={[s.timerText, { color: colors.warning ?? '#F59E0B' }]}>
              {t('booking.spotExpiresIn', { minutes, seconds: String(seconds).padStart(2, '0') })}
            </Text>
          </View>
        )}

        {/* Status badge */}
        {!isConfirmed && !isAwaitingProvider && !isExpired && (
          <View style={s.pendingBadge}>
            <Ionicons name="card-outline" size={14} color={colors.info} />
            <Text style={s.pendingText}>{t('booking.pendingPayment')}</Text>
          </View>
        )}

        <View style={s.actions}>
          {!isConfirmed && !isAwaitingProvider && registrationId && (
            <Button
              title={t('booking.payNow')}
              onPress={() => router.push({ pathname: '/booking/[registrationId]', params: { registrationId } })}
              fullWidth
              size="lg"
            />
          )}
          {isAwaitingProvider && registrationId && (
            <Button
              title={t('booking.viewBooking')}
              onPress={() => router.replace({ pathname: '/booking/[registrationId]', params: { registrationId } })}
              fullWidth
              size="lg"
            />
          )}
          <Button
            title={t('booking.viewBookings')}
            onPress={() => router.replace('/(tabs)/bookings')}
            fullWidth
            size="lg"
            variant={isConfirmed || isAwaitingProvider ? undefined : 'outline'}
          />
          <Button
            title={t('explore.subtitle')}
            onPress={() => router.replace('/(tabs)')}
            variant="outline"
            fullWidth
          />
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', padding: 32 },
    iconWrap: { marginBottom: 32 },
    content: { alignItems: 'center', gap: 16, width: '100%' },
    title: { fontSize: FontSize.xxxl, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: FontSize.md, color: c.textSecondary, textAlign: 'center', lineHeight: 24 },
    refCard: { backgroundColor: c.gray50, borderRadius: Radius.xl, padding: 20, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: c.border, ...Shadow.sm, gap: 8 },
    refLabel: { fontSize: FontSize.sm, color: c.textTertiary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
    refRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    refValue: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary, letterSpacing: 2 },
    copyBtn: { padding: 6, borderRadius: Radius.md, backgroundColor: c.primarySurface },
    copiedText: { fontSize: FontSize.xs, color: c.success, fontWeight: '600' },
    timerBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
    timerText: { fontSize: FontSize.sm, fontWeight: '700' },
    pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.infoLight ?? '#DBEAFE', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
    pendingText: { fontSize: FontSize.sm, color: c.info, fontWeight: '600' },
    actions: { width: '100%', gap: 12, marginTop: 8 },
  });
}
