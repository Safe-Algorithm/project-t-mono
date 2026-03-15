import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, FontSize, Spacing, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguageStore } from '../../store/languageStore';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export default function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  isPassword = false,
  style,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const { isRTL } = useLanguageStore();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const s = makeStyles(colors);
  const isAlwaysLtr = rest.keyboardType === 'email-address' || rest.keyboardType === 'phone-pad' ||
    rest.keyboardType === 'number-pad' || rest.keyboardType === 'numeric';
  const inputValue = typeof rest.value === 'string' ? rest.value : '';
  const shouldUseLtrContent = isAlwaysLtr && inputValue.length > 0;
  const textAlign = isRTL ? (shouldUseLtrContent ? 'left' : 'right') : 'left';
  const writingDirection = isRTL ? (shouldUseLtrContent ? 'ltr' : 'rtl') : 'ltr';

  const borderColor = error
    ? colors.error
    : focused
    ? colors.borderFocus
    : colors.border;

  const trailingIcon = isPassword ? (
    <TouchableOpacity
      onPress={() => setShowPassword(!showPassword)}
      style={s.iconBtn}
    >
      <Ionicons
        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
        size={18}
        color={colors.textTertiary}
      />
    </TouchableOpacity>
  ) : rightIcon ? (
    <TouchableOpacity onPress={onRightIconPress} style={s.iconBtn}>
      <Ionicons name={rightIcon} size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  ) : null;

  const leadingIcon = leftIcon ? (
    <Ionicons
      name={leftIcon}
      size={18}
      color={focused ? colors.primary : colors.textTertiary}
      style={s.iconEdge}
    />
  ) : null;

  return (
    <View style={[s.container, containerStyle]}>
      {label && <Text style={[s.label, isRTL && s.labelRtl]}>{label}</Text>}
      <View style={[s.inputWrapper, { borderColor }]}>
        {isRTL ? trailingIcon : leadingIcon}
        <TextInput
          style={[
            s.input,
            (leftIcon || isPassword || rightIcon) && s.inputWithIcon,
            { textAlign, writingDirection },
            style,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...rest}
        />
        {isRTL ? leadingIcon : trailingIcon}
      </View>
      {error && <Text style={[s.error, isRTL && s.textRtl]}>{error}</Text>}
      {hint && !error && <Text style={[s.hint, isRTL && s.textRtl]}>{hint}</Text>}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { gap: 6 },
    label: { fontSize: FontSize.sm, fontWeight: '600', color: c.textPrimary, letterSpacing: 0.1 },
    labelRtl: { textAlign: 'right' },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderWidth: 1.5, borderRadius: Radius.md, height: 52,
    },
    iconEdge: { paddingHorizontal: Spacing.lg },
    iconBtn: {
      paddingHorizontal: Spacing.lg,
      height: '100%' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    input: {
      flex: 1,
      height: '100%' as const,
      fontSize: FontSize.md,
      color: c.textPrimary,
      paddingVertical: 0,
      textAlignVertical: 'center' as const,
    },
    inputWithIcon: { paddingHorizontal: Spacing.sm },
    error: { fontSize: FontSize.xs, color: c.error, fontWeight: '500' },
    hint: { fontSize: FontSize.xs, color: c.textTertiary },
    textRtl: { textAlign: 'right' },
  });
}
