import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTrip, useFieldMetadata, useNationalities, useMyRegistrations } from '../../hooks/useTrips';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import Button from '../../components/ui/Button';
import ParticipantField, { FieldType } from '../../components/booking/ParticipantField';
import apiClient from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { TripPackage } from '../../types/trip';
import { computePackagePrice, formatPrice, buildTierSummary, minPricePerPerson, buildTierBillingBreakdown } from '../../lib/pricingUtils';
import { useFieldValidation } from '../../hooks/useFieldValidation';
import Toast from '../../components/ui/Toast';

interface Participant {
  package_id?: string;
  [fieldType: string]: string | undefined;
}

interface PackageSelection {
  package: TripPackage;
  count: number;
}

export default function BookingScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading: tripLoading } = useTrip(tripId);
  const { data: fieldMetadata } = useFieldMetadata();
  const { data: nationalities } = useNationalities();
  const qc = useQueryClient();
  const { data: myRegistrations } = useMyRegistrations();
  // Compute before any early returns (Rules of Hooks — no conditionals before this)
  const existingBooking = (myRegistrations ?? []).find(
    (r) => r.trip_id === tripId && !['cancelled', 'completed'].includes(r.status)
  ) ?? null;
  const { validateAllParticipants } = useFieldValidation();
  const [loading, setLoading] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [step, setStep] = useState<'count' | 'fields' | 'confirm'>('count');
  // fieldErrors[participantIndex][fieldType] = error string
  const [fieldErrors, setFieldErrors] = useState<Record<number, Record<string, string>>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [tripChangedVisible, setTripChangedVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Non-packaged state
  const [simpleCount, setSimpleCount] = useState(1);
  const [simpleParticipants, setSimpleParticipants] = useState<Participant[]>([{}]);

  // Packaged state
  const [pkgSelections, setPkgSelections] = useState<PackageSelection[]>([]);
  const [pkgParticipants, setPkgParticipants] = useState<Participant[]>([]);

  const isPackaged = trip?.is_packaged_trip ?? false;
  const activePackages = useMemo(() => trip?.packages?.filter(p => p.is_active) ?? [], [trip]);

  const simpleRequiredFields = useMemo(() => {
    const mandatoryFields: FieldType[] = ['name', 'date_of_birth'];
    const hiddenFieldDetails = trip?.simple_trip_required_fields_details ?? [];
    const merged = new Map<FieldType, { field_type: FieldType; is_required: boolean; validation_config: Record<string, any> | null }>();

    mandatoryFields.forEach((fieldType) => {
      merged.set(fieldType, {
        field_type: fieldType,
        is_required: true,
        validation_config: null,
      });
    });

    hiddenFieldDetails.forEach((field) => {
      merged.set(field.field_type as FieldType, {
        field_type: field.field_type as FieldType,
        is_required: field.is_required,
        validation_config: field.validation_config ?? null,
      });
    });

    (trip?.simple_trip_required_fields ?? []).forEach((fieldType) => {
      if (!merged.has(fieldType as FieldType)) {
        merged.set(fieldType as FieldType, {
          field_type: fieldType as FieldType,
          is_required: true,
          validation_config: null,
        });
      }
    });

    return Array.from(merged.values());
  }, [trip?.simple_trip_required_fields, trip?.simple_trip_required_fields_details]);

  // Packaged: flat list of {participant, pkg, globalIndex}
  const pkgFlatList = useMemo(() => {
    const list: { participant: Participant; pkg: TripPackage; globalIndex: number }[] = [];
    let idx = 0;
    for (const sel of pkgSelections) {
      for (let i = 0; i < sel.count; i++) {
        list.push({ participant: pkgParticipants[idx] ?? {}, pkg: sel.package, globalIndex: idx });
        idx++;
      }
    }
    return list;
  }, [pkgSelections, pkgParticipants]);

  const totalParticipants = isPackaged
    ? pkgSelections.reduce((acc, sel) => acc + sel.count, 0)
    : simpleCount;

  const nonPackagedPrice = trip?.price ?? 0;
  const totalAmount = isPackaged
    ? pkgSelections.reduce((acc, sel) => acc + computePackagePrice(sel.package, sel.count), 0)
    : (() => {
        if (trip?.simple_trip_use_flexible_pricing && trip?.simple_trip_pricing_tiers && trip.simple_trip_pricing_tiers.length > 0) {
          // Build a synthetic TripPackage-like object for the simple trip tiers
          const syntheticPkg: TripPackage = {
            id: '', trip_id: trip.id,
            name_en: null, name_ar: null, description_en: null, description_ar: null,
            price: 0, currency: 'SAR', is_active: true,
            required_fields: [],
            use_flexible_pricing: true,
            pricing_tiers: trip.simple_trip_pricing_tiers,
          };
          return computePackagePrice(syntheticPkg, simpleCount);
        }
        return nonPackagedPrice * simpleCount;
      })();

  const updateSimpleParticipant = (index: number, field: string, value: string) => {
    setSimpleParticipants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updatePkgParticipant = (globalIndex: number, field: string, value: string) => {
    setPkgParticipants(prev => {
      const updated = [...prev];
      if (!updated[globalIndex]) updated[globalIndex] = {};
      updated[globalIndex] = { ...updated[globalIndex], [field]: value };
      return updated;
    });
  };

  const changeSimpleCount = (delta: number) => {
    const maxCount = Math.min(10, trip?.available_spots ?? 10);
    const newCount = Math.max(1, Math.min(maxCount, simpleCount + delta));
    setSimpleCount(newCount);
    setSimpleParticipants(prev => {
      if (newCount > prev.length) return [...prev, ...Array(newCount - prev.length).fill({})];
      return prev.slice(0, newCount);
    });
  };

  const addPkgCount = (pkg: TripPackage) => {
    const pkgMaxSpots = pkg.available_spots ?? Infinity;
    const tripMaxSpots = trip?.available_spots ?? Infinity;
    setPkgSelections(prev => {
      const currentTotal = prev.reduce((acc, s) => acc + s.count, 0);
      if (currentTotal >= tripMaxSpots) return prev;
      const existing = prev.find(s => s.package.id === pkg.id);
      if (existing) {
        if (existing.count >= pkgMaxSpots) return prev;
        return prev.map(s => s.package.id === pkg.id ? { ...s, count: s.count + 1 } : s);
      }
      if (pkgMaxSpots === 0) return prev;
      return [...prev, { package: pkg, count: 1 }];
    });
  };

  const removePkgCount = (pkgId: string) => {
    setPkgSelections(prev => {
      const existing = prev.find(s => s.package.id === pkgId);
      if (!existing) return prev;
      if (existing.count <= 1) return prev.filter(s => s.package.id !== pkgId);
      return prev.map(s => s.package.id === pkgId ? { ...s, count: s.count - 1 } : s);
    });
  };

  const validateFields = (): boolean => {
    let errors: Record<number, Record<string, string>> = {};
    const nationalityCodes = nationalities?.map(n => n.code.toUpperCase());

    if (!isPackaged) {
      const participants = simpleParticipants.slice(0, simpleCount);
      errors = validateAllParticipants(participants, simpleRequiredFields, nationalityCodes, nationalities);
    } else {
      pkgFlatList.forEach(({ participant, pkg, globalIndex }) => {
        const fieldDefs = (pkg.required_fields ?? []).map(ft => {
          const detail = pkg.required_fields_details?.find(d => d.field_type === ft);
          return {
            field_type: ft as FieldType,
            is_required: detail ? detail.is_required : true,
            validation_config: detail?.validation_config ?? null,
          };
        });
        const pErrors = validateAllParticipants([participant], fieldDefs, nationalityCodes, nationalities);
        if (pErrors[0] && Object.keys(pErrors[0]).length > 0) {
          errors[globalIndex] = pErrors[0];
        }
      });
    }

    setFieldErrors(errors);
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
    return !hasErrors;
  };

  const clearFieldError = (participantIndex: number, fieldType: string) => {
    setFieldErrors(prev => {
      if (!prev[participantIndex]?.[fieldType]) return prev;
      const updated = { ...prev };
      updated[participantIndex] = { ...updated[participantIndex] };
      delete updated[participantIndex][fieldType];
      if (Object.keys(updated[participantIndex]).length === 0) delete updated[participantIndex];
      return updated;
    });
  };

  const handleBook = async () => {
    setLoading(true);
    try {
      const payload = buildPayload();
      const { data: registration } = await apiClient.post(`/trips/${tripId}/register`, payload);
      qc.invalidateQueries({ queryKey: ['registrations', 'me'] });
      router.replace(`/booking/${registration.id}?autoPayment=true`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;

      if (typeof detail === 'string' && detail.includes('already have an active registration')) {
        setAlreadyRegistered(true);
      } else if (status === 409 && typeof detail === 'string' && detail.includes('trip details have been updated')) {
        qc.invalidateQueries({ queryKey: ['trip', tripId] });
        setTripChangedVisible(true);
      } else if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        // Structured field error — go back to fields step and show inline
        if ((detail.code === 'field_validation_failed' || detail.code === 'required_field_missing') && detail.field) {
          const fieldErrorMsg = Array.isArray(detail.messages)
            ? detail.messages.join(', ')
            : (detail.messages ?? t('fieldValidation.required'));
          const participantIndex = detail.participant_index ?? 0;
          setFieldErrors({ [participantIndex]: { [detail.field]: fieldErrorMsg } });
          if (hasRequiredFields) setStep('fields');
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        } else {
          setBannerError(t('common.error'));
        }
      } else {
        const msg = Array.isArray(detail)
          ? (detail[0]?.msg ?? t('common.error'))
          : (typeof detail === 'string' ? detail : t('common.error'));
        setBannerError(msg);
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

  if (alreadyRegistered || existingBooking) {
    const bookingId = existingBooking?.id;
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
          <Text style={s.errorText}>{t('booking.alreadyRegistered')}</Text>
          {bookingId && (
            <Button
              title={t('booking.viewBooking')}
              onPress={() => router.replace({ pathname: '/booking/[registrationId]', params: { registrationId: bookingId } })}
              fullWidth
            />
          )}
          <Button title={t('booking.viewBookings')} onPress={() => router.replace('/(tabs)/bookings')} variant={bookingId ? 'outline' : undefined} />
          <Button title={t('trip.goBack')} onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.gray300} />
          <Text style={s.errorText}>{t('trip.notFound')}</Text>
          <Button title={t('trip.goBack')} onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const tripName = (i18n.language === 'ar' ? (trip.name_ar || trip.name_en) : (trip.name_en || trip.name_ar)) || 'Trip';
  const steps = ['count', 'fields', 'confirm'] as const;
  const stepIndex = steps.indexOf(step);

  const canProceedFromCount = isPackaged ? totalParticipants > 0 : true;

  // Skip fields step if there are no required fields
  const hasRequiredFields = isPackaged
    ? pkgSelections.some(sel => (sel.package.required_fields ?? []).length > 0)
    : simpleRequiredFields.length > 0;

  const handleProceedFromCount = () => {
    if (hasRequiredFields) {
      setStep('fields');
    } else {
      setStep('confirm');
    }
  };

  const handleProceedFromFields = async () => {
    if (!validateFields()) return;
    // Pre-confirm server-side dry run: try registering with a special header
    // We use the same payload as handleBook but hit the validate endpoint
    setLoading(true);
    try {
      const payload = buildPayload();
      await apiClient.post(`/trips/${tripId}/validate-registration`, payload);
      setStep('confirm');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        if (detail.code === 'field_validation_failed' && detail.field) {
          // Find participant index for this field error
          const fieldErrorMsg = Array.isArray(detail.messages) ? detail.messages.join(', ') : detail.messages ?? t('common.error');
          // For non-packaged trips participant indices map directly; for packaged use backend package info
          const participantIndex = detail.participant_index ?? 0;
          setFieldErrors(prev => ({
            ...prev,
            [participantIndex]: { ...(prev[participantIndex] ?? {}), [detail.field]: fieldErrorMsg },
          }));
          scrollRef.current?.scrollTo({ y: 0, animated: true });
          return;
        }
        if (detail.code === 'required_field_missing' && detail.field) {
          const participantIndex = detail.participant_index ?? 0;
          setFieldErrors(prev => ({
            ...prev,
            [participantIndex]: { ...(prev[participantIndex] ?? {}), [detail.field]: t('fieldValidation.required') },
          }));
          scrollRef.current?.scrollTo({ y: 0, animated: true });
          return;
        }
      }
      // 404 = validate endpoint not yet deployed — silently proceed
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        setStep('confirm');
        return;
      }
      const msg = typeof detail === 'string' ? detail : t('common.error');
      setBannerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = () => {
    if (!isPackaged) {
      return {
        total_participants: simpleCount,
        total_amount: totalAmount.toFixed(2),
        trip_content_hash: trip?.content_hash ?? undefined,
        participants: simpleParticipants.slice(0, simpleCount).map((p, i) => ({
          is_registration_user: i === 0,
          ...p,
        })),
      };
    }
    return {
      total_participants: totalParticipants,
      total_amount: totalAmount.toFixed(2),
      trip_content_hash: trip?.content_hash ?? undefined,
      participants: pkgFlatList.map(({ participant, pkg }, i) => ({
        package_id: pkg.id,
        is_registration_user: i === 0,
        ...participant,
      })),
    };
  };

  return (
    <View style={s.container}>
    <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name={i18n.language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{tripName}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.progress}>
          {steps.map((st, idx) => (
            <React.Fragment key={st}>
              <View style={[s.progressStep, idx <= stepIndex && s.progressStepActive]}>
                <Text style={[s.progressStepText, idx > stepIndex && s.progressStepTextInactive]}>{idx + 1}</Text>
              </View>
              {idx < steps.length - 1 && (
                <View style={[s.progressLine, idx < stepIndex && s.progressLineActive]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </SafeAreaView>

      <ScrollView ref={scrollRef} style={s.scrollView} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">

        {/* ── STEP 1: Count / Package Selection ── */}
        {step === 'count' && (
          <>
            {!isPackaged ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('booking.participants')}</Text>
                <View style={s.counterRow}>
                  <TouchableOpacity style={[s.counterBtn, simpleCount <= 1 && s.counterBtnDisabled]} onPress={() => changeSimpleCount(-1)} disabled={simpleCount <= 1}>
                    <Ionicons name="remove" size={20} color={simpleCount <= 1 ? colors.gray300 : colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={s.counterValue}>{simpleCount}</Text>
                  <TouchableOpacity style={[s.counterBtn, simpleCount >= Math.min(10, trip?.available_spots ?? 10) && s.counterBtnDisabled]} onPress={() => changeSimpleCount(1)} disabled={simpleCount >= Math.min(10, trip?.available_spots ?? 10)}>
                    <Ionicons name="add" size={20} color={simpleCount >= Math.min(10, trip?.available_spots ?? 10) ? colors.gray300 : colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                {trip?.simple_trip_use_flexible_pricing && trip.simple_trip_pricing_tiers && trip.simple_trip_pricing_tiers.length > 0 ? (
                  <View style={s.simplePriceBox}>
                    <Text style={s.simplePriceTotal}>{formatPrice(totalAmount)}</Text>
                    <View style={s.tierBreakdownContainer}>
                      {buildTierSummary(trip.simple_trip_pricing_tiers, 'SAR', t as any, isRTL).map((line, i) => (
                        <Text key={i} style={s.tierBreakdownText}>• {line}</Text>
                      ))}
                    </View>
                  </View>
                ) : nonPackagedPrice > 0 ? (
                  <Text style={s.simplePriceTotal}>
                    {simpleCount} × {formatPrice(nonPackagedPrice)} = {formatPrice(totalAmount)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('booking.selectTiers', { defaultValue: 'Select Tiers' })}</Text>
                <Text style={s.sectionSubtitle}>{t('booking.selectTiersHint', { defaultValue: 'Choose how many participants per tier' })}</Text>
                {activePackages.map(pkg => {
                  const sel = pkgSelections.find(s => s.package.id === pkg.id);
                  const count = sel?.count ?? 0;
                  const pkgName = (i18n.language === 'ar' ? (pkg.name_ar || pkg.name_en) : (pkg.name_en || pkg.name_ar)) || 'Tier';
                  const isFlexPkg = pkg.use_flexible_pricing && pkg.pricing_tiers && pkg.pricing_tiers.length > 0;
                  const pkgSubtotal = count > 0 ? computePackagePrice(pkg, count) : 0;
                  const billingLines = isFlexPkg && count > 0 ? buildTierBillingBreakdown(pkg.pricing_tiers!, count, 'SAR', t as any, isRTL) : [];
                  return (
                    <View key={pkg.id} style={s.pkgCard}>
                      <View style={s.pkgCardRow}>
                      <View style={s.pkgInfo}>
                        <Text style={s.pkgName}>{pkgName}</Text>
                        {isFlexPkg ? (
                          <Text style={s.pkgPrice}>
                            {count > 0 ? formatPrice(pkgSubtotal) : `${t('trip.from', 'From')} ${formatPrice(minPricePerPerson(pkg))}`}
                          </Text>
                        ) : (
                          <Text style={s.pkgPrice}>
                            {count > 0
                              ? `${count} × ${formatPrice(Number(pkg.price))} = ${formatPrice(pkgSubtotal)}`
                              : t('booking.priceFormat', { price: Number(pkg.price).toLocaleString() })}
                          </Text>
                        )}
                      </View>
                      <View style={s.counterRow}>
                        <TouchableOpacity style={[s.counterBtn, count <= 0 && s.counterBtnDisabled]} onPress={() => removePkgCount(pkg.id)} disabled={count <= 0}>
                          <Ionicons name="remove" size={18} color={count <= 0 ? colors.gray300 : colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={s.counterValue}>{count}</Text>
                        <TouchableOpacity
                          style={[s.counterBtn, (pkg.available_spots === 0 || pkgSelections.reduce((acc, s) => acc + s.count, 0) >= (trip?.available_spots ?? Infinity)) && s.counterBtnDisabled]}
                          onPress={() => addPkgCount(pkg)}
                          disabled={pkg.available_spots === 0 || pkgSelections.reduce((acc, s) => acc + s.count, 0) >= (trip?.available_spots ?? Infinity)}
                        >
                          <Ionicons name="add" size={18} color={(pkg.available_spots === 0 || pkgSelections.reduce((acc, s) => acc + s.count, 0) >= (trip?.available_spots ?? Infinity)) ? colors.gray300 : colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                      </View>
                      {billingLines.length > 0 && (
                        <View style={s.tierBreakdownContainer}>
                          {billingLines.map((line, i) => (
                            <Text key={i} style={s.tierBreakdownText}>• {line}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
                {totalParticipants > 0 && (
                  <Text style={s.totalParticipantsHint}>{t('booking.totalParticipants', { defaultValue: 'Total: {{count}} participant(s)', count: totalParticipants })}</Text>
                )}
              </View>
            )}
            <Button
              title={t('common.next', { defaultValue: 'Next' })}
              onPress={handleProceedFromCount}
              fullWidth size="lg" style={s.continueBtn}
              disabled={!canProceedFromCount}
            />
          </>
        )}

        {/* ── STEP 2: Fill Participant Fields ── */}
        {step === 'fields' && (
          <>
            {Object.keys(fieldErrors).length > 0 && (
              <View style={s.validationBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={s.validationBannerText}>{t('fieldValidation.validationErrorTitle')}</Text>
              </View>
            )}
            {!isPackaged ? (
              Array.from({ length: simpleCount }, (_, i) => (
                <View key={i} style={s.section}>
                  <Text style={s.sectionTitle}>{t('booking.participant', { number: i + 1 })}</Text>
                  <View style={s.fields}>
                    {simpleRequiredFields.map(field => (
                      <ParticipantField
                        key={field.field_type}
                        fieldType={field.field_type}
                        value={simpleParticipants[i]?.[field.field_type] ?? ''}
                        onChange={v => {
                          updateSimpleParticipant(i, field.field_type, v);
                          clearFieldError(i, field.field_type);
                        }}
                        isRequired={field.is_required}
                        metadata={fieldMetadata?.[field.field_type]}
                        allowedGenders={field.validation_config?.gender_restrictions?.allowed_genders}
                        nationalityOptions={nationalities}
                        validationConfig={field.validation_config}
                        error={fieldErrors[i]?.[field.field_type]}
                      />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              pkgFlatList.map(({ participant, pkg, globalIndex }) => {
                const pkgLabel = (i18n.language === 'ar' ? (pkg.name_ar || pkg.name_en) : (pkg.name_en || pkg.name_ar)) || 'Tier';
                const fields = (pkg.required_fields ?? []).map(ft => {
                  const detail = pkg.required_fields_details?.find(d => d.field_type === ft);
                  return {
                    field_type: ft as FieldType,
                    is_required: detail ? detail.is_required : true,
                    validation_config: detail?.validation_config ?? null,
                  };
                });
                return (
                  <View key={globalIndex} style={s.section}>
                    <Text style={s.sectionTitle}>{t('booking.participant', { number: globalIndex + 1 })}</Text>
                    <Text style={s.pkgBadge}>{pkgLabel}</Text>
                    <View style={s.fields}>
                      {fields.map(field => (
                        <ParticipantField
                          key={field.field_type}
                          fieldType={field.field_type}
                          value={participant[field.field_type] ?? ''}
                          onChange={v => {
                            updatePkgParticipant(globalIndex, field.field_type, v);
                            clearFieldError(globalIndex, field.field_type);
                          }}
                          isRequired={field.is_required}
                          metadata={fieldMetadata?.[field.field_type]}
                          allowedGenders={field.validation_config?.gender_restrictions?.allowed_genders}
                          nationalityOptions={nationalities}
                          validationConfig={field.validation_config}
                          error={fieldErrors[globalIndex]?.[field.field_type]}
                        />
                      ))}
                    </View>
                  </View>
                );
              })
            )}
            <View style={s.actionRow}>
              <Button title={t('common.back')} variant="outline" onPress={() => { setFieldErrors({}); setStep('count'); }} style={s.backActionBtn} />
              <Button title={t('common.next')} onPress={handleProceedFromFields} loading={loading} style={s.payBtn} size="lg" />
            </View>
          </>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 'confirm' && (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('booking.confirmBooking')}</Text>
              <View style={s.confirmCard}>
                <ConfirmRow label={t('trip.details')} value={tripName} s={s} />
                <ConfirmRow label={t('booking.participants')} value={String(totalParticipants)} s={s} />
                {!isPackaged && trip?.simple_trip_use_flexible_pricing && trip.simple_trip_pricing_tiers && trip.simple_trip_pricing_tiers.length > 0 && (
                  <View style={s.tierBreakdownContainer}>
                    {buildTierBillingBreakdown(trip.simple_trip_pricing_tiers, simpleCount, 'SAR', t as any, isRTL).map((line, i) => (
                      <Text key={i} style={s.tierBreakdownText}>• {line}</Text>
                    ))}
                  </View>
                )}
                {!isPackaged && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>{t('booking.totalAmount')}</Text>
                    <Text style={s.totalValue}>{t('booking.priceFormat', { price: totalAmount.toLocaleString() })}</Text>
                  </View>
                )}
                {isPackaged && pkgSelections.map(sel => {
                  const pName = (i18n.language === 'ar' ? (sel.package.name_ar || sel.package.name_en) : (sel.package.name_en || sel.package.name_ar)) || 'Tier';
                  const pkgTotal = computePackagePrice(sel.package, sel.count);
                  const isFlexSel = sel.package.use_flexible_pricing && sel.package.pricing_tiers && sel.package.pricing_tiers.length > 0;
                  const valueLabel = isFlexSel
                    ? `${sel.count} ${t('pricing.participants_short')} → ${formatPrice(pkgTotal)}`
                    : `${sel.count} × ${formatPrice(Number(sel.package.price))} = ${formatPrice(pkgTotal)}`;
                  return (
                    <View key={sel.package.id}>
                      <ConfirmRow label={pName} value={valueLabel} s={s} />
                      {isFlexSel && (
                        <View style={s.tierBreakdownContainer}>
                          {buildTierBillingBreakdown(sel.package.pricing_tiers!, sel.count, 'SAR', t as any, isRTL).map((line, i) => (
                            <Text key={i} style={s.tierBreakdownText}>• {line}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
                {isPackaged && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>{t('booking.totalAmount')}</Text>
                    <Text style={s.totalValue}>{t('booking.priceFormat', { price: totalAmount.toLocaleString() })}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Participants review */}
            {(() => {
              const resolveLabel = (fieldKey: string, rawValue: string): string => {
                if (fieldKey === 'nationality' && nationalities) {
                  const nat = nationalities.find(n => n.code.toUpperCase() === rawValue.toUpperCase());
                  if (nat) return i18n.language === 'ar' ? (nat.name_ar || nat.name_en) : (nat.name_en || nat.name);
                }
                const meta = fieldMetadata?.[fieldKey];
                if (meta?.options) {
                  const opt = meta.options.find(o => o.value === rawValue);
                  if (opt) return opt.label;
                }
                return rawValue;
              };
              return !isPackaged
                ? simpleParticipants.slice(0, simpleCount).map((p, i) => {
                    const entries = Object.entries(p).filter(([k, v]) => k !== 'package_id' && v);
                    if (entries.length === 0) return null;
                    return (
                      <View key={i} style={s.section}>
                        <Text style={s.sectionTitle}>{t('booking.participant', { number: i + 1 })}</Text>
                        <View style={s.confirmCard}>
                          {entries.map(([k, v]) => (
                            <ConfirmRow key={k} label={fieldMetadata?.[k]?.display_name ?? k.replace(/_/g, ' ')} value={resolveLabel(k, String(v))} s={s} />
                          ))}
                        </View>
                      </View>
                    );
                  })
                : pkgFlatList.map(({ participant, pkg, globalIndex }) => {
                    const entries = Object.entries(participant).filter(([k, v]) => k !== 'package_id' && v);
                    if (entries.length === 0) return null;
                    const pkgLabel = (i18n.language === 'ar' ? (pkg.name_ar || pkg.name_en) : (pkg.name_en || pkg.name_ar)) || 'Tier';
                    return (
                      <View key={globalIndex} style={s.section}>
                        <Text style={s.sectionTitle}>{t('booking.participant', { number: globalIndex + 1 })}</Text>
                        <Text style={s.pkgBadge}>{pkgLabel}</Text>
                        <View style={s.confirmCard}>
                          {entries.map(([k, v]) => (
                            <ConfirmRow key={k} label={fieldMetadata?.[k]?.display_name ?? k.replace(/_/g, ' ')} value={resolveLabel(k, String(v))} s={s} />
                          ))}
                        </View>
                      </View>
                    );
                  });
            })()}
            {/* Refund policy disclosure */}
            {trip && trip.is_refundable != null && (
              <View style={trip.is_refundable === false ? s.nonRefundableBox : s.refundableBox}>
                <View style={s.refundBoxTitleRow}>
                  <Ionicons
                    name={trip.is_refundable === false ? 'close-circle' : 'shield-checkmark-outline'}
                    size={18}
                    color={trip.is_refundable === false ? '#DC2626' : '#166534'}
                  />
                  <Text style={trip.is_refundable === false ? s.nonRefundableBoxTitle : s.refundableBoxTitle}>
                    {t('booking.refundPolicy')}
                  </Text>
                </View>
                {trip.is_refundable === false ? (
                  <Text style={s.refundBoxBody}>{t('booking.nonRefundableCheckout')}</Text>
                ) : trip.trip_type === 'self_arranged' ? (
                  <>
                    <Text style={s.refundBoxBody}>{t('booking.refundableCheckout')}</Text>
                    <Text style={s.refundBoxRule}>{'• '}{t('booking.refundRuleSelfArrangedPre')}</Text>
                    <Text style={s.refundBoxRule}>{'• '}{t('booking.refundRuleSelfArrangedPost')}</Text>
                    <Text style={s.refundBoxCooling}>{'⏱ '}{t('booking.coolingOff')}</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.refundBoxBody}>{t('booking.refundableCheckout')}</Text>
                    <Text style={s.refundBoxRule}>{'• '}{t('booking.refundRule72h')}</Text>
                    <Text style={s.refundBoxRule}>{'• '}{t('booking.refundRule12to72h')}</Text>
                    <Text style={s.refundBoxRule}>{'• '}{t('booking.refundRuleLess12h')}</Text>
                    <Text style={s.refundBoxCooling}>{'⏱ '}{t('booking.coolingOff')}</Text>
                  </>
                )}
              </View>
            )}
            <View style={s.section}>
              <View style={s.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                <Text style={s.infoText}>{t('booking.paymentRedirectInfo')}</Text>
              </View>
            </View>
            <View style={s.actionRow}>
              <Button title={t('common.back')} variant="outline" onPress={() => hasRequiredFields ? setStep('fields') : setStep('count')} style={s.backActionBtn} />
              <Button title={t('booking.confirmBooking')} onPress={handleBook} loading={loading} style={s.payBtn} size="lg" />
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>

    <Toast
      visible={!!bannerError}
      message={bannerError ?? ''}
      type="error"
      onHide={() => setBannerError(null)}
    />
    <Toast
      visible={tripChangedVisible}
      message={t('booking.tripChangedMessage')}
      type="warning"
      duration={6000}
      onHide={() => { setTripChangedVisible(false); router.back(); }}
    />
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
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary, flex: 1, textAlign: 'center' },
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
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: c.textPrimary, marginBottom: 12 },
    counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
    counterBtnDisabled: { opacity: 0.4 },
    counterValue: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary, minWidth: 32, textAlign: 'center' },
    fields: { gap: 14 },
    validationBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: Radius.lg, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
    validationBannerText: { fontSize: FontSize.sm, color: '#DC2626', fontWeight: '600', flex: 1 },
    noFields: { fontSize: FontSize.md, color: c.textTertiary, fontStyle: 'italic' },
    continueBtn: { marginTop: 8 },
    sectionSubtitle: { fontSize: FontSize.sm, color: c.textSecondary, marginBottom: 12, marginTop: -8 },
    pkgCard: { flexDirection: 'column', backgroundColor: c.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 10, ...Shadow.sm },
    pkgCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pkgInfo: { flex: 1, marginRight: 12 },
    pkgName: { fontSize: FontSize.md, fontWeight: '700', color: c.textPrimary },
    pkgPrice: { fontSize: FontSize.sm, color: c.accent, fontWeight: '600', marginTop: 2 },
    totalParticipantsHint: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600', marginTop: 8, textAlign: 'center' },
    pkgBadge: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600', marginBottom: 10, backgroundColor: c.primarySurface, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.md },
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

    nonRefundableBox: {
      backgroundColor: '#FEF2F2', borderRadius: Radius.xl,
      borderWidth: 1.5, borderColor: '#FECACA',
      padding: 14, marginBottom: 16,
    },
    refundableBox: {
      backgroundColor: '#F0FDF4', borderRadius: Radius.xl,
      borderWidth: 1, borderColor: '#BBF7D0',
      padding: 14, marginBottom: 16,
    },
    refundBoxTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    nonRefundableBoxTitle: { fontSize: FontSize.md, fontWeight: '700', color: '#DC2626', flex: 1 },
    refundableBoxTitle: { fontSize: FontSize.md, fontWeight: '700', color: '#166534', flex: 1 },
    refundBoxBody: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20, marginBottom: 6 },
    refundBoxRule: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20, marginLeft: 4 },
    refundBoxCooling: { fontSize: FontSize.xs, color: c.textTertiary, lineHeight: 18, marginTop: 6, fontStyle: 'italic' },
    tierBreakdownContainer: { paddingLeft: 12, paddingBottom: 6, gap: 2, marginTop: 8 },
    tierBreakdownText: { fontSize: FontSize.xs, color: c.textTertiary, lineHeight: 18 },
    simplePriceBox: { marginTop: 16, backgroundColor: c.primarySurface, borderRadius: Radius.lg, padding: 12 },
    simplePriceTotal: { fontSize: FontSize.lg, fontWeight: '800', color: c.accent, marginTop: 12, textAlign: 'center' },
  });
}
