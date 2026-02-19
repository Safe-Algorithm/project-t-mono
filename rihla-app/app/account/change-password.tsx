import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../lib/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Colors, FontSize, Radius, Spacing } from '../../constants/Theme';
import { useAuthStore } from '../../store/authStore';

type Step = 'otp' | 'reset' | 'success';

function extractError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  return Array.isArray(detail)
    ? (detail[0]?.msg ?? fallback)
    : (typeof detail === 'string' ? detail : fallback);
}

export default function ChangePasswordScreen() {
  const { user } = useAuthStore();
  const email = user?.email ?? '';

  const [step, setStep] = useState<Step>('otp');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = async () => {
    if (!email) {
      Alert.alert('Error', 'No email associated with your account.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/otp/send-password-reset-otp', { email });
      setOtpSent(true);
      setErrors({});
    } catch (err: any) {
      setErrors({ otp: extractError(err, 'Failed to send OTP') });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const errs: Record<string, string> = {};
    if (!otp.trim() || otp.trim().length !== 6) errs.otp = 'Enter the 6-digit OTP';
    if (!newPassword || newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters';
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await apiClient.post('/otp/reset-password', {
        email,
        otp: otp.trim(),
        new_password: newPassword,
      });
      setErrors({});
      setStep('success');
    } catch (err: any) {
      setErrors({ otp: extractError(err, 'Failed to reset password') });
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
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {step === 'success' ? (
          <View style={styles.successBox}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>Password Changed!</Text>
            <Text style={styles.successText}>Your password has been updated successfully.</Text>
            <Button title="Done" onPress={() => router.back()} style={{ marginTop: 24 }} />
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {email
                ? `We'll send a verification code to ${email}`
                : 'A verification code will be sent to your email'}
            </Text>

            {!otpSent ? (
              <Button
                title="Send Verification Code"
                onPress={sendOtp}
                loading={loading}
                style={{ marginTop: 24 }}
              />
            ) : (
              <View style={styles.form}>
                <Text style={styles.sentNote}>
                  Code sent to {email}. Check your inbox.
                </Text>

                <Input
                  label="Verification Code"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                  error={errors.otp}
                />

                <Input
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 8 characters"
                  secureTextEntry
                  error={errors.newPassword}
                />

                <Input
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat new password"
                  secureTextEntry
                  error={errors.confirmPassword}
                />

                <Button
                  title="Change Password"
                  onPress={handleReset}
                  loading={loading}
                  style={{ marginTop: 8 }}
                />

                <TouchableOpacity style={styles.resendRow} onPress={sendOtp} disabled={loading}>
                  <Text style={styles.resendText}>Didn't receive the code? </Text>
                  <Text style={styles.resendLink}>Resend</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
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
  content: { flex: 1, padding: 24 },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  sentNote: {
    fontSize: FontSize.sm, color: Colors.success, fontWeight: '600',
    marginBottom: 16,
  },
  form: { gap: 12, marginTop: 8 },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  resendText: { fontSize: FontSize.sm, color: Colors.textTertiary },
  resendLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  successIcon: { marginBottom: 8 },
  successTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  successText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
