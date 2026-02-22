import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTrip, useFieldMetadata, useMyRegistrations } from '../../hooks/useTrips';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import Button from '../../components/ui/Button';
import ParticipantField, { FieldType } from '../../components/booking/ParticipantField';
import apiClient from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface Participant {
  [fieldType: string]: string;
}

export default function BookingScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { tripId, packageId } = useLocalSearchParams<{ tripId: string; packageId: string }>();
  const { data: trip, isLoading: tripLoading } = useTrip(tripId);
  const { data: fieldMetadata } = useFieldMetadata();
  const qc = useQueryClient();
  const [participantCount, setParticipantCount] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([{}]);
  const [loading, setLoading] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [step, setStep] = useState<'participants' | 'confirm'>('participants');

  const selectedPackage = trip?.packages?.find((p) => p.id === packageId);
  const requiredFields = (selectedPackage?.required_fields ?? []).map((ft) => ({
    field_type: ft as FieldType,
    is_required: true,
    validation_config: (selectedPackage as any)?.required_fields_details?.find((d: any) => d.field_type === ft)?.validation_config ?? null,
  }));
  const totalPrice = selectedPackage ? Number(selectedPackage.price) * participantCount : 0;

  const updateParticipant = (index: number, field: string, value: string) => {
    setParticipants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const changeCount = (delta: number) => {
    const newCount = Math.max(1, Math.min(10, participantCount + delta));
    setParticipantCount(newCount);
    setParticipants((prev) => {
      if (newCount > prev.length) {
        return [...prev, ...Array(newCount - prev.length).fill({})];
      }
      return prev.slice(0, newCount);
    });
  };

  const validate = () => {
    for (let i = 0; i < participantCount; i++) {
      for (const field of requiredFields) {
        if (field.is_required && !participants[i]?.[field.field_type]?.trim()) {
          Alert.alert(
            t('common.error'),
            `${t(`fields.${field.field_type}` as any, { defaultValue: field.field_type.replace(/_/g, ' ') })} - ${t('booking.participant', { number: i + 1 })}`
          );
          return false;
        }
      }
    }
    return true;
  };

  const handleBook = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const pricePerPerson = selectedPackage ? Number(selectedPackage.price) : 0;
      const payload = {
        total_participants: participantCount,
        total_amount: (pricePerPerson * participantCount).toFixed(2),
        participants: participants.slice(0, participantCount).map((p, i) => ({
          package_id: packageId,
          is_registration_user: i === 0,
          ...p,
        })),
      };
      const { data: registration } = await apiClient.post(`/trips/${tripId}/register`, payload);

      // Invalidate list so My Trips tab shows the new booking immediately
      qc.invalidateQueries({ queryKey: ['registrations', 'me'] });

      // Go straight to booking detail with autoPayment=true — card modal opens immediately
      router.replace(`/booking/${registration.id}?autoPayment=true`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? (detail[0]?.msg ?? t('common.error'))
        : (typeof detail === 'string' ? detail : t('common.error'));
      if (detail === 'You already have an active registration for this trip. Check your bookings.') {
        setAlreadyRegistered(true);
      } else {
        Alert.alert(t('booking.title'), msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (tripLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="time-outline" size={48} color={colors.gray300} />
          <Text style={s.errorText}>{t('booking.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (alreadyRegistered) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
          <Text style={s.errorText}>{t('booking.alreadyRegistered')}</Text>
          <Button title={t('booking.viewBookings')} onPress={() => router.replace('/(tabs)/bookings')} />
          <Button title={t('trip.goBack')} onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  if (!trip || !selectedPackage) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.gray300} />
          <Text style={s.errorText}>{t('trip.noPackages')}</Text>
          <Button title={t('trip.goBack')} onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const tripName = (i18n.language === 'ar' ? (trip.name_ar || trip.name_en) : (trip.name_en || trip.name_ar)) || 'Trip';
  const pkgName = (i18n.language === 'ar' ? (selectedPackage.name_ar || selectedPackage.name_en) : (selectedPackage.name_en || selectedPackage.name_ar)) || 'Package';

  return (
    <View style={s.container}>
    <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name={i18n.language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('booking.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.progress}>
          <View style={[s.progressStep, s.progressStepActive]}>
            <Text style={s.progressStepText}>1</Text>
          </View>
          <View style={[s.progressLine, step === 'confirm' && s.progressLineActive]} />
          <View style={[s.progressStep, step === 'confirm' && s.progressStepActive]}>
            <Text style={[s.progressStepText, step !== 'confirm' && s.progressStepTextInactive]}>2</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        <View style={s.summaryCard}>
          <Text style={s.summaryTrip} numberOfLines={1}>{tripName}</Text>
          <Text style={s.summaryPkg}>{pkgName}</Text>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>{t('booking.perPerson')}</Text>
            <Text style={s.summaryPrice}>{t('booking.priceFormat', { price: Number(selectedPackage.price).toLocaleString() })}</Text>
          </View>
        </View>

        {step === 'participants' && (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('booking.participants')}</Text>
              <View style={s.counterRow}>
                <TouchableOpacity style={[s.counterBtn, participantCount <= 1 && s.counterBtnDisabled]} onPress={() => changeCount(-1)} disabled={participantCount <= 1}>
                  <Ionicons name="remove" size={20} color={participantCount <= 1 ? colors.gray300 : colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.counterValue}>{participantCount}</Text>
                <TouchableOpacity style={[s.counterBtn, participantCount >= 10 && s.counterBtnDisabled]} onPress={() => changeCount(1)} disabled={participantCount >= 10}>
                  <Ionicons name="add" size={20} color={participantCount >= 10 ? colors.gray300 : colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
            {Array.from({ length: participantCount }, (_, i) => (
              <View key={i} style={s.section}>
                <Text style={s.sectionTitle}>{t('booking.participant', { number: i + 1 })}</Text>
                {requiredFields.length === 0 ? (
                  <Text style={s.noFields}>{t('booking.package')}</Text>
                ) : (
                  <View style={s.fields}>
                    {requiredFields.map((field) => (
                      <ParticipantField
                        key={field.field_type}
                        fieldType={field.field_type}
                        value={participants[i]?.[field.field_type] ?? ''}
                        onChange={(v) => updateParticipant(i, field.field_type, v)}
                        isRequired={field.is_required}
                        metadata={fieldMetadata?.[field.field_type]}
                        allowedGenders={field.validation_config?.gender_restrictions?.allowed_genders}
                      />
                    ))}
                  </View>
                )}
              </View>
            ))}
            <Button title={t('common.confirm')} onPress={() => { if (validate()) setStep('confirm'); }} fullWidth size="lg" style={s.continueBtn} />
          </>
        )}

        {step === 'confirm' && (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('booking.confirmBooking')}</Text>
              <View style={s.confirmCard}>
                <ConfirmRow label={t('explore.subtitle')} value={tripName} s={s} />
                <ConfirmRow label={t('booking.package')} value={pkgName} s={s} />
                <ConfirmRow label={t('booking.participants')} value={String(participantCount)} s={s} />
                <ConfirmRow label={t('booking.perPerson')} value={t('booking.priceFormat', { price: Number(selectedPackage.price).toLocaleString() })} s={s} />
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>{t('booking.totalAmount')}</Text>
                  <Text style={s.totalValue}>{t('booking.priceFormat', { price: totalPrice.toLocaleString() })}</Text>
                </View>
              </View>
            </View>
            <View style={s.section}>
              <View style={s.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                <Text style={s.infoText}>{t('booking.paymentRedirectInfo')}</Text>
              </View>
            </View>
            <View style={s.actionRow}>
              <Button title={t('common.back')} variant="outline" onPress={() => setStep('participants')} style={s.backActionBtn} />
              <Button title={t('booking.confirmBooking')} onPress={handleBook} loading={loading} style={s.payBtn} size="lg" />
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

function ConfirmRow({ label, value, s }: { label: string; value: string; s: any }) {
  return (
    <View style={s.confirmRow}>
      <Text style={s.confirmLabel}>{label}</Text>
      <Text style={s.confirmValue}>{value}</Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    safeArea: { backgroundColor: c.surface },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    errorText: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    progress: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 14, backgroundColor: c.surface },
    progressStep: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.gray200, alignItems: 'center', justifyContent: 'center' },
    progressStepActive: { backgroundColor: c.primary },
    progressStepText: { fontSize: FontSize.sm, fontWeight: '700', color: c.white },
    progressStepTextInactive: { color: c.textTertiary },
    progressLine: { flex: 1, height: 2, backgroundColor: c.gray200, marginHorizontal: 8 },
    progressLineActive: { backgroundColor: c.primary },
    flex1: { flex: 1 },
    scrollView: { flex: 1 },
    scroll: { padding: 16, gap: 0 },
    summaryCard: { backgroundColor: c.primarySurface, borderRadius: Radius.xl, padding: 16, borderLeftWidth: 4, borderLeftColor: c.primary, marginBottom: 20 },
    summaryTrip: { fontSize: FontSize.lg, fontWeight: '800', color: c.textPrimary },
    summaryPkg: { fontSize: FontSize.md, color: c.primary, fontWeight: '600', marginBottom: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { fontSize: FontSize.sm, color: c.textSecondary },
    summaryPrice: { fontSize: FontSize.xl, fontWeight: '800', color: c.accent },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: c.textPrimary, marginBottom: 12 },
    counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
    counterBtnDisabled: { opacity: 0.4 },
    counterValue: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary, minWidth: 32, textAlign: 'center' },
    fields: { gap: 14 },
    noFields: { fontSize: FontSize.md, color: c.textTertiary, fontStyle: 'italic' },
    continueBtn: { marginTop: 8 },
    confirmCard: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, gap: 12, ...Shadow.sm },
    confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    confirmLabel: { fontSize: FontSize.md, color: c.textSecondary },
    confirmValue: { fontSize: FontSize.md, color: c.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    totalLabel: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    totalValue: { fontSize: FontSize.xl, fontWeight: '800', color: c.primary },
    infoBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: c.infoLight ?? '#DBEAFE', borderRadius: Radius.lg, padding: 14 },
    infoText: { flex: 1, fontSize: FontSize.sm, color: c.info, lineHeight: 20 },
    actionRow: { flexDirection: 'row', gap: 12 },
    backActionBtn: { flex: 1 },
    payBtn: { flex: 2 },
  });
}
