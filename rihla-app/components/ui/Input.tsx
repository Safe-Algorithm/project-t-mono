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
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const s = makeStyles(colors);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.borderFocus
    : colors.border;

  return (
    <View style={[s.container, containerStyle]}>
      {label && <Text style={s.label}>{label}</Text>}
      <View style={[s.inputWrapper, { borderColor }]}>
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={focused ? colors.primary : colors.textTertiary}
            style={s.leftIcon}
          />
        )}
        <TextInput
          style={[s.input, leftIcon && s.inputWithLeft, style]}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={s.rightIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} style={s.rightIcon}>
            <Ionicons name={rightIcon} size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error && <Text style={s.error}>{error}</Text>}
      {hint && !error && <Text style={s.hint}>{hint}</Text>}
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
    input: { flex: 1, fontSize: FontSize.md, color: c.textPrimary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    inputWithLeft: { paddingLeft: 0 },
    leftIcon: { paddingLeft: Spacing.lg },
    rightIcon: { paddingRight: Spacing.lg },
    error: { fontSize: FontSize.xs, color: c.error, fontWeight: '500' },
    hint: { fontSize: FontSize.xs, color: c.textTertiary },
  });
}
