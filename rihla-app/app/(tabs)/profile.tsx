import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/Theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import apiClient from '../../lib/api';

interface MenuItemProps {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
}

function MenuItem({ icon, label, onPress, danger = false, value }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? Colors.error : Colors.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {value ? (
        <Text style={styles.menuValue}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);
  const nameChanged = name.trim() !== (user?.name ?? '').trim();
  const [avatarLoading, setAvatarLoading] = useState(false);

  const handleAvatarUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
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
      Alert.alert('Upload Failed', err?.response?.data?.detail ?? 'Could not upload photo.');
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
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Avatar & name */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarUpload} disabled={avatarLoading} style={styles.avatarWrapper}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {avatarLoading
                ? <ActivityIndicator size={12} color={Colors.white} />
                : <Ionicons name="camera" size={12} color={Colors.white} />}
            </View>
          </TouchableOpacity>

          <View style={styles.nameEditBlock}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              style={styles.nameInput}
              containerStyle={styles.nameInputContainer}
            />
            {nameChanged && (
              <View style={styles.saveRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setName(user?.name ?? '')}
                  disabled={loading}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtnPrimary, loading && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator size={14} color={Colors.white} />
                    : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.userContact}>
            {user?.email ?? user?.phone ?? ''}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="calendar-outline" label="Trips" value="—" />
          <StatCard icon="heart-outline" label="Saved" value="—" />
          <StatCard icon="star-outline" label="Reviews" value="—" />
        </View>

        {/* Menu sections */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              label="Personal Information"
              onPress={() => router.push('/account/personal-information')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="lock-closed-outline"
              label="Change Password"
              onPress={() => router.push('/account/change-password')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => Alert.alert('Coming Soon', 'Notification settings will be available soon.')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="calendar-outline"
              label="My Bookings"
              onPress={() => router.push('/(tabs)/bookings')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="heart-outline"
              label="Saved Trips"
              onPress={() => router.push('/(tabs)/favorites')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="star-outline"
              label="My Reviews"
              onPress={() => router.push('/account/my-reviews')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="help-circle-outline"
              label="Help & Support"
              onPress={() => Alert.alert('Help & Support', 'For support, contact us at support@rihla.app')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="document-text-outline"
              label="Terms & Privacy"
              onPress={() => Alert.alert('Terms & Privacy', 'Visit rihla.app/terms for our terms and privacy policy.')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="log-out-outline"
              label="Sign Out"
              onPress={handleLogout}
              danger
            />
          </View>
        </View>

        <Text style={styles.version}>Rihla v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  avatarWrapper: { position: 'relative', marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.primaryLight,
  },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  avatarInitials: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  userContact: { fontSize: FontSize.md, color: Colors.textTertiary },
  nameEditBlock: { width: '100%', gap: 8 },
  nameInputContainer: { marginBottom: 0 },
  nameInput: { fontSize: FontSize.lg, textAlign: 'center' },
  saveRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  cancelBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  saveBtnPrimary: {
    paddingHorizontal: 24, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    minWidth: 80, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: FontSize.sm, color: Colors.white, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    ...Shadow.sm,
  },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },

  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: Colors.errorLight },
  menuLabel: { flex: 1, fontSize: FontSize.md, fontWeight: '500', color: Colors.textPrimary },
  menuLabelDanger: { color: Colors.error },
  menuValue: { fontSize: FontSize.sm, color: Colors.textTertiary },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 64 },

  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 24,
  },
});
