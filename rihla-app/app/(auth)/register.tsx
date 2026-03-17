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
import { useLanguageStore } from '../../store/languageStore';

type Step = 'contact' | 'otp' | 'details';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { language, setLanguage, isRTL } = useLanguageStore();
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
  const stepOrder: Step[] = ['contact', 'otp', 'details'];

  const sendOtp = async () => {
    if (contactType === 'email' && !contact.trim()) {
      setErrors({ contact: t('auth.emailRequired') });
      return;
    }
    if (contactType === 'phone' && !localNumber.trim()) {
      setErrors({ contact: t('auth.phoneRequired') });
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
      const msg = Array.isArray(detail)
        ? (detail[0]?.msg ?? t('auth.sendCodeFailed'))
        : (typeof detail === 'string' ? detail : t('auth.sendCodeFailed'));
      setErrors({ contact: msg });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim() || otp.length < 6) {
      setErrors({ otp: t('auth.enterOtp') });
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
        ? (detail[0]?.msg ?? t('auth.invalidOtp'))
        : (typeof detail === 'string' ? detail : t('auth.invalidOtp'));
      setErrors({ otp: msg });
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pw: string): { score: number; rules: { label: string; ok: boolean }[] } => {
    const rules = [
      { label: t('auth.pwRuleLength'), ok: pw.length >= 8 },
      { label: t('auth.pwRuleUpper'), ok: /[A-Z]/.test(pw) },
      { label: t('auth.pwRuleLower'), ok: /[a-z]/.test(pw) },
      { label: t('auth.pwRuleDigit'), ok: /\d/.test(pw) },
      { label: t('auth.pwRuleSpecial'), ok: /[^A-Za-z0-9]/.test(pw) },
    ];
    return { score: rules.filter((r) => r.ok).length, rules };
  };

  const pwStrength = getPasswordStrength(password);

  const handleRegister = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('auth.nameRequired');
    if (!password) e.password = t('auth.passwordRequired');
    else if (pwStrength.score < 5) e.password = t('auth.passwordWeak');
    if (password !== confirmPassword) e.confirmPassword = t('changePassword.mismatch');
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
        ? (detail[0]?.msg ?? t('auth.genericError'))
        : (typeof detail === 'string' ? detail : t('auth.genericError'));
      Alert.alert(t('auth.registrationFailedTitle'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
    <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        <TouchableOpacity style={[s.langToggle, isRTL && s.langToggleRtl]} onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
          <Text style={s.langToggleText}>{language === 'en' ? 'العربية' : 'English'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.backBtn, isRTL && s.backBtnRtl]}
          onPress={() => (step === 'contact' ? router.back() : setStep(step === 'otp' ? 'contact' : 'otp'))}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={[s.headerArea, isRTL && s.headerAreaRtl]}>
          <Text style={[s.title, isRTL && s.textRtl]}>
            {step === 'contact' ? t('auth.registerTitle') : step === 'otp' ? t('auth.verifyCodeTitle') : t('auth.completeProfileTitle')}
          </Text>
          <Text style={[s.subtitle, isRTL && s.textRtl]}>
            {step === 'contact'
              ? t('auth.registerSubtitle')
              : step === 'otp'
                ? t('auth.otpSentTo', { contact: contactType === 'phone' ? fullPhone : contact })
                : t('auth.completeProfileSubtitle')}
          </Text>
        </View>
        <View style={s.steps}>
          {stepOrder.map((sv, i) => {
            const isActive = step === sv || stepOrder.indexOf(step) > i;
            const lineActive = stepOrder.indexOf(step) > i;
            const isLast = i === stepOrder.length - 1;
            return (
              <View key={sv} style={[s.stepRow, isLast && s.stepRowLast, isRTL && s.stepRowRtl]}>
                {i < 2 && isRTL && <View style={[s.stepLine, lineActive && s.stepLineActive]} />}
                <View style={[s.stepDot, isActive && s.stepDotActive]}>
                  <Text style={[s.stepNum, isActive && s.stepNumActive]}>{i + 1}</Text>
                </View>
                {i < 2 && !isRTL && <View style={[s.stepLine, lineActive && s.stepLineActive]} />}
              </View>
            );
          })}
        </View>
        <View style={s.form}>
          {step === 'contact' && (
            <>
              <View style={[s.toggle, isRTL && s.rowRtl]}>
                <TouchableOpacity style={[s.toggleBtn, contactType === 'email' && s.toggleBtnActive]}
                  onPress={() => { setContactType('email'); setContact(''); setErrors({}); }}>
                  <Ionicons name="mail-outline" size={16} color={contactType === 'email' ? colors.primary : colors.textTertiary} />
                  <Text style={[s.toggleText, contactType === 'email' && s.toggleTextActive]}>{t('auth.email')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.toggleBtn, contactType === 'phone' && s.toggleBtnActive]}
                  onPress={() => { setContactType('phone'); setContact(''); setLocalNumber(''); setErrors({}); }}>
                  <Ionicons name="call-outline" size={16} color={contactType === 'phone' ? colors.primary : colors.textTertiary} />
                  <Text style={[s.toggleText, contactType === 'phone' && s.toggleTextActive]}>{t('auth.phone')}</Text>
                </TouchableOpacity>
              </View>
              {contactType === 'email' ? (
                <Input label={t('auth.email')} placeholder={t('auth.email')}
                  value={contact} onChangeText={setContact}
                  keyboardType="email-address" autoCapitalize="none"
                  leftIcon="mail-outline" error={errors.contact} />
              ) : (
                <PhoneInput
                  label={t('auth.phoneNumber')}
                  value={localNumber}
                  onChangeText={setLocalNumber}
                  selectedCountry={selectedCountry}
                  onSelectCountry={(c) => { setSelectedCountry(c); setLocalNumber(''); }}
                  error={errors.contact}
                />
              )}
              <Button title={t('auth.sendVerificationCode')} onPress={sendOtp} loading={loading} fullWidth size="lg" style={s.btn} />
            </>
          )}
          {step === 'otp' && (
            <>
              <Input label={t('auth.otpLabel')} placeholder="000000" value={otp} onChangeText={setOtp}
                keyboardType="number-pad" maxLength={6} leftIcon="key-outline" error={errors.otp}
                autoComplete="one-time-code" textContentType="oneTimeCode" />
              <Button title={t('auth.verifyCode')} onPress={verifyOtp} loading={loading} fullWidth size="lg" style={s.btn} />
              <TouchableOpacity onPress={sendOtp} style={s.resend}>
                <Text style={[s.resendText, isRTL && s.textRtl]}>{t('auth.didNotReceive')} <Text style={s.resendLink}>{t('auth.resend')}</Text></Text>
              </TouchableOpacity>
            </>
          )}
          {step === 'details' && (
            <>
              <Input label={t('auth.name')} placeholder={t('auth.name')} value={name} onChangeText={setName}
                autoCapitalize="words" leftIcon="person-outline" error={errors.name} />
              <Input label={t('auth.password')} placeholder={t('auth.passwordMin')} value={password} onChangeText={setPassword}
                isPassword leftIcon="lock-closed-outline" error={errors.password}
                autoComplete="new-password" textContentType="newPassword" />
              {password.length > 0 && (
                <View style={s.pwStrength}>
                  <View style={s.pwStrengthBar}>
                    {[0,1,2,3,4].map((i) => (
                      <View key={i} style={[
                        s.pwStrengthSegment,
                        { backgroundColor: i < pwStrength.score
                          ? pwStrength.score <= 2 ? '#EF4444'
                          : pwStrength.score <= 3 ? '#F59E0B'
                          : '#16A34A'
                          : colors.gray200 },
                      ]} />
                    ))}
                  </View>
                  {pwStrength.rules.map((r) => (
                    <View key={r.label} style={s.pwRule}>
                      <Ionicons name={r.ok ? 'checkmark-circle' : 'ellipse-outline'} size={13}
                        color={r.ok ? '#16A34A' : colors.textTertiary} />
                      <Text style={[s.pwRuleText, r.ok && s.pwRuleOk]}>{r.label}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Input label={t('changePassword.confirm')} placeholder={t('changePassword.confirm')} value={confirmPassword}
                onChangeText={setConfirmPassword} isPassword leftIcon="lock-closed-outline" error={errors.confirmPassword}
                autoComplete="new-password" textContentType="newPassword" />
              <Button title={t('auth.register')} onPress={handleRegister} loading={loading} fullWidth size="lg" style={s.btn} />
            </>
          )}
        </View>
        <View style={[s.loginRow, isRTL && s.rowRtl]}>
          <Text style={s.loginText}>{t('auth.hasAccount')} </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.loginLink}>{t('auth.signIn')}</Text>
          </TouchableOpacity>
        </View>
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
    scroll: { flexGrow: 1, paddingBottom: 40 },
    backBtn: { position: 'absolute', top: 48, left: 16, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    backBtnRtl: { left: undefined, right: 16 },
    langToggle: { position: 'absolute', top: 48, right: 20, backgroundColor: c.primarySurface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, zIndex: 1 },
    langToggleRtl: { right: undefined, left: 20 },
    langToggleText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '700' },
    headerArea: { paddingHorizontal: 24, marginTop: 104, gap: 6 },
    headerAreaRtl: { alignItems: 'flex-end' },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary },
    subtitle: { fontSize: FontSize.md, color: c.textSecondary, lineHeight: 22 },
    steps: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 8 },
    stepRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    stepRowLast: { flex: 0 },
    stepRowRtl: { flexDirection: 'row-reverse' },
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
    rowRtl: { flexDirection: 'row-reverse' },
    btn: { marginTop: 8 },
    textRtl: { textAlign: 'right' as const },
    resend: { alignSelf: 'center', paddingVertical: 8 },
    resendText: { fontSize: FontSize.sm, color: c.textSecondary },
    resendLink: { color: c.primary, fontWeight: '700' },
    loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
    loginText: { fontSize: FontSize.md, color: c.textSecondary },
    loginLink: { fontSize: FontSize.md, color: c.primary, fontWeight: '700' },
    pwStrength: { gap: 6, marginTop: -8 },
    pwStrengthBar: { flexDirection: 'row', gap: 4 },
    pwStrengthSegment: { flex: 1, height: 4, borderRadius: 2 },
    pwRule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pwRuleText: { fontSize: FontSize.xs, color: c.textTertiary },
    pwRuleOk: { color: '#16A34A' },
  });
}
