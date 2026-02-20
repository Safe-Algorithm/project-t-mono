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

export interface Country {
  name: string;
  dialCode: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES: Country[] = [
  { name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', placeholder: '5X XXX XXXX' },
  { name: 'United States', dialCode: '+1',   flag: '🇺🇸', placeholder: 'XXX XXX XXXX' },
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
  label = 'Phone Number',
}: PhoneInputProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [focused, setFocused] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const borderColor = error ? colors.error : focused ? colors.borderFocus : colors.border;

  return (
    <View style={s.container}>
      {label && <Text style={s.label}>{label}</Text>}
      <View style={[s.inputWrapper, { borderColor }]}>
        {/* Country picker button */}
        <TouchableOpacity style={s.dialBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
          <Text style={s.flag}>{selectedCountry.flag}</Text>
          <Text style={s.dialCode}>{selectedCountry.dialCode}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divider} />

        {/* Local number input */}
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={selectedCountry.placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
        />
      </View>
      {error && <Text style={s.error}>{error}</Text>}
      {!error && (
        <Text style={s.hint}>
          Full number: {selectedCountry.dialCode} {value || selectedCountry.placeholder}
        </Text>
      )}

      {/* Country picker modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <Pressable style={s.backdrop} onPress={() => setPickerVisible(false)} />
        <SafeAreaView style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(item) => item.dialCode}
            renderItem={({ item }) => {
              const isSelected = item.dialCode === selectedCountry.dialCode;
              return (
                <TouchableOpacity
                  style={[s.countryRow, isSelected && s.countryRowSelected]}
                  onPress={() => {
                    onSelectCountry(item);
                    setPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={s.countryFlag}>{item.flag}</Text>
                  <Text style={s.countryName}>{item.name}</Text>
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
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderWidth: 1.5, borderRadius: Radius.md, minHeight: 50,
    },
    dialBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
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
    sheetTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    countryRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    countryRowSelected: { backgroundColor: c.primarySurface },
    countryFlag: { fontSize: 26 },
    countryName: { flex: 1, fontSize: FontSize.md, color: c.textPrimary, fontWeight: '500' },
    countryDial: { fontSize: FontSize.md, color: c.textSecondary, fontWeight: '600' },
  });
}
