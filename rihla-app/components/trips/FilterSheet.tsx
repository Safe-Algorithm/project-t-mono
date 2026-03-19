import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
import {
  TripFilters,
  useDestinations,
  useFilterStartingCities,
  useFilterStartingCountries,
  useFilterDestinationCountries,
  DestinationOption,
  CountryOption,
  StartingCityOption,
} from '../../hooks/useTrips';
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

function getCountryName(c: CountryOption) {
  return i18n.language === 'ar' ? c.name_ar || c.name_en : c.name_en || c.name_ar;
}

function getStartingCityName(c: StartingCityOption) {
  return i18n.language === 'ar' ? c.name_ar || c.name_en : c.name_en || c.name_ar;
}

const LIST_PAGE = 20;

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
    listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: Radius.md, marginBottom: 3, backgroundColor: c.gray50 },
    listRowActive: { backgroundColor: c.primarySurface },
    listRowText: { fontSize: FontSize.md, color: c.textPrimary, fontWeight: '500', flex: 1 },
    listRowTextActive: { color: c.primary, fontWeight: '700' },
    loadMoreBtn: { paddingVertical: 12, alignItems: 'center' },
    loadMoreText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600' },
    dateSelectBtnActive: { borderColor: c.primary, backgroundColor: c.primarySurface },
    locSheet: { backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, height: '75%', flexDirection: 'column', ...Shadow.lg },
    locSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 20, marginBottom: 8, backgroundColor: c.background },
    locSearchInput: { flex: 1, fontSize: FontSize.md, color: c.textPrimary, padding: 0 },
    locList: { flex: 1 },
    locListContent: { paddingHorizontal: 20, paddingBottom: 8 },
    locDoneRow: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: c.border },
    locDoneBtn: { backgroundColor: c.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
    locDoneBtnText: { fontSize: FontSize.md, fontWeight: '700', color: c.white },
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

function PickerButton({
  label,
  selectedSummary,
  onPress,
  onClear,
  colors,
  s,
}: {
  label: string;
  selectedSummary: string;
  onPress: () => void;
  onClear: () => void;
  colors: ThemeColors;
  s: ReturnType<typeof makeStyles>;
}) {
  const hasSelection = !!selectedSummary;
  return (
    <TouchableOpacity
      style={[s.dateSelectBtn, hasSelection && s.dateSelectBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name="location-outline" size={18} color={hasSelection ? colors.primary : colors.textTertiary} />
      <Text style={[s.dateSelectBtnText, !hasSelection && { color: colors.textTertiary }]} numberOfLines={1}>
        {hasSelection ? selectedSummary : label}
      </Text>
      {hasSelection ? (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onClear(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={18} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

function PickerModal<T>({
  visible,
  onClose,
  label,
  items,
  getKey,
  getName,
  isSelected,
  onToggle,
  searchPlaceholder,
  multiSelect,
  colors,
  s,
}: {
  visible: boolean;
  onClose: () => void;
  label: string;
  items: T[];
  getKey: (item: T) => string;
  getName: (item: T) => string;
  isSelected: (item: T) => boolean;
  onToggle: (item: T) => void;
  searchPlaceholder: string;
  multiSelect?: boolean;
  colors: ThemeColors;
  s: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const { translateY: sheetTY, backdropOpacity: sheetBgOp, panHandlers: sheetPan, openSheet, closeSheet } =
    useDragToDismiss(onClose);

  useLayoutEffect(() => {
    if (visible) { setSearch(''); setPage(1); openSheet(); }
  }, [visible]);

  const filtered = search.trim()
    ? items.filter((item) => getName(item).toLowerCase().includes(search.toLowerCase()))
    : items;
  const visible2 = filtered.slice(0, page * LIST_PAGE);
  const hasMore = visible2.length < filtered.length;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeSheet()}>
      <Animated.View style={[s.dateModalOverlay, { backgroundColor: 'transparent' }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: sheetBgOp }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet()} />
        <Animated.View style={[s.locSheet, { transform: [{ translateY: sheetTY }] }]}>
          <View style={s.dateModalDragZone} {...sheetPan}>
            <View style={s.dateModalHandle} />
            <Text style={s.dateModalTitle}>{label}</Text>
          </View>
          <View style={s.locSearchRow}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={s.locSearchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={(v) => { setSearch(v); setPage(1); }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setPage(1); }}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            style={s.locList}
            contentContainerStyle={s.locListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {visible2.length === 0 ? (
              <Text style={[s.emptyHint, { textAlign: 'center', marginTop: 16 }]}>
                {t('filters.noOptions', 'No options available')}
              </Text>
            ) : (
              visible2.map((item) => {
                const selected = isSelected(item);
                return (
                  <TouchableOpacity
                    key={getKey(item)}
                    style={[s.listRow, selected && s.listRowActive]}
                    onPress={() => { onToggle(item); if (!multiSelect) closeSheet(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.listRowText, selected && s.listRowTextActive]}>{getName(item)}</Text>
                    {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })
            )}
            {hasMore && (
              <TouchableOpacity style={s.loadMoreBtn} onPress={() => setPage((p) => p + 1)}>
                <Text style={s.loadMoreText}>
                  {t('filters.showMore', 'Show more')} ({filtered.length - visible2.length})
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          {multiSelect && (
            <View style={s.locDoneRow}>
              <TouchableOpacity style={s.locDoneBtn} onPress={() => closeSheet()}>
                <Text style={s.locDoneBtnText}>{t('common.done', 'Done')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
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

  useLayoutEffect(() => { if (show) openDate(); }, [show]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => String(currentYear + i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const parsed = value ? new Date(value + 'T12:00:00') : today;
  const [selYear, setSelYear] = useState(() => {
    const idx = years.indexOf(String(value ? parsed.getFullYear() : currentYear));
    return idx >= 0 ? idx : 0;
  });
  const [selMonth, setSelMonth] = useState(value ? parsed.getMonth() : today.getMonth());
  const [selDay, setSelDay] = useState(value ? parsed.getDate() - 1 : today.getDate() - 1);

  const yearNum = parseInt(years[selYear] ?? String(currentYear), 10);
  const days = Array.from(
    { length: new Date(yearNum, selMonth + 1, 0).getDate() },
    (_, i) => String(i + 1).padStart(2, '0')
  );

  const handleMonthSelect = (i: number) => {
    setSelMonth(i);
    const maxDay = new Date(yearNum, i + 1, 0).getDate() - 1;
    if (selDay > maxDay) setSelDay(maxDay);
  };
  const handleYearSelect = (i: number) => {
    setSelYear(i);
    const y = parseInt(years[i] ?? String(currentYear), 10);
    const maxDay = new Date(y, selMonth + 1, 0).getDate() - 1;
    if (selDay > maxDay) setSelDay(maxDay);
  };

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
              <ScrollCol items={days} selectedIndex={Math.min(selDay, days.length - 1)} onSelect={setSelDay} s={s} />
              <ScrollCol items={months} selectedIndex={selMonth} onSelect={handleMonthSelect} s={s} />
              <ScrollCol items={years} selectedIndex={selYear} onSelect={handleYearSelect} s={s} />
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
  const { data: startingCities = [] } = useFilterStartingCities();
  const { data: startingCountries = [] } = useFilterStartingCountries();
  const { data: destCountries = [] } = useFilterDestinationCountries();

  // Location picker open state (lifted out of nested Modal)
  const [pickerOpen, setPickerOpen] = useState<'startCountry' | 'startCity' | 'destCountry' | 'destCity' | null>(null);

  // Local YYYY-MM-DD strings for the date inputs (display only; converted to UTC ISO on apply)
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  // Drag-to-dismiss
  const { translateY, backdropOpacity, panHandlers, openSheet, closeSheet } = useDragToDismiss(onClose);

  useLayoutEffect(() => { if (visible) openSheet(); }, [visible]);

  // Flatten all destination cities from the tree
  const allDestCities: DestinationOption[] = destinationTree.flatMap(
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
    onApply({});
    closeSheet();
  };

  return (
    <>
    <PickerModal
      visible={pickerOpen === 'startCountry'}
      onClose={() => setPickerOpen(null)}
      label={t('filters.startingCountry', 'Starting Country')}
      items={startingCountries}
      getKey={(c) => c.country_code}
      getName={getCountryName}
      isSelected={(c) => local.starting_country_code === c.country_code}
      onToggle={(c) => update('starting_country_code', local.starting_country_code === c.country_code ? undefined : c.country_code)}
      searchPlaceholder={t('filters.searchCountry', 'Search country...')}
      colors={colors}
      s={s}
    />
    <PickerModal
      visible={pickerOpen === 'startCity'}
      onClose={() => setPickerOpen(null)}
      label={t('filters.startingCity', 'Starting City')}
      items={startingCities}
      getKey={(c) => c.id}
      getName={getStartingCityName}
      isSelected={(c) => local.starting_city_id === c.id}
      onToggle={(c) => update('starting_city_id', local.starting_city_id === c.id ? undefined : c.id)}
      searchPlaceholder={t('filters.searchCity', 'Search city...')}
      colors={colors}
      s={s}
    />
    <PickerModal
      visible={pickerOpen === 'destCountry'}
      onClose={() => setPickerOpen(null)}
      label={t('filters.destinationCountry', 'Destination Country')}
      items={destCountries}
      getKey={(c) => c.country_code}
      getName={getCountryName}
      isSelected={(c) => (local.destination_country_codes ?? []).includes(c.country_code)}
      onToggle={(c) => {
        const current = local.destination_country_codes ?? [];
        const next = current.includes(c.country_code)
          ? current.filter((x) => x !== c.country_code)
          : [...current, c.country_code];
        update('destination_country_codes', next.length ? next : undefined);
      }}
      searchPlaceholder={t('filters.searchCountry', 'Search country...')}
      multiSelect
      colors={colors}
      s={s}
    />
    <PickerModal
      visible={pickerOpen === 'destCity'}
      onClose={() => setPickerOpen(null)}
      label={t('filters.destinationCity', 'Destination City')}
      items={allDestCities}
      getKey={(c) => c.id}
      getName={getDestName}
      isSelected={(c) => (local.destination_ids ?? []).includes(c.id)}
      onToggle={(c) => toggleDestination(c.id)}
      searchPlaceholder={t('filters.searchCity', 'Search city...')}
      multiSelect
      colors={colors}
      s={s}
    />
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

            {/* Starting Country */}
            <Text style={s.sectionLabel}>{t('filters.startingCountry', 'Starting Country')}</Text>
            <PickerButton
              label={t('filters.startingCountry', 'Starting Country')}
              selectedSummary={startingCountries.find((c) => c.country_code === local.starting_country_code) ? getCountryName(startingCountries.find((c) => c.country_code === local.starting_country_code)!) : ''}
              onPress={() => setPickerOpen('startCountry')}
              onClear={() => update('starting_country_code', undefined)}
              colors={colors}
              s={s}
            />

            {/* Starting City */}
            <Text style={s.sectionLabel}>{t('filters.startingCity', 'Starting City')}</Text>
            <PickerButton
              label={t('filters.startingCity', 'Starting City')}
              selectedSummary={startingCities.find((c) => c.id === local.starting_city_id) ? getStartingCityName(startingCities.find((c) => c.id === local.starting_city_id)!) : ''}
              onPress={() => setPickerOpen('startCity')}
              onClear={() => update('starting_city_id', undefined)}
              colors={colors}
              s={s}
            />

            {/* Destination Country */}
            <Text style={s.sectionLabel}>{t('filters.destinationCountry', 'Destination Country')}</Text>
            <PickerButton
              label={t('filters.destinationCountry', 'Destination Country')}
              selectedSummary={(local.destination_country_codes ?? []).map((code) => {
                const c = destCountries.find((x) => x.country_code === code);
                return c ? getCountryName(c) : code;
              }).join(', ')}
              onPress={() => setPickerOpen('destCountry')}
              onClear={() => update('destination_country_codes', undefined)}
              colors={colors}
              s={s}
            />

            {/* Destination City */}
            <Text style={s.sectionLabel}>{t('filters.destinationCity', 'Destination City')}</Text>
            <PickerButton
              label={t('filters.destinationCity', 'Destination City')}
              selectedSummary={(local.destination_ids ?? []).map((id) => {
                const c = allDestCities.find((x) => x.id === id);
                return c ? getDestName(c) : id;
              }).join(', ')}
              onPress={() => setPickerOpen('destCity')}
              onClear={() => update('destination_ids', undefined)}
              colors={colors}
              s={s}
            />

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
    </>
  );
}

