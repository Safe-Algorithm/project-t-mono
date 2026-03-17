import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { useThemeStore } from '../../store/themeStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import apiClient from '../../lib/api';
import { useMyRegistrations, useFavorites, useMyReviews } from '../../hooks/useTrips';
import Toast from '../../components/ui/Toast';

interface MenuItemProps {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
}

function MenuItem({ icon, label, onPress, danger = false, value }: MenuItemProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.menuIcon, danger && s.menuIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <Text style={[s.menuLabel, danger && s.menuLabelDanger]}>{label}</Text>
      {value ? (
        <Text style={s.menuValue}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { user, logout, updateUser } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { preference, setPreference } = useThemeStore();
  const [name, setName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);
  const nameChanged = name.trim() !== (user?.name ?? '').trim();
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success' | 'info'>('error');

  const showToast = (msg: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const { data: myRegistrations } = useMyRegistrations();
  const { data: favorites } = useFavorites();
  const { data: myReviews } = useMyReviews();

  const tripsCount = myRegistrations?.filter(r => !['cancelled'].includes(r.status)).length ?? null;
  const savedCount = favorites?.length ?? null;
  const reviewsCount = myReviews?.length ?? null;

  React.useEffect(() => {
    if (user?.name !== undefined) setName(user.name ?? '');
  }, [user?.name]);

  const handleAvatarUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast(t('profile.permissionMessage'), 'info');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as any);
      const { data } = await apiClient.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(data);
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? t('profile.uploadFailed'), 'error');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await apiClient.patch('/users/me', { name: name.trim() });
      updateUser(data);
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? t('profile.updateFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.signOutConfirmTitle'), t('profile.signOutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleLanguageToggle = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  const handleThemeToggle = () => {
    if (preference === 'system') setPreference('light');
    else if (preference === 'light') setPreference('dark');
    else setPreference('system');
  };

  const themeLabel = preference === 'dark' ? t('profile.themeDark') : preference === 'light' ? t('profile.themeLight') : t('profile.themeSystem');

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('profile.title')}</Text>
        </View>

        <View style={s.avatarSection}>
          <TouchableOpacity onPress={handleAvatarUpload} disabled={avatarLoading} style={s.avatarWrapper}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={s.avatarEditBadge}>
              {avatarLoading
                ? <ActivityIndicator size={12} color={colors.white} />
                : <Ionicons name="camera" size={12} color={colors.white} />}
            </View>
          </TouchableOpacity>

          <View style={s.nameEditBlock}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t('profile.yourName')}
              style={s.nameInput}
              containerStyle={s.nameInputContainer}
            />
            {nameChanged && (
              <View style={s.saveRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setName(user?.name ?? '')} disabled={loading}>
                  <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtnPrimary, loading && s.saveBtnDisabled]} onPress={handleSave} disabled={loading}>
                  {loading
                    ? <ActivityIndicator size={14} color={colors.white} />
                    : <Text style={s.saveBtnText}>{t('common.save')}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={s.userContact}>{user?.email ?? user?.phone ?? ''}</Text>
        </View>

        <View style={s.statsRow}>
          <StatCard icon="calendar-outline" label={t('profile.trips')} value={tripsCount !== null ? String(tripsCount) : '—'} />
          <StatCard icon="heart-outline" label={t('profile.saved')} value={savedCount !== null ? String(savedCount) : '—'} />
          <StatCard icon="star-outline" label={t('profile.reviews')} value={reviewsCount !== null ? String(reviewsCount) : '—'} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('profile.account')}</Text>
          <View style={s.menuCard}>
            <MenuItem icon="person-outline" label={t('profile.personalInfo')} onPress={() => router.push('/account/personal-information')} />
            <View style={s.menuDivider} />
            <MenuItem icon="lock-closed-outline" label={t('profile.changePassword')} onPress={() => router.push('/account/change-password')} />
            <View style={s.menuDivider} />
            <MenuItem icon="notifications-outline" label={t('profile.notifications')} onPress={() => Alert.alert(t('common.comingSoon'), t('profile.notificationsComingSoon'))} />
            <View style={s.menuDivider} />
            <MenuItem icon="language-outline" label={t('profile.language')} value={language === 'ar' ? 'العربية' : 'English'} onPress={handleLanguageToggle} />
            <View style={s.menuDivider} />
            <MenuItem icon="moon-outline" label={t('profile.theme')} value={themeLabel} onPress={handleThemeToggle} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('profile.activity')}</Text>
          <View style={s.menuCard}>
            <MenuItem icon="calendar-outline" label={t('profile.myBookings')} onPress={() => router.push('/(tabs)/bookings')} />
            <View style={s.menuDivider} />
            <MenuItem icon="heart-outline" label={t('profile.savedTrips')} onPress={() => router.push('/(tabs)/favorites')} />
            <View style={s.menuDivider} />
            <MenuItem icon="star-outline" label={t('profile.myReviews')} onPress={() => router.push('/account/my-reviews')} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('profile.support')}</Text>
          <View style={s.menuCard}>
            <MenuItem icon="help-circle-outline" label={t('profile.helpSupport')} onPress={() => Alert.alert(t('profile.helpSupport'), t('profile.helpMessage'))} />
            <View style={s.menuDivider} />
            <MenuItem icon="document-text-outline" label={t('profile.termsPrivacy')} onPress={() => Alert.alert(t('profile.termsPrivacy'), t('profile.termsMessage'))} />
          </View>
        </View>

        <View style={s.section}>
          <View style={s.menuCard}>
            <MenuItem icon="log-out-outline" label={t('profile.signOut')} onPress={handleLogout} danger />
          </View>
        </View>

        <Text style={s.version}>{t('common.version')}</Text>
        <View style={{ height: 32 }} />
      </ScrollView>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value }: { icon: any; label: string; value: string }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <View style={s.statCard}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary },
    avatarSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20, gap: 8 },
    avatarWrapper: { position: 'relative', marginBottom: 4 },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.primaryLight },
    avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.white },
    avatarInitials: { fontSize: FontSize.xxl, fontWeight: '800', color: c.primary },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    userName: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    userContact: { fontSize: FontSize.md, color: c.textTertiary },
    nameEditBlock: { width: '100%', gap: 8 },
    nameInputContainer: { marginBottom: 0 },
    nameInput: { fontSize: FontSize.lg, textAlign: 'center' },
    saveRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
    cancelBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: c.border },
    cancelBtnText: { fontSize: FontSize.sm, color: c.textSecondary, fontWeight: '600' },
    saveBtnPrimary: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: c.primary, minWidth: 80, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { fontSize: FontSize.sm, color: c.white, fontWeight: '700' },
    statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
    statCard: { flex: 1, backgroundColor: c.surface, borderRadius: Radius.xl, padding: 14, alignItems: 'center', gap: 4, ...Shadow.sm },
    statValue: { fontSize: FontSize.xl, fontWeight: '800', color: c.textPrimary },
    statLabel: { fontSize: FontSize.xs, color: c.textTertiary, fontWeight: '500' },
    section: { paddingHorizontal: 16, marginTop: 16 },
    sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: c.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingLeft: 4 },
    menuCard: { backgroundColor: c.surface, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.sm },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center' },
    menuIconDanger: { backgroundColor: c.errorLight },
    menuLabel: { flex: 1, fontSize: FontSize.md, fontWeight: '500', color: c.textPrimary },
    menuLabelDanger: { color: c.error },
    menuValue: { fontSize: FontSize.sm, color: c.textTertiary },
    menuDivider: { height: 1, backgroundColor: c.border, marginLeft: 64 },
    version: { textAlign: 'center', fontSize: FontSize.xs, color: c.textTertiary, marginTop: 24 },
  });
}
