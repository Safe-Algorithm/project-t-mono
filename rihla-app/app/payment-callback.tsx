import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

export default function PaymentCallbackScreen() {
  const { colors } = useTheme();
  const { registrationId, status } = useLocalSearchParams<{ registrationId: string; status: string }>();

  useEffect(() => {
    if (!registrationId) {
      router.replace('/(tabs)/bookings');
      return;
    }
    if (status === 'paid') {
      router.replace({ pathname: '/booking/success', params: { registrationId } });
    } else {
      router.replace({ pathname: '/booking/[registrationId]', params: { registrationId } });
    }
  }, [registrationId, status]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
