import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize, Radius, Shadow } from '../../constants/Theme';
import Button from '../../components/ui/Button';

export default function BookingSuccessScreen() {
  const { t } = useTranslation();
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
    <View style={styles.container}>
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <Ionicons name="checkmark-circle" size={100} color={Colors.success} />
      </Animated.View>

      <Animated.View style={[styles.content, contentStyle]}>
        <Text style={styles.title}>{t('booking.successTitle')}</Text>
        <Text style={styles.subtitle}>{t('booking.successMessage')}</Text>

        <View style={styles.refCard}>
          <Text style={styles.refLabel}>{t('booking.package')}</Text>
          <Text style={styles.refValue}>{registrationId?.slice(0, 8).toUpperCase()}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={t('booking.viewBookings')}
            onPress={() => router.replace('/(tabs)/bookings')}
            fullWidth
            size="lg"
          />
          <Button
            title={t('explore.subtitle')}
            onPress={() => router.replace('/(tabs)')}
            variant="outline"
            fullWidth
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconWrap: { marginBottom: 32 },
  content: { alignItems: 'center', gap: 16, width: '100%' },
  title: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  refCard: {
    backgroundColor: Colors.gray50,
    borderRadius: Radius.xl,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  refLabel: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  refValue: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, marginTop: 4, letterSpacing: 2 },
  actions: { width: '100%', gap: 12, marginTop: 8 },
});
