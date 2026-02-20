import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhoneInput, { COUNTRIES, Country } from '../../components/ui/PhoneInput';
import { FontSize, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import apiClient from '../../lib/api';

type Step = 'contact' | 'otp' | 'details';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [step, setStep] = useState<Step>('contact');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [contact, setContact] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [localNumber, setLocalNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fullPhone = `${selectedCountry.dialCode}${localNumber.trim()}`;

  const sendOtp = async () => {
    if (contactType === 'email' && !contact.trim()) {
      setErrors({ contact: 'Email is required' });
      return;
    }
    if (contactType === 'phone' && !localNumber.trim()) {
      setErrors({ contact: 'Phone number is required' });
      return;
    }
    setLoading(true);
    try {
      if (contactType === 'email') {
        await apiClient.post('/otp/send-email-otp-registration', { email: contact.trim() });
      } else {
        await apiClient.post('/otp/send-otp-registration', { phone: fullPhone });
      }
      setErrors({});
      setStep('otp');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? (detail[0]?.msg ?? 'Failed to send OTP') : (typeof detail === 'string' ? detail : 'Failed to send OTP');
      setErrors({ contact: msg });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim() || otp.length < 6) {
      setErrors({ otp: 'Enter the 6-digit code' });
      return;
    }
    setLoading(true);
    try {
      let res;
      if (contactType === 'email') {
        res = await apiClient.post('/otp/verify-email-otp-registration', {
          email: contact.trim(),
          otp: otp.trim(),
        });
      } else {
        res = await apiClient.post('/otp/verify-otp-registration', {
          phone: fullPhone,
          otp: otp.trim(),
        });
      }
      setVerificationToken(res.data.verification_token);
      setErrors({});
      setStep('details');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? (detail[0]?.msg ?? 'Invalid OTP code')
        : (typeof detail === 'string' ? detail : 'Invalid OTP code');
      setErrors({ otp: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'At least 8 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setLoading(true);
    try {
      const registerPayload: any = { name: name.trim(), password };
      if (contactType === 'email') {
        registerPayload.email = contact.trim();
        registerPayload.email_verification_token = verificationToken;
      } else {
        registerPayload.phone = fullPhone;
        registerPayload.phone_verification_token = verificationToken;
      }
      const { useAuthStore } = await import('../../store/authStore');
      await useAuthStore.getState().register(registerPayload);
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? (detail[0]?.msg ?? 'Something went wrong')
        : (typeof detail === 'string' ? detail : 'Something went wrong');
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backBtn}
          onPress={() => (step === 'contact' ? router.back() : setStep(step === 'otp' ? 'contact' : 'otp'))}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerArea}>
          <Text style={s.title}>
            {step === 'contact' ? 'Create Account' : step === 'otp' ? 'Verify Code' : 'Almost Done'}
          </Text>
          <Text style={s.subtitle}>
            {step === 'contact' ? 'Join Rihla to start booking amazing trips'
              : step === 'otp' ? `We sent a 6-digit code to ${contact}`
              : 'Set up your profile to finish'}
          </Text>
        </View>
        <View style={s.steps}>
          {['contact', 'otp', 'details'].map((sv, i) => (
            <View key={sv} style={s.stepRow}>
              <View style={[s.stepDot, (step === sv || ['contact','otp','details'].indexOf(step) > i) && s.stepDotActive]}>
                <Text style={[s.stepNum, (step === sv || ['contact','otp','details'].indexOf(step) > i) && s.stepNumActive]}>{i + 1}</Text>
              </View>
              {i < 2 && <View style={[s.stepLine, ['contact','otp','details'].indexOf(step) > i && s.stepLineActive]} />}
            </View>
          ))}
        </View>
        <View style={s.form}>
          {step === 'contact' && (
            <>
              <View style={s.toggle}>
                <TouchableOpacity style={[s.toggleBtn, contactType === 'email' && s.toggleBtnActive]}
                  onPress={() => { setContactType('email'); setContact(''); setErrors({}); }}>
                  <Ionicons name="mail-outline" size={16} color={contactType === 'email' ? colors.primary : colors.textTertiary} />
                  <Text style={[s.toggleText, contactType === 'email' && s.toggleTextActive]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.toggleBtn, contactType === 'phone' && s.toggleBtnActive]}
                  onPress={() => { setContactType('phone'); setContact(''); setLocalNumber(''); setErrors({}); }}>
                  <Ionicons name="call-outline" size={16} color={contactType === 'phone' ? colors.primary : colors.textTertiary} />
                  <Text style={[s.toggleText, contactType === 'phone' && s.toggleTextActive]}>Phone</Text>
                </TouchableOpacity>
              </View>
              {contactType === 'email' ? (
                <Input label="Email Address" placeholder="you@example.com"
                  value={contact} onChangeText={setContact}
                  keyboardType="email-address" autoCapitalize="none"
                  leftIcon="mail-outline" error={errors.contact} />
              ) : (
                <PhoneInput
                  label="Phone Number"
                  value={localNumber}
                  onChangeText={setLocalNumber}
                  selectedCountry={selectedCountry}
                  onSelectCountry={(c) => { setSelectedCountry(c); setLocalNumber(''); }}
                  error={errors.contact}
                />
              )}
              <Button title="Send Verification Code" onPress={sendOtp} loading={loading} fullWidth size="lg" style={s.btn} />
            </>
          )}
          {step === 'otp' && (
            <>
              <Input label="Verification Code" placeholder="000000" value={otp} onChangeText={setOtp}
                keyboardType="number-pad" maxLength={6} leftIcon="key-outline" error={errors.otp} />
              <Button title="Verify Code" onPress={verifyOtp} loading={loading} fullWidth size="lg" style={s.btn} />
              <TouchableOpacity onPress={sendOtp} style={s.resend}>
                <Text style={s.resendText}>Didn't receive it? <Text style={s.resendLink}>Resend</Text></Text>
              </TouchableOpacity>
            </>
          )}
          {step === 'details' && (
            <>
              <Input label="Full Name" placeholder="Your full name" value={name} onChangeText={setName}
                autoCapitalize="words" leftIcon="person-outline" error={errors.name} />
              <Input label="Password" placeholder="Min. 8 characters" value={password} onChangeText={setPassword}
                isPassword leftIcon="lock-closed-outline" error={errors.password} />
              <Input label="Confirm Password" placeholder="Repeat your password" value={confirmPassword}
                onChangeText={setConfirmPassword} isPassword leftIcon="lock-closed-outline" error={errors.confirmPassword} />
              <Button title="Create Account" onPress={handleRegister} loading={loading} fullWidth size="lg" style={s.btn} />
            </>
          )}
        </View>
        <View style={s.loginRow}>
          <Text style={s.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.loginLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { flexGrow: 1, paddingBottom: 40 },
    backBtn: { marginTop: 56, marginLeft: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerArea: { paddingHorizontal: 24, marginTop: 16, gap: 6 },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary },
    subtitle: { fontSize: FontSize.md, color: c.textSecondary, lineHeight: 22 },
    steps: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 8 },
    stepRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.gray100, alignItems: 'center', justifyContent: 'center' },
    stepDotActive: { backgroundColor: c.primary },
    stepNum: { fontSize: FontSize.xs, fontWeight: '700', color: c.textTertiary },
    stepNumActive: { color: c.white },
    stepLine: { flex: 1, height: 2, backgroundColor: c.gray200, marginHorizontal: 4 },
    stepLineActive: { backgroundColor: c.primary },
    form: { paddingHorizontal: 24, paddingTop: 24, gap: 16 },
    toggle: { flexDirection: 'row', backgroundColor: c.gray100, borderRadius: 12, padding: 4, gap: 4 },
    toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
    toggleBtnActive: { backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    toggleText: { fontSize: FontSize.sm, fontWeight: '600', color: c.textTertiary },
    toggleTextActive: { color: c.primary },
    btn: { marginTop: 8 },
    resend: { alignSelf: 'center', paddingVertical: 8 },
    resendText: { fontSize: FontSize.sm, color: c.textSecondary },
    resendLink: { color: c.primary, fontWeight: '700' },
    loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
    loginText: { fontSize: FontSize.md, color: c.textSecondary },
    loginLink: { fontSize: FontSize.md, color: c.primary, fontWeight: '700' },
  });
}
