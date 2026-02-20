import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import Button from '../../components/ui/Button';

export default function BookingSuccessScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    opacity.value = withDelay(300, withSpring(1));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: (1 - opacity.value) * 20 }],
  }));

  return (
    <View style={s.container}>
      <Animated.View style={[s.iconWrap, iconStyle]}>
        <Ionicons name="checkmark-circle" size={100} color={colors.success} />
      </Animated.View>
      <Animated.View style={[s.content, contentStyle]}>
        <Text style={s.title}>{t('booking.successTitle')}</Text>
        <Text style={s.subtitle}>{t('booking.successMessage')}</Text>
        <View style={s.refCard}>
          <Text style={s.refLabel}>{t('booking.package')}</Text>
          <Text style={s.refValue}>{registrationId?.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={s.actions}>
          <Button title={t('booking.viewBookings')} onPress={() => router.replace('/(tabs)/bookings')} fullWidth size="lg" />
          <Button title={t('explore.subtitle')} onPress={() => router.replace('/(tabs)')} variant="outline" fullWidth />
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', padding: 32 },
    iconWrap: { marginBottom: 32 },
    content: { alignItems: 'center', gap: 16, width: '100%' },
    title: { fontSize: FontSize.xxxl, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: FontSize.md, color: c.textSecondary, textAlign: 'center', lineHeight: 24 },
    refCard: { backgroundColor: c.gray50, borderRadius: Radius.xl, padding: 20, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: c.border, ...Shadow.sm },
    refLabel: { fontSize: FontSize.sm, color: c.textTertiary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
    refValue: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary, marginTop: 4, letterSpacing: 2 },
    actions: { width: '100%', gap: 12, marginTop: 8 },
  });
}
