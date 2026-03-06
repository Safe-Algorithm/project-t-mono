import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Radius, FontSize, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.96, { damping: 15 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 15 }); };

  const isDisabled = disabled || loading;

  return (
    <AnimatedTouchable
      style={[
        s.base,
        s[variant],
        s[`size_${size}`],
        fullWidth && s.fullWidth,
        isDisabled && s.disabled,
        animatedStyle,
        style,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={1}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white}
          size="small"
        />
      ) : (
        <>
          {leftIcon}
          <Text style={[s.text, s[`text_${variant}`], s[`textSize_${size}`], textStyle]}>
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </AnimatedTouchable>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.lg, ...Shadow.sm },
    fullWidth: { width: '100%' },
    disabled: { opacity: 0.5 },
    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: c.gray100 },
    outline: { backgroundColor: c.transparent, borderWidth: 1.5, borderColor: c.primary, elevation: 0, shadowOpacity: 0 },
    ghost: { backgroundColor: c.transparent, elevation: 0, shadowOpacity: 0 },
    danger: { backgroundColor: c.error },
    size_sm: { paddingHorizontal: 14, paddingVertical: 8 },
    size_md: { paddingHorizontal: 20, paddingVertical: 13 },
    size_lg: { paddingHorizontal: 28, paddingVertical: 16 },
    text: { fontWeight: '600', letterSpacing: 0.2 },
    text_primary: { color: c.white },
    text_secondary: { color: c.textPrimary },
    text_outline: { color: c.primary },
    text_ghost: { color: c.primary },
    text_danger: { color: c.white },
    textSize_sm: { fontSize: FontSize.sm },
    textSize_md: { fontSize: FontSize.md },
    textSize_lg: { fontSize: FontSize.lg },
  });
}
