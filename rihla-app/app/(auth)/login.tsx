import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhoneInput, { COUNTRIES, Country } from '../../components/ui/PhoneInput';
import { FontSize, Radius, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { language, setLanguage, isRTL } = useLanguageStore();
  const [loginType, setLoginType] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [localNumber, setLocalNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ contact?: string; password?: string }>({});
  const [loginError, setLoginError] = useState<string | null>(null);
  const { login } = useAuthStore();

  const fullPhone = `${selectedCountry.dialCode}${localNumber.trim()}`;

  const validate = () => {
    const e: typeof errors = {};
    if (loginType === 'email') {
      if (!email.trim()) e.contact = t('auth.email');
      else if (!/\S+@\S+\.\S+/.test(email)) e.contact = t('auth.email');
    } else {
      if (!localNumber.trim()) e.contact = t('auth.phoneRequired');
    }
    if (!password) e.password = t('auth.password');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoginError(null);
    setLoading(true);
    try {
      const username = loginType === 'email' ? email.trim().toLowerCase() : fullPhone;
      await login(username, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? (detail[0]?.msg ?? t('auth.loginFailed')) : (typeof detail === 'string' ? detail : t('auth.loginFailed'));
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
    <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        <View style={s.header}>
          <TouchableOpacity style={s.langToggle} onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
            <Text style={s.langToggleText}>{language === 'en' ? 'العربية' : 'English'}</Text>
          </TouchableOpacity>
          <View style={s.logoContainer}>
            <Ionicons name="compass" size={40} color={colors.white} />
          </View>
          <Text style={s.appName}>{i18n.language === 'ar' ? 'رِحلة' : 'Rihla'}</Text>
          <Text style={s.tagline}>{t('auth.loginSubtitle')}</Text>
        </View>
        <View style={s.form}>
          <View style={[s.headerArea, isRTL && s.headerAreaRtl]}>
            <Text style={[s.title, isRTL && s.textRtl]}>{t('auth.loginTitle')}</Text>
            <Text style={[s.subtitle, isRTL && s.textRtl]}>{t('auth.loginSubtitle')}</Text>
          </View>
          {loginError ? (
            <View style={s.errorBanner}>
              <Text style={s.errorBannerText}>{loginError}</Text>
            </View>
          ) : null}
          <View style={s.fields}>
            <View style={[s.toggle, isRTL && s.rowRtl]}>
              <TouchableOpacity style={[s.toggleBtn, loginType === 'email' && s.toggleBtnActive]}
                onPress={() => { setLoginType('email'); setErrors({}); }}>
                <Ionicons name="mail-outline" size={16} color={loginType === 'email' ? colors.primary : colors.textTertiary} />
                <Text style={[s.toggleText, loginType === 'email' && s.toggleTextActive]}>{t('auth.email')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.toggleBtn, loginType === 'phone' && s.toggleBtnActive]}
                onPress={() => { setLoginType('phone'); setErrors({}); }}>
                <Ionicons name="call-outline" size={16} color={loginType === 'phone' ? colors.primary : colors.textTertiary} />
                <Text style={[s.toggleText, loginType === 'phone' && s.toggleTextActive]}>{t('auth.phone')}</Text>
              </TouchableOpacity>
            </View>
            {loginType === 'email' ? (
              <Input label={t('auth.email')} placeholder={t('auth.email')} value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email"
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
            <Input label={t('auth.password')} placeholder={t('auth.password')} value={password}
              onChangeText={setPassword} isPassword leftIcon="lock-closed-outline" error={errors.password}
              autoComplete="current-password" textContentType="password" />
          </View>
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={[s.forgotRow, isRTL && s.forgotRowRtl]}>
            <Text style={s.forgotText}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>
          <Button title={t('auth.login')} onPress={handleLogin} loading={loading} fullWidth size="lg" style={s.loginBtn} />
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t('auth.or')}</Text>
            <View style={s.dividerLine} />
          </View>
          <View style={[s.registerRow, isRTL && s.rowRtl]}>
            <Text style={s.registerText}>{t('auth.noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={s.registerLink}>{t('auth.signUp')}</Text>
            </TouchableOpacity>
          </View>
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
    scroll: { flexGrow: 1 },
    header: { backgroundColor: c.primary, paddingTop: 80, paddingBottom: 48, alignItems: 'center', gap: 8, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    logoContainer: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    appName: { fontSize: FontSize.display, fontWeight: '800', color: c.white, letterSpacing: -0.5 },
    tagline: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)' },
    langToggle: { position: 'absolute', top: 48, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    langToggleText: { fontSize: FontSize.sm, color: c.white, fontWeight: '700' },
    form: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40, gap: 0 },
    headerArea: { gap: 4, marginBottom: 28 },
    headerAreaRtl: { alignItems: 'flex-end' },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary },
    subtitle: { fontSize: FontSize.md, color: c.textSecondary },
    textRtl: { textAlign: 'right', writingDirection: 'rtl' },
    fields: { gap: 16, marginBottom: 12 },
    errorBanner: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
    errorBannerText: { fontSize: FontSize.sm, color: '#DC2626', lineHeight: 20 },
    forgotRow: { alignSelf: 'flex-end', marginBottom: 24 },
    forgotRowRtl: { alignSelf: 'flex-start' },
    forgotText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600' },
    loginBtn: { marginBottom: 24 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: { fontSize: FontSize.sm, color: c.textTertiary },
    registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    rowRtl: { flexDirection: 'row-reverse' },
    registerText: { fontSize: FontSize.md, color: c.textSecondary },
    registerLink: { fontSize: FontSize.md, color: c.primary, fontWeight: '700' },
    toggle: { flexDirection: 'row', backgroundColor: c.gray100, borderRadius: 12, padding: 4, gap: 4 },
    toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
    toggleBtnActive: { backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    toggleText: { fontSize: FontSize.sm, fontWeight: '600', color: c.textTertiary },
    toggleTextActive: { color: c.primary },
  });
}
