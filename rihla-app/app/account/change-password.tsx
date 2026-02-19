import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Colors, FontSize, Radius, Spacing } from '../../constants/Theme';
import { useAuthStore } from '../../store/authStore';

type Step = 'otp' | 'reset' | 'success';

function extractError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  return Array.isArray(detail)
    ? (detail[0]?.msg ?? fallback)
    : (typeof detail === 'string' ? detail : fallback);
}

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const email = user?.email ?? '';

  const [step, setStep] = useState<Step>('otp');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('changePassword.noEmail'));
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/otp/send-password-reset-otp', { email });
      setOtpSent(true);
      setErrors({});
    } catch (err: any) {
      setErrors({ otp: extractError(err, t('changePassword.failed')) });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const errs: Record<string, string> = {};
    if (!otp.trim() || otp.trim().length !== 6) errs.otp = t('auth.otpLabel');
    if (!newPassword || newPassword.length < 8) errs.newPassword = t('changePassword.new');
    if (newPassword !== confirmPassword) errs.confirmPassword = t('changePassword.mismatch');
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await apiClient.post('/otp/reset-password', {
        email,
        otp: otp.trim(),
        new_password: newPassword,
      });
      setErrors({});
      setStep('success');
    } catch (err: any) {
      setErrors({ otp: extractError(err, t('changePassword.failed')) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('changePassword.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {step === 'success' ? (
          <View style={styles.successBox}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>{t('changePassword.success')}</Text>
            <Text style={styles.successText}>{t('changePassword.success')}</Text>
            <Button title={t('common.done')} onPress={() => router.back()} style={{ marginTop: 24 }} />
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {email
                ? t('changePassword.sendCodeTo', { email })
                : t('changePassword.sendCodeNoEmail')}
            </Text>

            {!otpSent ? (
              <Button
                title={t('auth.verify')}
                onPress={sendOtp}
                loading={loading}
                style={{ marginTop: 24 }}
              />
            ) : (
              <View style={styles.form}>
                <Text style={styles.sentNote}>{t('auth.otpSent')}</Text>

                <Input
                  label={t('auth.otpLabel')}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder={t('auth.otpLabel')}
                  keyboardType="number-pad"
                  maxLength={6}
                  error={errors.otp}
                />

                <Input
                  label={t('changePassword.new')}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('changePassword.new')}
                  secureTextEntry
                  error={errors.newPassword}
                />

                <Input
                  label={t('changePassword.confirm')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('changePassword.confirm')}
                  secureTextEntry
                  error={errors.confirmPassword}
                />

                <Button
                  title={t('changePassword.submit')}
                  onPress={handleReset}
                  loading={loading}
                  style={{ marginTop: 8 }}
                />

                <TouchableOpacity style={styles.resendRow} onPress={sendOtp} disabled={loading}>
                  <Text style={styles.resendText}>{t('auth.otpSent')} </Text>
                  <Text style={styles.resendLink}>{t('auth.resend')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  content: { flex: 1, padding: 24 },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  sentNote: {
    fontSize: FontSize.sm, color: Colors.success, fontWeight: '600',
    marginBottom: 16,
  },
  form: { gap: 12, marginTop: 8 },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  resendText: { fontSize: FontSize.sm, color: Colors.textTertiary },
  resendLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  successIcon: { marginBottom: 8 },
  successTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  successText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
