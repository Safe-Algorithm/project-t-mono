import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { FontSize, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import apiClient from '../../lib/api';

type Step = 'email' | 'otp' | 'success';

function extractError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  return Array.isArray(detail)
    ? (detail[0]?.msg ?? fallback)
    : (typeof detail === 'string' ? detail : fallback);
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSendOtp = async () => {
    if (!email.trim()) { setErrors({ email: t('auth.email') }); return; }
    setLoading(true);
    try {
      await apiClient.post('/otp/send-password-reset-otp', { email: email.trim() });
      setErrors({});
      setStep('otp');
    } catch (err: any) {
      setErrors({ email: extractError(err, t('changePassword.failed')) });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      await apiClient.post('/otp/send-password-reset-otp', { email: email.trim() });
      setErrors({ otp: '' });
    } catch (err: any) {
      setErrors({ otp: extractError(err, t('changePassword.failed')) });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const e: Record<string, string> = {};
    if (!otp.trim() || otp.length < 6) e.otp = t('auth.otpLabel');
    if (!newPassword) e.newPassword = t('changePassword.new');
    else if (newPassword.length < 8) e.newPassword = t('changePassword.new');
    if (newPassword !== confirmPassword) e.confirmPassword = t('changePassword.mismatch');
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setLoading(true);
    try {
      await apiClient.post('/otp/reset-password', {
        email: email.trim(),
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
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.iconWrap}>
          <Ionicons name="lock-open-outline" size={56} color={colors.primary} />
        </View>
        <Text style={s.title}>Reset Password</Text>
        {step === 'email' && (
          <>
            <Text style={s.subtitle}>Enter your email and we'll send you a verification code.</Text>
            <View style={s.form}>
              <Input label="Email Address" placeholder="you@example.com" value={email}
                onChangeText={(v) => { setEmail(v); setErrors({}); }}
                keyboardType="email-address" autoCapitalize="none" leftIcon="mail-outline" error={errors.email} />
              <Button title="Send Code" onPress={handleSendOtp} loading={loading} fullWidth size="lg" />
            </View>
          </>
        )}
        {step === 'otp' && (
          <>
            <Text style={s.subtitle}>Enter the 6-digit code sent to {email}, then choose a new password.</Text>
            <View style={s.form}>
              <Input label="Verification Code" placeholder="000000" value={otp}
                onChangeText={(v) => { setOtp(v.replace(/\D/g, '')); setErrors({}); }}
                keyboardType="number-pad" maxLength={6} leftIcon="key-outline" error={errors.otp} />
              <Input label="New Password" placeholder="At least 8 characters" value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setErrors({}); }}
                isPassword leftIcon="lock-closed-outline" error={errors.newPassword} />
              <Input label="Confirm Password" placeholder="Repeat new password" value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrors({}); }}
                isPassword leftIcon="lock-closed-outline" error={errors.confirmPassword} />
              <Button title="Reset Password" onPress={handleResetPassword} loading={loading} fullWidth size="lg" />
              <TouchableOpacity onPress={handleResendOtp} disabled={loading} style={s.resendBtn}>
                <Text style={s.resendText}>Resend code</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); setErrors({}); }} style={s.resendBtn}>
                <Text style={s.resendText}>Change email</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {step === 'success' && (
          <View style={s.successBox}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            <Text style={s.successTitle}>Password Reset!</Text>
            <Text style={s.successText}>Your password has been updated. You can now sign in.</Text>
            <Button title="Back to Login" onPress={() => router.replace('/(auth)/login')} fullWidth style={{ marginTop: 8 }} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
    backBtn: { marginTop: 56, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 32, marginBottom: 24 },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary, textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: FontSize.md, color: c.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    form: { gap: 16 },
    resendBtn: { alignSelf: 'center', paddingVertical: 4 },
    resendText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600' },
    successBox: { alignItems: 'center', gap: 12, marginTop: 16 },
    successTitle: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    successText: { fontSize: FontSize.md, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
  });
}
