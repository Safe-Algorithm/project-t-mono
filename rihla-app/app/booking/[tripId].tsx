import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTrip } from '../../hooks/useTrips';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/Theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import apiClient from '../../lib/api';

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Full Name',
  date_of_birth: 'Date of Birth (YYYY-MM-DD)',
  nationality: 'Nationality',
  passport_number: 'Passport Number',
  national_id: 'National ID',
  iqama_number: 'Iqama Number',
  gender: 'Gender',
  phone_number: 'Phone Number',
  email: 'Email Address',
  emergency_contact_name: 'Emergency Contact Name',
  emergency_contact_phone: 'Emergency Contact Phone',
  dietary_requirements: 'Dietary Requirements',
  medical_conditions: 'Medical Conditions',
  room_preference: 'Room Preference',
  seat_preference: 'Seat Preference',
  special_requests: 'Special Requests',
};

interface Participant {
  [fieldType: string]: string;
}

export default function BookingScreen() {
  const { tripId, packageId } = useLocalSearchParams<{ tripId: string; packageId: string }>();
  const { data: trip } = useTrip(tripId);
  const [participantCount, setParticipantCount] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([{}]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'participants' | 'confirm'>('participants');

  const selectedPackage = trip?.packages?.find((p) => p.id === packageId);
  const requiredFields = selectedPackage?.required_fields_details ?? [];
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
            'Missing Information',
            `Please fill in "${FIELD_LABELS[field.field_type] ?? field.field_type}" for participant ${i + 1}`
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
      const payload = {
        package_id: packageId,
        participants: participants.slice(0, participantCount).map((p) =>
          Object.entries(p).map(([field_type, value]) => ({ field_type, value }))
        ),
      };
      const { data } = await apiClient.post(`/trips/${tripId}/register`, payload);
      router.replace(`/booking/success?registrationId=${data.id}`);
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.response?.data?.detail ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!trip || !selectedPackage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.gray300} />
          <Text style={styles.errorText}>Package not found</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const tripName = trip.name_en ?? trip.name_ar ?? 'Trip';
  const pkgName = selectedPackage.name_en ?? selectedPackage.name_ar ?? 'Package';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Trip</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress */}
        <View style={styles.progress}>
          <View style={[styles.progressStep, styles.progressStepActive]}>
            <Text style={styles.progressStepText}>1</Text>
          </View>
          <View style={[styles.progressLine, step === 'confirm' && styles.progressLineActive]} />
          <View style={[styles.progressStep, step === 'confirm' && styles.progressStepActive]}>
            <Text style={[styles.progressStepText, step !== 'confirm' && styles.progressStepTextInactive]}>2</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Trip summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTrip} numberOfLines={1}>{tripName}</Text>
          <Text style={styles.summaryPkg}>{pkgName}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Price per person</Text>
            <Text style={styles.summaryPrice}>SAR {Number(selectedPackage.price).toLocaleString()}</Text>
          </View>
        </View>

        {step === 'participants' && (
          <>
            {/* Participant count */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Number of Participants</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={[styles.counterBtn, participantCount <= 1 && styles.counterBtnDisabled]}
                  onPress={() => changeCount(-1)}
                  disabled={participantCount <= 1}
                >
                  <Ionicons name="remove" size={20} color={participantCount <= 1 ? Colors.gray300 : Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{participantCount}</Text>
                <TouchableOpacity
                  style={[styles.counterBtn, participantCount >= 10 && styles.counterBtnDisabled]}
                  onPress={() => changeCount(1)}
                  disabled={participantCount >= 10}
                >
                  <Ionicons name="add" size={20} color={participantCount >= 10 ? Colors.gray300 : Colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Participant forms */}
            {Array.from({ length: participantCount }, (_, i) => (
              <View key={i} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Participant {i + 1} {i === 0 ? '(You)' : ''}
                </Text>
                {requiredFields.length === 0 ? (
                  <Text style={styles.noFields}>No additional information required</Text>
                ) : (
                  <View style={styles.fields}>
                    {requiredFields.map((field) => (
                      <Input
                        key={field.field_type}
                        label={FIELD_LABELS[field.field_type] ?? field.field_type}
                        placeholder={`Enter ${FIELD_LABELS[field.field_type] ?? field.field_type}`}
                        value={participants[i]?.[field.field_type] ?? ''}
                        onChangeText={(v) => updateParticipant(i, field.field_type, v)}
                        keyboardType={
                          field.field_type === 'email' ? 'email-address' :
                          field.field_type === 'phone_number' || field.field_type === 'emergency_contact_phone' ? 'phone-pad' :
                          'default'
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            ))}

            <Button
              title="Continue to Review"
              onPress={() => {
                if (validate()) setStep('confirm');
              }}
              fullWidth
              size="lg"
              style={styles.continueBtn}
            />
          </>
        )}

        {step === 'confirm' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Booking Summary</Text>
              <View style={styles.confirmCard}>
                <ConfirmRow label="Trip" value={tripName} />
                <ConfirmRow label="Package" value={pkgName} />
                <ConfirmRow label="Participants" value={String(participantCount)} />
                <ConfirmRow label="Price per person" value={`SAR ${Number(selectedPackage.price).toLocaleString()}`} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>SAR {totalPrice.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
                <Text style={styles.infoText}>
                  After booking, you'll be redirected to complete payment via Moyasar. Your spot is reserved for 15 minutes.
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Button
                title="Back"
                variant="outline"
                onPress={() => setStep('participants')}
                style={styles.backActionBtn}
              />
              <Button
                title="Confirm & Pay"
                onPress={handleBook}
                loading={loading}
                style={styles.payBtn}
                size="lg"
              />
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>{label}</Text>
      <Text style={styles.confirmValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  progress: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 32, paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  progressStep: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.gray200,
    alignItems: 'center', justifyContent: 'center',
  },
  progressStepActive: { backgroundColor: Colors.primary },
  progressStepText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  progressStepTextInactive: { color: Colors.textTertiary },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.gray200, marginHorizontal: 8 },
  progressLineActive: { backgroundColor: Colors.primary },

  scroll: { padding: 16, gap: 0 },
  summaryCard: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.xl, padding: 16,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
    marginBottom: 20,
  },
  summaryTrip: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  summaryPkg: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  summaryPrice: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.accent },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  counterBtnDisabled: { opacity: 0.4 },
  counterValue: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, minWidth: 32, textAlign: 'center' },
  fields: { gap: 14 },
  noFields: { fontSize: FontSize.md, color: Colors.textTertiary, fontStyle: 'italic' },
  continueBtn: { marginTop: 8 },

  confirmCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: 16, gap: 12, ...Shadow.sm,
  },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  confirmValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  totalLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.infoLight ?? '#DBEAFE',
    borderRadius: Radius.lg, padding: 14,
  },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.info, lineHeight: 20 },

  actionRow: { flexDirection: 'row', gap: 12 },
  backActionBtn: { flex: 1 },
  payBtn: { flex: 2 },
});
