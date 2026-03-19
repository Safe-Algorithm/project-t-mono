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
import { useLanguageStore } from '../../store/languageStore';

type Step = 'email' | 'otp' | 'success';

function extractError(err: any, t: (key: string) => string, fallback: string): string {
  if (!err?.response) return t('auth.networkError');
  if (err.response?.status >= 500) return t('auth.serverError');
  const detail = err?.response?.data?.detail;
  return Array.isArray(detail)
    ? (detail[0]?.msg ?? fallback)
    : (typeof detail === 'string' ? detail : fallback);
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { language, setLanguage, isRTL } = useLanguageStore();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSendOtp = async () => {
    if (!email.trim()) { setErrors({ email: t('auth.emailRequired') }); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setErrors({ email: t('auth.emailInvalid') }); return; }
    setLoading(true);
    try {
      await apiClient.post('/otp/send-password-reset-otp', { email: email.trim() });
      setErrors({});
      setStep('otp');
    } catch (err: any) {
      setErrors({ email: extractError(err, t, t('changePassword.failed')) });
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
      setErrors({ otp: extractError(err, t, t('changePassword.failed')) });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const e: Record<string, string> = {};
    if (!otp.trim() || otp.length < 6) e.otp = t('auth.enterOtp');
    if (!newPassword) e.newPassword = t('auth.passwordRequired');
    else if (newPassword.length < 8) e.newPassword = t('auth.passwordMin');
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
      setErrors({ otp: extractError(err, t, t('changePassword.failed')) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
    <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <TouchableOpacity style={[s.langToggle, isRTL && s.langToggleRtl]} onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
          <Text style={s.langToggleText}>{language === 'en' ? 'العربية' : 'English'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.backBtn, isRTL && s.backBtnRtl]} onPress={() => router.back()}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.iconWrap}>
          <Ionicons name="lock-open-outline" size={56} color={colors.primary} />
        </View>
        <Text style={s.title}>{t('auth.forgotPasswordTitle')}</Text>
        {step === 'email' && (
          <>
            <Text style={s.subtitle}>{t('auth.forgotPasswordSubtitle')}</Text>
            <View style={s.form}>
              <Input label={t('auth.email')} placeholder={t('auth.email')} value={email}
                onChangeText={(v) => { setEmail(v); setErrors({}); }}
                keyboardType="email-address" autoCapitalize="none" leftIcon="mail-outline" error={errors.email} />
              <Button title={t('auth.sendCode')} onPress={handleSendOtp} loading={loading} fullWidth size="lg" />
            </View>
          </>
        )}
        {step === 'otp' && (
          <>
            <Text style={s.subtitle}>{t('auth.forgotPasswordOtpSubtitle', { email })}</Text>
            <View style={s.form}>
              <Input label={t('auth.otpLabel')} placeholder="000000" value={otp}
                onChangeText={(v) => { setOtp(v.replace(/\D/g, '')); setErrors({}); }}
                keyboardType="number-pad" maxLength={6} leftIcon="key-outline" error={errors.otp} />
              <Input label={t('changePassword.new')} placeholder={t('auth.passwordMin')} value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setErrors({}); }}
                isPassword leftIcon="lock-closed-outline" error={errors.newPassword} />
              <Input label={t('changePassword.confirm')} placeholder={t('changePassword.confirm')} value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrors({}); }}
                isPassword leftIcon="lock-closed-outline" error={errors.confirmPassword} />
              <Button title={t('auth.resetPassword')} onPress={handleResetPassword} loading={loading} fullWidth size="lg" />
              <TouchableOpacity onPress={handleResendOtp} disabled={loading} style={s.resendBtn}>
                <Text style={s.resendText}>{t('auth.resend')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); setErrors({}); }} style={s.resendBtn}>
                <Text style={s.resendText}>{t('auth.changeEmail')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {step === 'success' && (
          <View style={s.successBox}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            <Text style={s.successTitle}>{t('auth.passwordResetTitle')}</Text>
            <Text style={s.successText}>{t('auth.passwordResetSubtitle')}</Text>
            <Button title={t('auth.backToLogin')} onPress={() => router.replace('/(auth)/login')} fullWidth style={{ marginTop: 8 }} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex1: { flex: 1 },
    scrollView: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
    backBtn: { position: 'absolute', top: 48, left: 16, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    backBtnRtl: { left: undefined, right: 16 },
    langToggle: { position: 'absolute', top: 48, right: 24, backgroundColor: c.primarySurface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, zIndex: 1 },
    langToggleRtl: { right: undefined, left: 24 },
    langToggleText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '700' },
    iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 104, marginBottom: 24 },
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
