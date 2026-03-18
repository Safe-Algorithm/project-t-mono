import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  PanResponder,
  Animated,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';
import { Radius, FontSize, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import Button from '../ui/Button';
import { TripFilters, useDestinations, DestinationOption } from '../../hooks/useTrips';
import { useDragToDismiss } from '../../hooks/useDragToDismiss';

/**
 * Convert a YYYY-MM-DD string to a UTC ISO string representing the start (00:00)
 * or end (23:59:59) of that day in the device's local timezone.
 * This matches the user's intent: "trips starting on June 1" means June 1 in
 * their local time, regardless of what timezone they are in.
 */
function localDateToUtcIso(dateStr: string, endOfDay = false): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const local = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return local.toISOString();
}


interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: TripFilters;
  onApply: (filters: TripFilters) => void;
}

const ALL_AMENITIES = [
  'flight_tickets', 'bus', 'tour_guide', 'tours',
  'hotel', 'meals', 'insurance', 'visa_assistance',
  'international_drivers_license', 'omra_assistance',
] as const;

const RATING_STAR_OPTIONS = [
  { labelKey: 'filters.ratingAny', value: undefined },
  { label: '5 ★', value: 5 },
  { label: '4+ ★', value: 4 },
  { label: '3+ ★', value: 3 },
  { label: '2+ ★', value: 2 },
  { label: '1+ ★', value: 1 },
];

function getDestName(d: DestinationOption) {
  return i18n.language === 'ar' ? d.name_ar || d.name_en : d.name_en || d.name_ar;
}

// ─── Drum-scroll date picker (same as DOB field) ─────────────────────────────
const ITEM_H = 44;
const VISIBLE = 5;
const COL_H = ITEM_H * VISIBLE;

function ScrollCol({ items, selectedIndex, onSelect, s }: {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  s: ReturnType<typeof makeStyles>;
}) {
  const ref = useRef<ScrollView>(null);
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onSelect(Math.max(0, Math.min(items.length - 1, idx)));
  };
  return (
    <ScrollView
      ref={ref}
      style={{ height: COL_H, flex: 1 }}
      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={onEnd}
      contentOffset={{ x: 0, y: selectedIndex * ITEM_H }}
    >
      {items.map((item, i) => (
        <TouchableOpacity
          key={item}
          style={[s.scrollColItem, i === selectedIndex && s.scrollColItemActive]}
          onPress={() => { onSelect(i); ref.current?.scrollTo({ y: i * ITEM_H, animated: true }); }}
          activeOpacity={0.7}
        >
          <Text style={[s.scrollColText, i === selectedIndex && s.scrollColTextActive]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function DatePickerRow({ label, value, onChange, colors, s }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: ThemeColors;
  s: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const { translateY: dateTY, backdropOpacity: dateBgOp, panHandlers: datePan, openSheet: openDate, closeSheet: closeDate } = useDragToDismiss(() => setShow(false));

  useEffect(() => { if (show) openDate(); }, [show]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => String(currentYear + i));
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' })
  );
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const parsed = value ? new Date(value + 'T12:00:00') : today;
  const [selYear, setSelYear] = useState(() => {
    const idx = years.indexOf(String(value ? parsed.getFullYear() : currentYear));
    return idx >= 0 ? idx : 0;
  });
  const [selMonth, setSelMonth] = useState(value ? parsed.getMonth() : today.getMonth());
  const [selDay, setSelDay] = useState(value ? parsed.getDate() - 1 : today.getDate() - 1);

  const displayValue = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  const confirm = () => {
    const y = years[selYear] ?? String(currentYear);
    const m = String(selMonth + 1).padStart(2, '0');
    const d = days[selDay] ?? '01';
    onChange(`${y}-${m}-${d}`);
    closeDate();
  };

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.inputLabel}>{label}</Text>
      <TouchableOpacity style={s.dateSelectBtn} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={18} color={displayValue ? colors.textPrimary : colors.textTertiary} />
        <Text style={[s.dateSelectBtnText, !displayValue && { color: colors.textTertiary }]}>
          {displayValue || label}
        </Text>
        {displayValue ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="none">
        <Animated.View style={[s.dateModalOverlay, { backgroundColor: 'transparent' }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: dateBgOp }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDate()} />
          <Animated.View style={[s.dateModalSheet, { transform: [{ translateY: dateTY }] }]}>
            <View style={s.dateModalDragZone} {...datePan}>
              <View style={s.dateModalHandle} />
              <Text style={s.dateModalTitle}>{label}</Text>
            </View>
            <View style={s.dateColsRow}>
              <ScrollCol items={days} selectedIndex={selDay} onSelect={setSelDay} s={s} />
              <ScrollCol items={months} selectedIndex={selMonth} onSelect={setSelMonth} s={s} />
              <ScrollCol items={years} selectedIndex={selYear} onSelect={setSelYear} s={s} />
            </View>
            <View style={s.dateModalActions}>
              <TouchableOpacity style={s.dateModalCancel} onPress={() => closeDate()}>
                <Text style={s.dateModalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dateModalDone} onPress={confirm}>
                <Text style={s.dateModalDoneText}>{t('common.done', 'Done')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

export default function FilterSheet({ visible, onClose, filters, onApply }: FilterSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [local, setLocal] = useState<TripFilters>(filters);
  const { data: destinationTree = [] } = useDestinations();

  // Local YYYY-MM-DD strings for the date inputs (display only; converted to UTC ISO on apply)
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  // Search state for city pickers
  const [destSearch, setDestSearch] = useState('');
  const [startCitySearch, setStartCitySearch] = useState('');

  // Drag-to-dismiss
  const { translateY, backdropOpacity, panHandlers, openSheet, closeSheet } = useDragToDismiss(onClose);

  useEffect(() => { if (visible) openSheet(); }, [visible]);

  // Flatten all cities from the destination tree for the picker
  const allCities: DestinationOption[] = destinationTree.flatMap(
    (country) => country.children?.filter((c) => c.type === 'city') ?? []
  );

  const filteredDestCities = destSearch.trim()
    ? allCities.filter((c) =>
        getDestName(c).toLowerCase().includes(destSearch.toLowerCase())
      )
    : allCities;

  const filteredStartCities = startCitySearch.trim()
    ? allCities.filter((c) =>
        getDestName(c).toLowerCase().includes(startCitySearch.toLowerCase())
      )
    : allCities;

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

  // Validate YYYY-MM-DD format
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  const handleApply = () => {
    const applied = { ...local };
    if (startDateStr && isValidDate(startDateStr)) {
      applied.start_date_from = localDateToUtcIso(startDateStr, false);
    } else {
      delete applied.start_date_from;
    }
    if (endDateStr && isValidDate(endDateStr)) {
      applied.start_date_to = localDateToUtcIso(endDateStr, true);
    } else {
      delete applied.start_date_to;
    }
    onApply(applied);
    onClose();
  };

  // Reset draft when sheet closes without applying
  const handleClose = () => {
    setLocal(filters);
    const fromIso = filters.start_date_from;
    const toIso = filters.start_date_to;
    setStartDateStr(fromIso ? fromIso.slice(0, 10) : '');
    setEndDateStr(toIso ? toIso.slice(0, 10) : '');
    closeSheet();
  };

  const handleReset = () => {
    setLocal({});
    setStartDateStr('');
    setEndDateStr('');
    setDestSearch('');
    setStartCitySearch('');
    onApply({});
    closeSheet();
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleClose}>
      <Animated.View style={[s.backdrop, { backgroundColor: 'transparent' }]}>
        <Animated.View style={[s.backdropDim, { opacity: backdropOpacity }]} />
        <TouchableOpacity style={s.backdropTouch} onPress={handleClose} />
        <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
          <View style={s.dragZone} {...panHandlers}>
            <View style={s.handleBar}>
              <View style={s.handle} />
            </View>
            <View style={s.header}>
              <Text style={s.title}>{t('filters.title')}</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={s.body} contentContainerStyle={s.bodyContent}>

            {/* Destinations (OR multi-select) */}
            <Text style={s.sectionLabel}>{t('filters.destinations')}</Text>
            <Text style={s.sectionHint}>{t('filters.destinationsHint')}</Text>
            {allCities.length === 0 ? (
              <Text style={s.emptyHint}>{t('filters.noDestinations', 'No destinations available')}</Text>
            ) : (
              <>
                {allCities.length > 6 && (
                  <View style={s.searchRow}>
                    <Ionicons name="search" size={15} color={colors.textTertiary} />
                    <TextInput
                      style={s.searchInput}
                      placeholder={t('filters.searchDestinations', 'Search destinations...')}
                      placeholderTextColor={colors.textTertiary}
                      value={destSearch}
                      onChangeText={setDestSearch}
                    />
                    {destSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setDestSearch('')}>
                        <Ionicons name="close-circle" size={15} color={colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <View style={s.chipWrap}>
                  {filteredDestCities.length === 0 ? (
                    <Text style={s.emptyHint}>{t('filters.noResults', 'No results')}</Text>
                  ) : (
                    filteredDestCities.map((city) => {
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
                    })
                  )}
                </View>
              </>
            )}

            {/* Starting City (single-select) */}
            <Text style={s.sectionLabel}>{t('filters.startingCity', 'Starting City')}</Text>
            <Text style={s.sectionHint}>{t('filters.startingCityHint', 'Filter by where the trip departs from')}</Text>
            {allCities.length === 0 ? (
              <Text style={s.emptyHint}>{t('filters.noDestinations', 'No destinations available')}</Text>
            ) : (
              <>
                {allCities.length > 6 && (
                  <View style={s.searchRow}>
                    <Ionicons name="search" size={15} color={colors.textTertiary} />
                    <TextInput
                      style={s.searchInput}
                      placeholder={t('filters.searchStartingCity', 'Search city...')}
                      placeholderTextColor={colors.textTertiary}
                      value={startCitySearch}
                      onChangeText={setStartCitySearch}
                    />
                    {startCitySearch.length > 0 && (
                      <TouchableOpacity onPress={() => setStartCitySearch('')}>
                        <Ionicons name="close-circle" size={15} color={colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <View style={s.chipWrap}>
                  {[{ id: undefined as string | undefined, name_en: t('filters.any', 'Any'), name_ar: t('filters.any', 'Any'), type: 'city', country_code: '' }, ...filteredStartCities].map((city) => {
                    const selected = local.starting_city_id === city.id;
                    return (
                      <TouchableOpacity
                        key={city.id ?? 'any'}
                        style={[s.ratingChip, selected && s.ratingChipActive]}
                        onPress={() => update('starting_city_id', city.id)}
                      >
                        <Text style={[s.ratingChipText, selected && s.ratingChipTextActive]}>
                          {getDestName(city as DestinationOption)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

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

            {/* Trip Nature */}
            <Text style={s.sectionLabel}>{t('filters.tripNature')}</Text>
            <Text style={s.sectionHint}>{t('filters.tripNatureHint')}</Text>
            <View style={s.ratingRow}>
              {([
                { labelKey: 'filters.allNatures', value: undefined },
                { labelKey: 'filters.guidedTrip', value: 'guided' },
                { labelKey: 'filters.tourismPackage', value: 'self_arranged' },
              ] as { labelKey: string; value: string | undefined }[]).map((opt) => (
                <TouchableOpacity key={String(opt.value)}
                  style={[s.ratingChip, local.trip_type === opt.value && s.ratingChipActive]}
                  onPress={() => update('trip_type', opt.value)}>
                  <Text style={[s.ratingChipText, local.trip_type === opt.value && s.ratingChipTextActive]}>
                    {t(opt.labelKey as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Range - #13 replaced manual text input with picker */}
            <Text style={s.sectionLabel}>{t('filters.dateRange', 'Trip Start Date')}</Text>
            <Text style={s.sectionHint}>{t('filters.dateRangeHint', 'Filter trips by when they start')}</Text>

            <DatePickerRow
              label={t('filters.dateFrom', 'From')}
              value={startDateStr}
              onChange={setStartDateStr}
              colors={colors}
              s={s}
            />
            <DatePickerRow
              label={t('filters.dateTo', 'To')}
              value={endDateStr}
              onChange={setEndDateStr}
              colors={colors}
              s={s}
            />

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
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end' },
    backdropDim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
    backdropTouch: { ...StyleSheet.absoluteFillObject },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', flexDirection: 'column', ...Shadow.lg },
    dragZone: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', backgroundColor: c.surface },
    handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 4, paddingHorizontal: 40 },
    handle: { width: 40, height: 4, backgroundColor: c.gray300, borderRadius: 2 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    title: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    body: { flexShrink: 1, paddingHorizontal: 20, paddingTop: 16 },
    bodyContent: { paddingBottom: 24 },
    sectionLabel: { fontSize: FontSize.sm, fontWeight: '700', color: c.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    priceInput: { flex: 1 },
    inputLabel: { fontSize: FontSize.xs, color: c.textSecondary, marginBottom: 4, fontWeight: '600' },
    input: { borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.md, color: c.textPrimary, backgroundColor: c.surface },
    inputError: { borderColor: c.error },
    priceDash: { paddingTop: 18 },
    dashText: { color: c.textTertiary, fontSize: FontSize.lg },
    sectionHint: { fontSize: FontSize.xs, color: c.textSecondary, marginBottom: 10, marginTop: -6 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    ratingChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
    ratingChipActive: { borderColor: c.primary, backgroundColor: c.primary },
    ratingChipText: { fontSize: FontSize.sm, fontWeight: '600', color: c.textPrimary },
    ratingChipTextActive: { color: c.white },
    actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: c.border },
    resetBtn: { flex: 1 },
    applyBtn: { flex: 2 },
    emptyHint: { fontSize: FontSize.sm, color: c.textTertiary, fontStyle: 'italic', marginBottom: 4 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.surface, marginBottom: 10 },
    searchInput: { flex: 1, fontSize: FontSize.sm, color: c.textPrimary, padding: 0 },
    dateSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: c.surface, marginBottom: 4 },
    dateSelectBtnText: { flex: 1, fontSize: FontSize.md, color: c.textPrimary, fontWeight: '500' },
    dateModalOverlay: { flex: 1, justifyContent: 'flex-end' },
    dateModalSheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, paddingHorizontal: 20 },
    dateModalDragZone: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', backgroundColor: c.surface, alignItems: 'center', paddingBottom: 8 },
    dateModalHandle: { width: 40, height: 4, backgroundColor: c.gray300, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
    dateModalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary, textAlign: 'center', marginBottom: 8 },
    dateColsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    scrollColItem: { height: ITEM_H, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.md },
    scrollColItemActive: { backgroundColor: c.primarySurface },
    scrollColText: { fontSize: FontSize.md, color: c.textSecondary, fontWeight: '500' },
    scrollColTextActive: { fontSize: FontSize.md, color: c.primary, fontWeight: '700' },
    dateModalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
    dateModalCancel: { flex: 1, paddingVertical: 14, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
    dateModalCancelText: { fontSize: FontSize.md, fontWeight: '600', color: c.textSecondary },
    dateModalDone: { flex: 2, paddingVertical: 14, borderRadius: Radius.lg, backgroundColor: c.primary, alignItems: 'center' },
    dateModalDoneText: { fontSize: FontSize.md, fontWeight: '700', color: c.white },
  });
}
