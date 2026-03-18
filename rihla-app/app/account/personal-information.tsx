import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Animated,
} from 'react-native';
import { useDragToDismiss } from '../../hooks/useDragToDismiss';
import Toast from '../../components/ui/Toast';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../lib/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import PhoneInput, { COUNTRIES, Country } from '../../components/ui/PhoneInput';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';

type AddStep = 'input' | 'otp';
type AddType = 'email' | 'phone';

export default function PersonalInformationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasChanges = name.trim() !== (user?.name ?? '').trim();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Add identifier modal state
  const [addType, setAddType] = useState<AddType>('email');
  const [addStep, setAddStep] = useState<AddStep>('input');
  const [modalVisible, setModalVisible] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addLocalNumber, setAddLocalNumber] = useState('');
  const [addCountry, setAddCountry] = useState<Country>(COUNTRIES[0]);
  const [addOtp, setAddOtp] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fullAddPhone = `${addCountry.dialCode}${addLocalNumber.trim()}`;

  const openModal = (type: AddType) => {
    setAddType(type);
    setAddStep('input');
    setAddEmail('');
    setAddLocalNumber('');
    setAddCountry(COUNTRIES[0]);
    setAddOtp('');
    setAddError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t('personalInfo.name') + ' is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const { data } = await apiClient.patch('/users/me', { name: name.trim() });
      updateUser(data);
      setErrors({});
      setToastMessage(t('personalInfo.updateSuccess'));
      setToastVisible(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? (detail[0]?.msg ?? t('personalInfo.updateFailed')) : (typeof detail === 'string' ? detail : t('personalInfo.updateFailed'));
      setToastMessage(msg);
      setToastVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setAddError('');
    if (addType === 'email' && !addEmail.trim()) { setAddError('Email is required'); return; }
    if (addType === 'phone' && !addLocalNumber.trim()) { setAddError('Phone number is required'); return; }
    setAddLoading(true);
    try {
      if (addType === 'email') {
        await apiClient.post('/otp/send-email-otp-registration', { email: addEmail.trim() });
      } else {
        await apiClient.post('/otp/send-otp-registration', { phone: fullAddPhone });
      }
      setAddStep('otp');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setAddError(Array.isArray(detail) ? (detail[0]?.msg ?? 'Failed to send code') : (typeof detail === 'string' ? detail : 'Failed to send code'));
    } finally {
      setAddLoading(false);
    }
  };

  const handleVerifyAndLink = async () => {
    if (!addOtp.trim() || addOtp.length < 6) { setAddError('Enter the 6-digit code'); return; }
    setAddLoading(true);
    try {
      let verificationToken: string;
      if (addType === 'email') {
        const res = await apiClient.post('/otp/verify-email-otp-registration', { email: addEmail.trim(), otp: addOtp.trim() });
        verificationToken = res.data.verification_token;
        const { data } = await apiClient.patch(`/users/me?email_verification_token=${encodeURIComponent(verificationToken)}`, { email: addEmail.trim() });
        updateUser(data);
      } else {
        const res = await apiClient.post('/otp/verify-otp-registration', { phone: fullAddPhone, otp: addOtp.trim() });
        verificationToken = res.data.verification_token;
        const { data } = await apiClient.patch(`/users/me?phone_verification_token=${encodeURIComponent(verificationToken)}`, { phone: fullAddPhone });
        updateUser(data);
      }
      setModalVisible(false);
      setToastMessage(addType === 'email' ? t('personalInfo.emailAdded', 'Email added successfully!') : t('personalInfo.phoneAdded', 'Phone number added successfully!'));
      setToastVisible(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setAddError(Array.isArray(detail) ? (detail[0]?.msg ?? 'Verification failed') : (typeof detail === 'string' ? detail : 'Verification failed'));
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('personalInfo.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Input label={t('personalInfo.name')} value={name}
          onChangeText={(v) => { setName(v); }}
          placeholder={t('personalInfo.name')} error={errors.name} />

        <View style={s.readonlyCard}>
          {/* Email row */}
          <View style={s.readonlyRow}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.readonlyLabel}>{t('personalInfo.email')}</Text>
              <Text style={s.readonlyValue}>{user?.email ?? '—'}</Text>
            </View>
            {user?.email ? (
              user?.is_email_verified && (
                <View style={s.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={s.verifiedText}>Verified</Text>
                </View>
              )
            ) : (
              <TouchableOpacity style={s.addBtn} onPress={() => openModal('email')}>
                <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                <Text style={s.addBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.divider} />

          {/* Phone row */}
          <View style={s.readonlyRow}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.readonlyLabel}>{t('personalInfo.phone')}</Text>
              <Text style={s.readonlyValue}>{user?.phone ?? '—'}</Text>
            </View>
            {user?.phone ? (
              user?.is_phone_verified && (
                <View style={s.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={s.verifiedText}>Verified</Text>
                </View>
              )
            ) : (
              <TouchableOpacity style={s.addBtn} onPress={() => openModal('phone')}>
                <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                <Text style={s.addBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {hasChanges && (
          <Button title={t('personalInfo.saveChanges')} onPress={handleSave} loading={loading} style={{ marginTop: 8 }} />
        )}
      </ScrollView>

      {/* Add identifier modal */}
      <AddIdentifierSheet visible={modalVisible} onClose={() => setModalVisible(false)} colors={colors} s={s}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>
              {addType === 'email' ? 'Add Email Address' : 'Add Phone Number'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={s.sheetContent}>
            {addStep === 'input' ? (
              <>
                <Text style={s.sheetSubtitle}>
                  {addType === 'email'
                    ? "We'll send a verification code to your email."
                    : "We'll send a verification code via SMS."}
                </Text>
                {addType === 'email' ? (
                  <Input
                    label="Email Address"
                    placeholder="you@example.com"
                    value={addEmail}
                    onChangeText={(v) => { setAddEmail(v); setAddError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    leftIcon="mail-outline"
                    error={addError}
                  />
                ) : (
                  <PhoneInput
                    label="Phone Number"
                    value={addLocalNumber}
                    onChangeText={(v) => { setAddLocalNumber(v); setAddError(''); }}
                    selectedCountry={addCountry}
                    onSelectCountry={(c) => { setAddCountry(c); setAddLocalNumber(''); }}
                    error={addError}
                  />
                )}
                <Button title="Send Verification Code" onPress={handleSendOtp} loading={addLoading} fullWidth size="lg" style={{ marginTop: 8 }} />
              </>
            ) : (
              <>
                <Text style={s.sheetSubtitle}>
                  Enter the 6-digit code sent to {addType === 'email' ? addEmail : fullAddPhone}
                </Text>
                <Input
                  label="Verification Code"
                  placeholder="000000"
                  value={addOtp}
                  onChangeText={(v) => { setAddOtp(v); setAddError(''); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  leftIcon="key-outline"
                  error={addError}
                />
                <Button title="Verify & Link" onPress={handleVerifyAndLink} loading={addLoading} fullWidth size="lg" style={{ marginTop: 8 }} />
                <TouchableOpacity onPress={() => { setAddStep('input'); setAddOtp(''); setAddError(''); }} style={s.backLink}>
                  <Text style={s.backLinkText}>← Change {addType === 'email' ? 'email' : 'number'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
      </AddIdentifierSheet>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="success"
        onHide={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

function AddIdentifierSheet({ visible, onClose, children, s }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  colors?: ThemeColors;
  s: any;
}) {
  const { translateY, backdropOpacity, panHandlers, openSheet, closeSheet } = useDragToDismiss(onClose);
  useEffect(() => { if (visible) openSheet(); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet()} />
        <Animated.View style={[s.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    content: { padding: 20, gap: 16 },
    readonlyCard: { backgroundColor: c.surface, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.sm },
    readonlyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    readonlyLabel: { fontSize: FontSize.xs, color: c.textTertiary, fontWeight: '500' },
    readonlyValue: { fontSize: FontSize.md, color: c.textPrimary, fontWeight: '600', marginTop: 2 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    verifiedText: { fontSize: FontSize.xs, color: c.success, fontWeight: '600' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primarySurface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md },
    addBtnText: { fontSize: FontSize.xs, color: c.primary, fontWeight: '700' },
    divider: { height: 1, backgroundColor: c.border, marginLeft: 46 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden' },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    sheetTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    sheetContent: { padding: 20, gap: 16 },
    sheetSubtitle: { fontSize: FontSize.md, color: c.textSecondary, lineHeight: 22 },
    backLink: { alignSelf: 'center', paddingVertical: 8 },
    backLinkText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600' },
  });
}
