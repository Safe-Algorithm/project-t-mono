import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../lib/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Colors, FontSize, Radius, Shadow } from '../../constants/Theme';

export default function PersonalInformationScreen() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t('personalInfo.name') + ' is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const { data } = await apiClient.patch('/users/me', { name: name.trim() });
      updateUser(data);
      setErrors({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? (detail[0]?.msg ?? t('personalInfo.updateFailed'))
        : (typeof detail === 'string' ? detail : t('personalInfo.updateFailed'));
      Alert.alert(t('common.error'), msg);
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
        <Text style={styles.headerTitle}>{t('personalInfo.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Input
          label={t('personalInfo.name')}
          value={name}
          onChangeText={(v) => { setName(v); setSaved(false); }}
          placeholder={t('personalInfo.name')}
          error={errors.name}
        />

        <View style={styles.readonlyCard}>
          <View style={styles.readonlyRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.readonlyLabel}>{t('personalInfo.email')}</Text>
              <Text style={styles.readonlyValue}>{user?.email ?? '—'}</Text>
            </View>
            {user?.is_email_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.readonlyRow}>
            <Ionicons name="call-outline" size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.readonlyLabel}>{t('personalInfo.phone')}</Text>
              <Text style={styles.readonlyValue}>{user?.phone ?? '—'}</Text>
            </View>
            {user?.is_phone_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.note}>{t('profile.helpMessage')}</Text>

        <Button
          title={saved ? t('common.done') : t('personalInfo.saveChanges')}
          onPress={handleSave}
          loading={loading}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
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
  content: { padding: 20, gap: 16 },
  readonlyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  readonlyLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  readonlyValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 46 },
  note: { fontSize: FontSize.sm, color: Colors.textTertiary, lineHeight: 20 },
});
