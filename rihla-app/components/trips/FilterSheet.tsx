import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';
import { Radius, FontSize, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import Button from '../ui/Button';
import { TripFilters, useDestinations, DestinationOption } from '../../hooks/useTrips';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: TripFilters;
  onApply: (filters: TripFilters) => void;
}

const ALL_AMENITIES = [
  'flight_tickets', 'bus', 'tour_guide', 'tours',
  'hotel', 'meals', 'insurance', 'visa_assistance',
] as const;

const RATING_STAR_OPTIONS = [
  { labelKey: 'filters.ratingAny', value: undefined },
  { label: '4+ ★', value: 4 },
  { label: '3+ ★', value: 3 },
];

function getDestName(d: DestinationOption) {
  return i18n.language === 'ar' ? d.name_ar || d.name_en : d.name_en || d.name_ar;
}

export default function FilterSheet({ visible, onClose, filters, onApply }: FilterSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [local, setLocal] = useState<TripFilters>(filters);
  const { data: destinationTree = [] } = useDestinations();

  // Flatten all cities from the destination tree for the picker
  const allCities: DestinationOption[] = destinationTree.flatMap(
    (country) => country.children?.filter((c) => c.type === 'city') ?? []
  );

  const update = (key: keyof TripFilters, value: any) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDestination = (id: string) => {
    const current = local.destination_ids ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    update('destination_ids', next.length ? next : undefined);
  };

  const toggleAmenity = (key: string) => {
    const current = local.amenities ?? [];
    const next = current.includes(key) ? current.filter((x) => x !== key) : [...current, key];
    update('amenities', next.length ? next : undefined);
  };

  const handleApply = () => {
    onApply(local);
    onClose();
  };

  const handleReset = () => {
    setLocal({});
    onApply({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={s.backdropTouch} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>{t('filters.title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={s.body} contentContainerStyle={s.bodyContent}>

            {/* Destinations (OR multi-select) */}
            <Text style={s.sectionLabel}>{t('filters.destinations')}</Text>
            <Text style={s.sectionHint}>{t('filters.destinationsHint')}</Text>
            <View style={s.chipWrap}>
              {allCities.map((city) => {
                const selected = (local.destination_ids ?? []).includes(city.id);
                return (
                  <TouchableOpacity
                    key={city.id}
                    style={[s.ratingChip, selected && s.ratingChipActive]}
                    onPress={() => toggleDestination(city.id)}
                  >
                    <Text style={[s.ratingChipText, selected && s.ratingChipTextActive]}>
                      {getDestName(city)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Single / Multiple destinations */}
            <Text style={s.sectionLabel}>{t('filters.numberOfDestinations')}</Text>
            <View style={s.ratingRow}>
              {([
                { labelKey: 'filters.any', value: undefined },
                { labelKey: 'filters.singleCity', value: true },
                { labelKey: 'filters.multipleCities', value: false },
              ] as { labelKey: string; value: boolean | undefined }[]).map((opt) => (
                <TouchableOpacity key={String(opt.value)}
                  style={[s.ratingChip, local.single_destination === opt.value && s.ratingChipActive]}
                  onPress={() => update('single_destination', opt.value)}>
                  <Text style={[s.ratingChipText, local.single_destination === opt.value && s.ratingChipTextActive]}>
                    {t(opt.labelKey as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Trip Type */}
            <Text style={s.sectionLabel}>{t('filters.tripType')}</Text>
            <View style={s.ratingRow}>
              {([
                { labelKey: 'filters.allTypes', value: undefined },
                { labelKey: 'filters.domestic', value: false },
                { labelKey: 'filters.international', value: true },
              ] as { labelKey: string; value: boolean | undefined }[]).map((opt) => (
                <TouchableOpacity key={String(opt.value)}
                  style={[s.ratingChip, local.is_international === opt.value && s.ratingChipActive]}
                  onPress={() => update('is_international', opt.value)}>
                  <Text style={[s.ratingChipText, local.is_international === opt.value && s.ratingChipTextActive]}>
                    {t(opt.labelKey as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Price */}
            <Text style={s.sectionLabel}>{t('filters.priceRange')}</Text>
            <View style={s.row}>
              <View style={s.priceInput}>
                <Text style={s.inputLabel}>{t('filters.minPrice')}</Text>
                <TextInput style={s.input} placeholder="0" keyboardType="numeric"
                  value={local.min_price?.toString() ?? ''}
                  onChangeText={(v) => update('min_price', v ? Number(v) : undefined)}
                  placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={s.priceDash}><Text style={s.dashText}>—</Text></View>
              <View style={s.priceInput}>
                <Text style={s.inputLabel}>{t('filters.maxPrice')}</Text>
                <TextInput style={s.input} placeholder="∞" keyboardType="numeric"
                  value={local.max_price?.toString() ?? ''}
                  onChangeText={(v) => update('max_price', v ? Number(v) : undefined)}
                  placeholderTextColor={colors.textTertiary} />
              </View>
            </View>

            {/* Participants */}
            <Text style={s.sectionLabel}>{t('filters.participants')}</Text>
            <View style={s.row}>
              <View style={s.priceInput}>
                <Text style={s.inputLabel}>{t('filters.minParticipants')}</Text>
                <TextInput style={s.input} placeholder="1" keyboardType="numeric"
                  value={local.min_participants?.toString() ?? ''}
                  onChangeText={(v) => update('min_participants', v ? Number(v) : undefined)}
                  placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={s.priceDash}><Text style={s.dashText}>—</Text></View>
              <View style={s.priceInput}>
                <Text style={s.inputLabel}>{t('filters.maxParticipants')}</Text>
                <TextInput style={s.input} placeholder="∞" keyboardType="numeric"
                  value={local.max_participants?.toString() ?? ''}
                  onChangeText={(v) => update('max_participants', v ? Number(v) : undefined)}
                  placeholderTextColor={colors.textTertiary} />
              </View>
            </View>

            {/* Amenities */}
            <Text style={s.sectionLabel}>{t('filters.amenities')}</Text>
            <Text style={s.sectionHint}>{t('filters.amenitiesHint')}</Text>
            <View style={s.chipWrap}>
              {ALL_AMENITIES.map((key) => {
                const selected = (local.amenities ?? []).includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.ratingChip, selected && s.ratingChipActive]}
                    onPress={() => toggleAmenity(key)}
                  >
                    <Text style={[s.ratingChipText, selected && s.ratingChipTextActive]}>
                      {t(`amenities.${key}` as any)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Rating */}
            <Text style={s.sectionLabel}>{t('filters.minRating')}</Text>
            <View style={s.ratingRow}>
              {RATING_STAR_OPTIONS.map((opt) => (
                <TouchableOpacity key={String(opt.value)}
                  style={[s.ratingChip, local.min_rating === opt.value && s.ratingChipActive]}
                  onPress={() => update('min_rating', opt.value)}>
                  <Text style={[s.ratingChipText, local.min_rating === opt.value && s.ratingChipTextActive]}>
                    {'labelKey' in opt ? t(opt.labelKey as any) : opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>
          <View style={s.actions}>
            <Button title={t('filters.resetFilters')} variant="outline" onPress={handleReset} style={s.resetBtn} />
            <Button title={t('filters.applyFilters')} onPress={handleApply} style={s.applyBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end' },
    backdropTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', flexDirection: 'column', ...Shadow.lg },
    handle: { width: 40, height: 4, backgroundColor: c.gray200, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    title: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    body: { flexShrink: 1, paddingHorizontal: 20, paddingTop: 16 },
    bodyContent: { paddingBottom: 24 },
    sectionLabel: { fontSize: FontSize.sm, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    priceInput: { flex: 1 },
    inputLabel: { fontSize: FontSize.xs, color: c.textTertiary, marginBottom: 4 },
    input: { borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.md, color: c.textPrimary, backgroundColor: c.gray50 },
    priceDash: { paddingTop: 18 },
    dashText: { color: c.textTertiary, fontSize: FontSize.lg },
    sectionHint: { fontSize: FontSize.xs, color: c.textTertiary, marginBottom: 10, marginTop: -6 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    ratingChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
    ratingChipActive: { borderColor: c.primary, backgroundColor: c.primarySurface },
    ratingChipText: { fontSize: FontSize.sm, fontWeight: '600', color: c.textSecondary },
    ratingChipTextActive: { color: c.primary },
    actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: c.border },
    resetBtn: { flex: 1 },
    applyBtn: { flex: 2 },
  });
}
