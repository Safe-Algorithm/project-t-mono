import React, { useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList,
  TextInput, Pressable, ScrollView, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { FieldMetadata, NationalityOption } from '../../hooks/useTrips';
import { COUNTRIES, Country } from '../ui/PhoneInput';
import { useLanguageStore } from '../../store/languageStore';

// ─── Field type constants (mirrors backend TripFieldType) ────────────────────
export type FieldType =
  | 'name' | 'email' | 'phone' | 'id_iqama_number' | 'passport_number'
  | 'date_of_birth' | 'gender' | 'address' | 'nationality'
  | 'disability' | 'medical_conditions' | 'allergies';

interface BackendOption { value: string; label: string; labelAlt?: string; }

interface Props {
  fieldType: FieldType;
  value: string;
  onChange: (value: string) => void;
  isRequired?: boolean;
  /** Field metadata fetched from backend (localized display_name, options, ui_type) */
  metadata?: FieldMetadata;
  /** Optional allowed_genders from validation_config — filters select options */
  allowedGenders?: string[];
  /** Nationality options fetched from /public-trips/nationalities */
  nationalityOptions?: NationalityOption[];
  /** Optional validation_config for the field (used to filter phone country codes) */
  validationConfig?: Record<string, any> | null;
}

export default function ParticipantField({ fieldType, value, onChange, isRequired, metadata, allowedGenders, nationalityOptions, validationConfig }: Props) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const label = metadata?.display_name ?? fieldType.replace(/_/g, ' ');
  const uiType = metadata?.ui_type ?? 'text';

  if (uiType === 'date') {
    return <DateField label={label} value={value} onChange={onChange} isRequired={isRequired} colors={colors} s={s} />;
  }

  // Nationality — searchable select from dynamic list
  if (fieldType === 'nationality' && nationalityOptions) {
    const natOptions: BackendOption[] = nationalityOptions.map((n) => ({
      value: n.code,
      label: n.name,
      labelAlt: n.name_ar ?? n.name_en,
    }));
    return <SearchableSelectField label={label} value={value} onChange={onChange} options={natOptions} isRequired={isRequired} colors={colors} s={s} />;
  }

  if (uiType === 'select' && metadata?.options) {
    let options: BackendOption[] = metadata.options;
    if (fieldType === 'gender' && allowedGenders) {
      options = options.filter((o) => allowedGenders.includes(o.value));
    }
    return <SelectField label={label} value={value} onChange={onChange} options={options} isRequired={isRequired} colors={colors} s={s} />;
  }

  if (uiType === 'textarea') {
    return <TextAreaField label={label} value={value} onChange={onChange} isRequired={isRequired} colors={colors} s={s} />;
  }

  // text / email / phone
  switch (fieldType) {
    case 'email':
      return <PlainInput label={label} value={value} onChange={onChange} isRequired={isRequired} keyboardType="email-address" autoCapitalize="none" colors={colors} s={s} />;
    case 'phone': {
      const allowedCodes: string[] | undefined = validationConfig?.phone_country_codes?.allowed_codes;
      return <PhoneDialField label={label} value={value} onChange={onChange} isRequired={isRequired} allowedDialCodes={allowedCodes} colors={colors} s={s} />;
    }
    case 'id_iqama_number':
    case 'passport_number':
      return <PlainInput label={label} value={value} onChange={onChange} isRequired={isRequired} keyboardType="default" autoCapitalize="characters" colors={colors} s={s} />;
    default:
      return <PlainInput label={label} value={value} onChange={onChange} isRequired={isRequired} colors={colors} s={s} />;
  }
}

// ─── Plain text input ────────────────────────────────────────────────────────
function PlainInput({ label, value, onChange, isRequired, keyboardType = 'default', autoCapitalize = 'words', colors, s }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} isRequired={isRequired} s={s} />
      <TextInput
        style={[s.input, focused && s.inputFocused]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.textTertiary}
        placeholder={label}
      />
    </View>
  );
}

// ─── Phone field with dial-code picker ───────────────────────────────────────
function PhoneDialField({ label, value, onChange, isRequired, allowedDialCodes, colors, s }: {
  label: string; value: string; onChange: (v: string) => void; isRequired?: boolean;
  allowedDialCodes?: string[]; colors: ThemeColors; s: any;
}) {
  const { t } = useTranslation();
  const { language } = useLanguageStore();

  // Build the country list, optionally filtered
  const availableCountries = useMemo(() => {
    if (!allowedDialCodes || allowedDialCodes.length === 0) return COUNTRIES;
    // allowed_codes may be stored as bare codes like "966" or "+966"
    const normalised = allowedDialCodes.map(c => c.startsWith('+') ? c : `+${c}`);
    return COUNTRIES.filter(c => normalised.includes(c.dialCode));
  }, [allowedDialCodes]);

  // Default to Saudi Arabia or the first available
  const defaultCountry = useMemo(
    () => availableCountries.find(c => c.dialCode === '+966') ?? availableCountries[0] ?? COUNTRIES[0],
    [availableCountries]
  );

  // Parse stored value to determine current dial code + local number
  const parseValue = (raw: string): { country: Country; local: string } => {
    if (!raw) return { country: defaultCountry, local: '' };
    for (const c of COUNTRIES) {
      if (raw.startsWith(c.dialCode)) {
        const match = availableCountries.find(ac => ac.dialCode === c.dialCode) ?? defaultCountry;
        return { country: match, local: raw.slice(c.dialCode.length) };
      }
    }
    return { country: defaultCountry, local: raw };
  };

  const parsed = parseValue(value);
  const [selectedCountry, setSelectedCountry] = useState<Country>(parsed.country);
  const [localNumber, setLocalNumber] = useState(parsed.local);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleCountryChange = (c: Country) => {
    setSelectedCountry(c);
    setPickerOpen(false);
    onChange(`${c.dialCode}${localNumber}`);
  };

  const handleLocalChange = (text: string) => {
    setLocalNumber(text);
    onChange(`${selectedCountry.dialCode}${text}`);
  };

  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} isRequired={isRequired} s={s} />
      <View style={[s.input, s.phoneRow, focused && s.inputFocused]}>
        <TouchableOpacity style={s.dialPickerBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
          <Text style={s.phoneFlag}>{selectedCountry.flag}</Text>
          <Text style={s.phoneDialCode}>{selectedCountry.dialCode}</Text>
          <Ionicons name="chevron-down" size={13} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={s.phoneDivider} />
        <TextInput
          style={s.phoneLocalInput}
          value={localNumber}
          onChangeText={handleLocalChange}
          keyboardType="phone-pad"
          placeholder={selectedCountry.placeholder}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>

      <Modal visible={pickerOpen} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={[s.selectSheet, { maxHeight: '70%' }]} onPress={e => e.stopPropagation()}>
            <View style={s.selectSheetHandle} />
            <Text style={s.selectSheetTitle}>{t('booking.selectDialCode', { defaultValue: 'Select Country Code' })}</Text>
            <FlatList
              data={availableCountries}
              keyExtractor={item => `${item.dialCode}-${item.name}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.dialCode === selectedCountry.dialCode && item.name === selectedCountry.name;
                return (
                  <TouchableOpacity
                    style={[s.selectOption, isSelected && s.selectOptionActive]}
                    onPress={() => handleCountryChange(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.phoneFlag}>{item.flag}</Text>
                    <Text style={[s.selectOptionText, isSelected && s.selectOptionTextActive, { flex: 1, marginLeft: 10 }]}>
                      {language === 'ar' ? item.name_ar : item.name}
                    </Text>
                    <Text style={{ fontSize: FontSize.md, color: colors.textSecondary, fontWeight: '600' }}>{item.dialCode}</Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Multi-line textarea ─────────────────────────────────────────────────────
function TextAreaField({ label, value, onChange, isRequired, colors, s }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} isRequired={isRequired} s={s} />
      <TextInput
        style={[s.input, s.textarea, focused && s.inputFocused]}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.textTertiary}
        placeholder={label}
      />
    </View>
  );
}

// ─── Date picker (pure RN scroll columns) ────────────────────────────────────
const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function ScrollColumn({ items, selectedIndex, onSelect, s }: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  s: any;
}) {
  const ref = useRef<ScrollView>(null);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    onSelect(clamped);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ height: PICKER_HEIGHT, flex: 1 }}
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={handleMomentumEnd}
      contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
    >
      {items.map((item, i) => (
        <TouchableOpacity
          key={item}
          style={[s.scrollColItem, i === selectedIndex && s.scrollColItemActive]}
          onPress={() => {
            onSelect(i);
            ref.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
          }}
          activeOpacity={0.7}
        >
          <Text style={[s.scrollColText, i === selectedIndex && s.scrollColTextActive]}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function DateField({ label, value, onChange, isRequired, colors, s }: any) {
  const { t, i18n } = useTranslation();
  const [show, setShow] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long' })
  );
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const parsed = value ? new Date(value + 'T12:00:00') : new Date(2000, 0, 1);
  const [selYear, setSelYear] = useState(years.indexOf(String(parsed.getFullYear())));
  const [selMonth, setSelMonth] = useState(parsed.getMonth());
  const [selDay, setSelDay] = useState(parsed.getDate() - 1);

  const displayValue = value
    ? new Date(value + 'T12:00:00').toLocaleDateString(
        i18n.language === 'ar' ? 'ar-SA' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric' }
      )
    : '';

  const confirm = () => {
    const y = years[selYear] ?? String(currentYear);
    const m = String(selMonth + 1).padStart(2, '0');
    const d = days[selDay] ?? '01';
    onChange(`${y}-${m}-${d}`);
    setShow(false);
  };

  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} isRequired={isRequired} s={s} />
      <TouchableOpacity style={s.selectBtn} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={18} color={displayValue ? colors.textPrimary : colors.textTertiary} />
        <Text style={[s.selectBtnText, !displayValue && s.selectBtnPlaceholder]}>
          {displayValue || label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setShow(false)}>
          <Pressable style={s.dateModalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.dateModalHandle} />
            <Text style={s.selectSheetTitle}>{label}</Text>
            <View style={s.dateColsRow}>
              <ScrollColumn items={days} selectedIndex={selDay} onSelect={setSelDay} s={s} />
              <ScrollColumn items={months} selectedIndex={selMonth} onSelect={setSelMonth} s={s} />
              <ScrollColumn items={years} selectedIndex={selYear} onSelect={setSelYear} s={s} />
            </View>
            <View style={s.dateModalActions}>
              <TouchableOpacity style={s.dateModalCancel} onPress={() => setShow(false)}>
                <Text style={s.dateModalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dateModalDone} onPress={confirm}>
                <Text style={s.dateModalDoneText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Select / dropdown ───────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options, isRequired, colors, s }: any) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const selected = options.find((o: BackendOption) => o.value === value);
  const displayLabel = selected?.label ?? '';

  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} isRequired={isRequired} s={s} />
      <TouchableOpacity style={s.selectBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Ionicons name="chevron-expand-outline" size={18} color={displayLabel ? colors.textPrimary : colors.textTertiary} />
        <Text style={[s.selectBtnText, !displayLabel && s.selectBtnPlaceholder]}>
          {displayLabel || label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={s.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={s.selectSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.selectSheetHandle} />
            <Text style={s.selectSheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item: BackendOption) => item.value}
              renderItem={({ item }: { item: BackendOption }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[s.selectOption, isSelected && s.selectOptionActive]}
                    onPress={() => { onChange(item.value); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.selectOptionText, isSelected && s.selectOptionTextActive]}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Searchable select (nationality) ─────────────────────────────────────────
function SearchableSelectField({ label, value, onChange, options, isRequired, colors, s }: any) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? options.filter((o: BackendOption) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.labelAlt ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const selected = options.find((o: BackendOption) => o.value === value);

  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} isRequired={isRequired} s={s} />
      <TouchableOpacity style={s.selectBtn} onPress={() => { setSearch(''); setOpen(true); }} activeOpacity={0.7}>
        <Ionicons name="earth-outline" size={18} color={selected ? colors.textPrimary : colors.textTertiary} />
        <Text style={[s.selectBtnText, !selected && s.selectBtnPlaceholder]}>
          {selected?.label ?? label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={s.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={[s.selectSheet, { maxHeight: '75%' }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.selectSheetHandle} />
            <Text style={s.selectSheetTitle}>{label}</Text>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <TextInput
                style={[s.input, { marginBottom: 0 }]}
                value={search}
                onChangeText={setSearch}
                placeholder={t('common.search', 'Search...')}
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item: BackendOption) => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }: { item: BackendOption }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[s.selectOption, isSelected && s.selectOptionActive]}
                    onPress={() => { onChange(item.value); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.selectOptionText, isSelected && s.selectOptionTextActive]}>{item.label}</Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={{ padding: 16, color: colors.textTertiary }}>{t('common.noResults', 'No results')}</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Shared label ────────────────────────────────────────────────────────────
function FieldLabel({ label, isRequired, s }: { label: string; isRequired?: boolean; s: any }) {
  return (
    <View style={s.labelRow}>
      <Text style={s.label}>{label}</Text>
      {isRequired && <Text style={s.required}>*</Text>}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    fieldWrap: { gap: 6 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    label: { fontSize: FontSize.sm, fontWeight: '600', color: c.textSecondary },
    required: { fontSize: FontSize.sm, color: c.error, fontWeight: '700' },

    input: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: FontSize.md,
      color: c.textPrimary,
      backgroundColor: c.surface,
    },
    inputFocused: { borderColor: c.primary },
    textarea: { minHeight: 80, paddingTop: 12 },

    phoneRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, paddingVertical: 0 },
    dialPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 12 },
    phoneFlag: { fontSize: 22 },
    phoneDialCode: { fontSize: FontSize.md, fontWeight: '700', color: c.textPrimary },
    phoneDivider: { width: 1, height: 22, backgroundColor: c.border },
    phoneLocalInput: { flex: 1, fontSize: FontSize.md, color: c.textPrimary, paddingHorizontal: 12, paddingVertical: 12 },

    selectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: c.surface,
    },
    selectBtnText: { flex: 1, fontSize: FontSize.md, color: c.textPrimary },
    selectBtnPlaceholder: { color: c.textTertiary },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },

    selectSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      paddingBottom: 32,
      maxHeight: '60%',
      ...Shadow.lg,
    },
    selectSheetHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: c.gray200,
      alignSelf: 'center',
      marginTop: 12, marginBottom: 8,
    },
    selectSheetTitle: {
      fontSize: FontSize.lg,
      fontWeight: '700',
      color: c.textPrimary,
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    selectOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    selectOptionActive: { backgroundColor: c.primarySurface },
    selectOptionText: { fontSize: FontSize.md, color: c.textPrimary },
    selectOptionTextActive: { color: c.primary, fontWeight: '700' },

    dateModalSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      paddingBottom: 32,
      ...Shadow.lg,
    },
    dateModalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: c.gray200,
      alignSelf: 'center',
      marginTop: 12, marginBottom: 8,
    },
    dateColsRow: {
      flexDirection: 'row',
      overflow: 'hidden',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    scrollColItem: {
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollColItemActive: { backgroundColor: c.primarySurface },
    scrollColText: { fontSize: FontSize.md, color: c.textSecondary },
    scrollColTextActive: { fontSize: FontSize.md, color: c.primary, fontWeight: '700' },
    dateModalActions: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    dateModalCancel: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
    },
    dateModalCancelText: { fontSize: FontSize.md, fontWeight: '600', color: c.textSecondary },
    dateModalDone: {
      flex: 1,
      paddingVertical: 12,
      backgroundColor: c.primary,
      borderRadius: Radius.lg,
      alignItems: 'center',
    },
    dateModalDoneText: { fontSize: FontSize.md, fontWeight: '700', color: c.white },
  });
}
