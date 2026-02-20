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
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { FontSize, Radius, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { language, setLanguage } = useLanguageStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login } = useAuthStore();

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = t('auth.email');
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('auth.email');
    if (!password) e.password = t('auth.password');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? (detail[0]?.msg ?? t('auth.loginFailed')) : (typeof detail === 'string' ? detail : t('auth.loginFailed'));
      Alert.alert(t('auth.login'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity style={s.langToggle} onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
            <Text style={s.langToggleText}>{language === 'en' ? 'العربية' : 'English'}</Text>
          </TouchableOpacity>
          <View style={s.logoContainer}>
            <Ionicons name="compass" size={40} color={colors.white} />
          </View>
          <Text style={s.appName}>Rihla</Text>
          <Text style={s.tagline}>{t('auth.loginSubtitle')}</Text>
        </View>
        <View style={s.form}>
          <Text style={s.title}>{t('auth.loginTitle')}</Text>
          <Text style={s.subtitle}>{t('auth.loginSubtitle')}</Text>
          <View style={s.fields}>
            <Input label={t('auth.email')} placeholder={t('auth.email')} value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoComplete="email"
              leftIcon="mail-outline" error={errors.email} />
            <Input label={t('auth.password')} placeholder={t('auth.password')} value={password}
              onChangeText={setPassword} isPassword leftIcon="lock-closed-outline" error={errors.password} />
          </View>
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={s.forgotRow}>
            <Text style={s.forgotText}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>
          <Button title={t('auth.login')} onPress={handleLogin} loading={loading} fullWidth size="lg" style={s.loginBtn} />
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>
          <View style={s.registerRow}>
            <Text style={s.registerText}>{t('auth.noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={s.registerLink}>{t('auth.signUp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { flexGrow: 1 },
    header: { backgroundColor: c.primary, paddingTop: 80, paddingBottom: 48, alignItems: 'center', gap: 8, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    logoContainer: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    appName: { fontSize: FontSize.display, fontWeight: '800', color: c.white, letterSpacing: -0.5 },
    tagline: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)' },
    langToggle: { position: 'absolute', top: 48, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    langToggleText: { fontSize: FontSize.sm, color: c.white, fontWeight: '700' },
    form: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40, gap: 0 },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary, marginBottom: 6 },
    subtitle: { fontSize: FontSize.md, color: c.textSecondary, marginBottom: 28 },
    fields: { gap: 16, marginBottom: 12 },
    forgotRow: { alignSelf: 'flex-end', marginBottom: 24 },
    forgotText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600' },
    loginBtn: { marginBottom: 24 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: { fontSize: FontSize.sm, color: c.textTertiary },
    registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    registerText: { fontSize: FontSize.md, color: c.textSecondary },
    registerLink: { fontSize: FontSize.md, color: c.primary, fontWeight: '700' },
  });
}
