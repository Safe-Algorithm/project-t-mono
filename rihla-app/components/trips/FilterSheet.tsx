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
import { Radius, FontSize, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import Button from '../ui/Button';
import { TripFilters } from '../../hooks/useTrips';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: TripFilters;
  onApply: (filters: TripFilters) => void;
}

const RATING_OPTIONS = [
  { label: 'Any', value: undefined },
  { label: '4+ ★', value: 4 },
  { label: '3+ ★', value: 3 },
];

export default function FilterSheet({ visible, onClose, filters, onApply }: FilterSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [local, setLocal] = useState<TripFilters>(filters);

  const update = (key: keyof TripFilters, value: any) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
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
          <ScrollView showsVerticalScrollIndicator={false} style={s.body}>
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
                <TextInput style={s.input} placeholder={t('common.noResults')} keyboardType="numeric"
                  value={local.max_price?.toString() ?? ''}
                  onChangeText={(v) => update('max_price', v ? Number(v) : undefined)}
                  placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
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
                <TextInput style={s.input} placeholder={t('common.noResults')} keyboardType="numeric"
                  value={local.max_participants?.toString() ?? ''}
                  onChangeText={(v) => update('max_participants', v ? Number(v) : undefined)}
                  placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <Text style={s.sectionLabel}>{t('filters.minRating')}</Text>
            <View style={s.ratingRow}>
              {RATING_OPTIONS.map((opt) => (
                <TouchableOpacity key={String(opt.value)}
                  style={[s.ratingChip, local.min_rating === opt.value && s.ratingChipActive]}
                  onPress={() => update('min_rating', opt.value)}>
                  <Text style={[s.ratingChipText, local.min_rating === opt.value && s.ratingChipTextActive]}>
                    {opt.label}
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
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32, maxHeight: '85%', ...Shadow.lg },
    handle: { width: 40, height: 4, backgroundColor: c.gray200, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    title: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    body: { paddingHorizontal: 20, paddingTop: 16 },
    sectionLabel: { fontSize: FontSize.sm, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    priceInput: { flex: 1 },
    inputLabel: { fontSize: FontSize.xs, color: c.textTertiary, marginBottom: 4 },
    input: { borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.md, color: c.textPrimary, backgroundColor: c.gray50 },
    priceDash: { paddingTop: 18 },
    dashText: { color: c.textTertiary, fontSize: FontSize.lg },
    ratingRow: { flexDirection: 'row', gap: 10 },
    ratingChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
    ratingChipActive: { borderColor: c.primary, backgroundColor: c.primarySurface },
    ratingChipText: { fontSize: FontSize.sm, fontWeight: '600', color: c.textSecondary },
    ratingChipTextActive: { color: c.primary },
    actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16 },
    resetBtn: { flex: 1 },
    applyBtn: { flex: 2 },
  });
}
