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
import { Colors, Radius, FontSize, Spacing, Shadow } from '../../constants/Theme';
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
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('filters.title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            {/* Price Range */}
            <Text style={styles.sectionLabel}>{t('filters.priceRange')}</Text>
            <View style={styles.row}>
              <View style={styles.priceInput}>
                <Text style={styles.inputLabel}>{t('filters.minPrice')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={local.min_price?.toString() ?? ''}
                  onChangeText={(v) => update('min_price', v ? Number(v) : undefined)}
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <View style={styles.priceDash}>
                <Text style={styles.dashText}>—</Text>
              </View>
              <View style={styles.priceInput}>
                <Text style={styles.inputLabel}>{t('filters.maxPrice')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('common.noResults')}
                  keyboardType="numeric"
                  value={local.max_price?.toString() ?? ''}
                  onChangeText={(v) => update('max_price', v ? Number(v) : undefined)}
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            </View>

            {/* Participants */}
            <Text style={styles.sectionLabel}>{t('filters.participants')}</Text>
            <View style={styles.row}>
              <View style={styles.priceInput}>
                <Text style={styles.inputLabel}>{t('filters.minParticipants')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  keyboardType="numeric"
                  value={local.min_participants?.toString() ?? ''}
                  onChangeText={(v) => update('min_participants', v ? Number(v) : undefined)}
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <View style={styles.priceDash}>
                <Text style={styles.dashText}>—</Text>
              </View>
              <View style={styles.priceInput}>
                <Text style={styles.inputLabel}>{t('filters.maxParticipants')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('common.noResults')}
                  keyboardType="numeric"
                  value={local.max_participants?.toString() ?? ''}
                  onChangeText={(v) => update('max_participants', v ? Number(v) : undefined)}
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            </View>

            {/* Rating */}
            <Text style={styles.sectionLabel}>{t('filters.minRating')}</Text>
            <View style={styles.ratingRow}>
              {RATING_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[
                    styles.ratingChip,
                    local.min_rating === opt.value && styles.ratingChipActive,
                  ]}
                  onPress={() => update('min_rating', opt.value)}
                >
                  <Text
                    style={[
                      styles.ratingChipText,
                      local.min_rating === opt.value && styles.ratingChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button title={t('filters.resetFilters')} variant="outline" onPress={handleReset} style={styles.resetBtn} />
            <Button title={t('filters.applyFilters')} onPress={handleApply} style={styles.applyBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 32,
    maxHeight: '85%',
    ...Shadow.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.gray200,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: { flex: 1 },
  inputLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.gray50,
  },
  priceDash: { paddingTop: 18 },
  dashText: { color: Colors.textTertiary, fontSize: FontSize.lg },
  ratingRow: { flexDirection: 'row', gap: 10 },
  ratingChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  ratingChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  ratingChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  ratingChipTextActive: { color: Colors.primary },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  resetBtn: { flex: 1 },
  applyBtn: { flex: 2 },
});
