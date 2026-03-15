import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Radius, Spacing, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguageStore } from '../../store/languageStore';
import { useTranslation } from 'react-i18next';

export interface Country {
  name: string;
  name_ar: string;
  dialCode: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES: Country[] = [
  { name: 'Saudi Arabia',      name_ar: 'المملكة العربية السعودية', dialCode: '+966', flag: '🇸🇦', placeholder: '5X XXX XXXX' },
  { name: 'United Arab Emirates', name_ar: 'الإمارات العربية المتحدة', dialCode: '+971', flag: '🇦🇪', placeholder: '5X XXX XXXX' },
  { name: 'Kuwait',            name_ar: 'الكويت',            dialCode: '+965', flag: '🇰🇼', placeholder: 'XXXX XXXX' },
  { name: 'Qatar',             name_ar: 'قطر',               dialCode: '+974', flag: '🇶🇦', placeholder: 'XXXX XXXX' },
  { name: 'Bahrain',           name_ar: 'البحرين',           dialCode: '+973', flag: '🇧🇭', placeholder: 'XXXX XXXX' },
  { name: 'Oman',              name_ar: 'عُمان',             dialCode: '+968', flag: '🇴🇲', placeholder: 'XXXX XXXX' },
  { name: 'Jordan',            name_ar: 'الأردن',            dialCode: '+962', flag: '🇯🇴', placeholder: '7X XXX XXXX' },
  { name: 'Egypt',             name_ar: 'مصر',               dialCode: '+20',  flag: '🇪🇬', placeholder: '10 XXXX XXXX' },
  { name: 'Lebanon',           name_ar: 'لبنان',             dialCode: '+961', flag: '🇱🇧', placeholder: 'X XXX XXX' },
  { name: 'Iraq',              name_ar: 'العراق',            dialCode: '+964', flag: '🇮🇶', placeholder: '7XX XXX XXXX' },
  { name: 'Syria',             name_ar: 'سوريا',             dialCode: '+963', flag: '🇸🇾', placeholder: '9XX XXX XXX' },
  { name: 'Yemen',             name_ar: 'اليمن',             dialCode: '+967', flag: '🇾🇪', placeholder: '7XX XXX XXX' },
  { name: 'Morocco',           name_ar: 'المغرب',            dialCode: '+212', flag: '🇲🇦', placeholder: '6XX XXX XXX' },
  { name: 'Algeria',           name_ar: 'الجزائر',           dialCode: '+213', flag: '🇩🇿', placeholder: '6XX XXX XXX' },
  { name: 'Tunisia',           name_ar: 'تونس',              dialCode: '+216', flag: '🇹🇳', placeholder: '2X XXX XXX' },
  { name: 'Libya',             name_ar: 'ليبيا',             dialCode: '+218', flag: '🇱🇾', placeholder: '9X XXX XXXX' },
  { name: 'Sudan',             name_ar: 'السودان',           dialCode: '+249', flag: '🇸🇩', placeholder: '9X XXX XXXX' },
  { name: 'Pakistan',          name_ar: 'باكستان',           dialCode: '+92',  flag: '🇵🇰', placeholder: '3XX XXX XXXX' },
  { name: 'India',             name_ar: 'الهند',             dialCode: '+91',  flag: '🇮🇳', placeholder: 'XXXXX XXXXX' },
  { name: 'Bangladesh',        name_ar: 'بنغلاديش',          dialCode: '+880', flag: '🇧🇩', placeholder: '1XXX XXX XXX' },
  { name: 'Philippines',       name_ar: 'الفلبين',           dialCode: '+63',  flag: '🇵🇭', placeholder: '9XX XXX XXXX' },
  { name: 'Indonesia',         name_ar: 'إندونيسيا',         dialCode: '+62',  flag: '🇮🇩', placeholder: '8XX XXXX XXXX' },
  { name: 'Turkey',            name_ar: 'تركيا',             dialCode: '+90',  flag: '🇹🇷', placeholder: '5XX XXX XXXX' },
  { name: 'Iran',              name_ar: 'إيران',             dialCode: '+98',  flag: '🇮🇷', placeholder: '9XX XXX XXXX' },
  { name: 'Ethiopia',          name_ar: 'إثيوبيا',           dialCode: '+251', flag: '🇪🇹', placeholder: '9X XXX XXXX' },
  { name: 'Kenya',             name_ar: 'كينيا',             dialCode: '+254', flag: '🇰🇪', placeholder: '7XX XXX XXX' },
  { name: 'Nigeria',           name_ar: 'نيجيريا',           dialCode: '+234', flag: '🇳🇬', placeholder: '8XX XXX XXXX' },
  { name: 'United Kingdom',    name_ar: 'المملكة المتحدة',   dialCode: '+44',  flag: '🇬🇧', placeholder: '7XXX XXX XXX' },
  { name: 'United States',     name_ar: 'الولايات المتحدة',  dialCode: '+1',   flag: '🇺🇸', placeholder: 'XXX XXX XXXX' },
  { name: 'Canada',            name_ar: 'كندا',              dialCode: '+1',   flag: '🇨🇦', placeholder: 'XXX XXX XXXX' },
  { name: 'Germany',           name_ar: 'ألمانيا',           dialCode: '+49',  flag: '🇩🇪', placeholder: '1XX XXXXXXX' },
  { name: 'France',            name_ar: 'فرنسا',             dialCode: '+33',  flag: '🇫🇷', placeholder: '6 XX XX XX XX' },
  { name: 'Australia',         name_ar: 'أستراليا',          dialCode: '+61',  flag: '🇦🇺', placeholder: '4XX XXX XXX' },
  { name: 'China',             name_ar: 'الصين',             dialCode: '+86',  flag: '🇨🇳', placeholder: '1XX XXXX XXXX' },
  { name: 'Japan',             name_ar: 'اليابان',           dialCode: '+81',  flag: '🇯🇵', placeholder: '9X XXXX XXXX' },
  { name: 'South Korea',       name_ar: 'كوريا الجنوبية',    dialCode: '+82',  flag: '🇰🇷', placeholder: '1X XXXX XXXX' },
  { name: 'Russia',            name_ar: 'روسيا',             dialCode: '+7',   flag: '🇷🇺', placeholder: '9XX XXX XXXX' },
  { name: 'Brazil',            name_ar: 'البرازيل',          dialCode: '+55',  flag: '🇧🇷', placeholder: '9X XXXX XXXX' },
  { name: 'South Africa',      name_ar: 'جنوب أفريقيا',      dialCode: '+27',  flag: '🇿🇦', placeholder: '7X XXX XXXX' },
];

interface PhoneInputProps {
  value: string;
  onChangeText: (localNumber: string) => void;
  selectedCountry: Country;
  onSelectCountry: (country: Country) => void;
  error?: string;
  label?: string;
}

export default function PhoneInput({
  value,
  onChangeText,
  selectedCountry,
  onSelectCountry,
  error,
  label,
}: PhoneInputProps) {
  const { colors } = useTheme();
  const { language, isRTL } = useLanguageStore();
  const { t } = useTranslation();
  const s = makeStyles(colors);
  const [focused, setFocused] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const borderColor = error ? colors.error : focused ? colors.borderFocus : colors.border;

  return (
    <View style={s.container}>
      <Text style={[s.label, isRTL && s.textRtl]}>{label ?? t('auth.phoneNumber')}</Text>
      <View style={[s.inputWrapper, { borderColor }, isRTL && s.inputWrapperRtl]}>
        <TouchableOpacity style={[s.dialBtn, isRTL && s.dialBtnRtl]} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
          <Text style={s.flag}>{selectedCountry.flag}</Text>
          <Text style={s.dialCode}>{selectedCountry.dialCode}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={s.divider} />
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={selectedCountry.placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
          textAlign="left"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
        />
      </View>
      {error && <Text style={[s.error, isRTL && s.textRtl]}>{error}</Text>}
      {!error && (
        <Text style={[s.hint, isRTL && s.textRtl]}>
          {t('auth.fullPhoneNumber', {
            dialCode: selectedCountry.dialCode,
            value: value || selectedCountry.placeholder,
          })}
        </Text>
      )}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <Pressable style={s.backdrop} onPress={() => setPickerVisible(false)} />
        <SafeAreaView style={s.sheet}>
          <View style={[s.sheetHeader, isRTL && s.sheetHeaderRtl]}>
            <Text style={[s.sheetTitle, isRTL && s.textRtl]}>{t('auth.selectCountry')}</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(item) => `${item.name}-${item.dialCode}`}
            renderItem={({ item }) => {
              const isSelected = item.dialCode === selectedCountry.dialCode;
              return (
                <TouchableOpacity
                  style={[s.countryRow, isSelected && s.countryRowSelected, isRTL && s.countryRowRtl]}
                  onPress={() => {
                    onSelectCountry(item);
                    setPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={s.countryFlag}>{item.flag}</Text>
                  <Text style={[s.countryName, isRTL && s.textRtl]}>{language === 'ar' ? item.name_ar : item.name}</Text>
                  <Text style={s.countryDial}>{item.dialCode}</Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { gap: 6 },
    label: { fontSize: FontSize.sm, fontWeight: '600', color: c.textPrimary, letterSpacing: 0.1 },
    textRtl: { textAlign: 'right' },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderWidth: 1.5, borderRadius: Radius.md, minHeight: 50,
    },
    inputWrapperRtl: { flexDirection: 'row-reverse' },
    dialBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    dialBtnRtl: { flexDirection: 'row-reverse' },
    flag: { fontSize: 22 },
    dialCode: { fontSize: FontSize.md, fontWeight: '700', color: c.textPrimary },
    divider: { width: 1, height: 24, backgroundColor: c.border },
    input: {
      flex: 1, fontSize: FontSize.md, color: c.textPrimary,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    error: { fontSize: FontSize.xs, color: c.error, fontWeight: '500' },
    hint: { fontSize: FontSize.xs, color: c.textTertiary },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      maxHeight: '50%',
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    sheetHeaderRtl: { flexDirection: 'row-reverse' },
    sheetTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    countryRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    countryRowRtl: { flexDirection: 'row-reverse' },
    countryRowSelected: { backgroundColor: c.primarySurface },
    countryFlag: { fontSize: 26 },
    countryName: { flex: 1, fontSize: FontSize.md, color: c.textPrimary, fontWeight: '500' },
    countryDial: { fontSize: FontSize.md, color: c.textSecondary, fontWeight: '600' },
  });
}
