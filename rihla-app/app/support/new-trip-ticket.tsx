import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { FontSize, Radius } from '../../constants/Theme';
import { ThemeColors } from '../../constants/Theme';
import { createTripTicket } from '../../lib/supportApi';

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

export default function NewTripTicketScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const { tripId, registrationId } = useLocalSearchParams<{ tripId: string; registrationId: string }>();
  const qc = useQueryClient();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const createMutation = useMutation({
    mutationFn: () =>
      createTripTicket(tripId!, registrationId!, { subject, description, priority }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['support-trip-tickets'] });
      router.replace({
        pathname: '/support/trip-ticket' as any,
        params: { ticketId: res.data.id },
      });
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('support.contactProviderScreenTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.formTitle}>{t('support.contactFormTitle')}</Text>
          <Text style={s.formSubtitle}>{t('support.contactFormSubtitle')}</Text>

          <Text style={s.fieldLabel}>{t('support.subjectLabel')} *</Text>
          <TextInput
            style={s.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('support.briefSummaryPlaceholder')}
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={s.fieldLabel}>{t('support.descriptionLabel')} *</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('support.detailPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={s.fieldLabel}>{t('support.priorityLabel')}</Text>
          <View style={s.chipRow}>
            {PRIORITY_OPTIONS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.chip, priority === p && s.chipActive]}
                onPress={() => setPriority(p)}
              >
                <Text style={[s.chipText, priority === p && s.chipTextActive]}>{({
                  low: t('support.priorityLow'),
                  medium: t('support.priorityMedium'),
                  high: t('support.priorityHigh'),
                  urgent: t('support.priorityUrgent'),
                }[p])}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {createMutation.isError && (
            <Text style={s.errorText}>{t('support.submitFailed')}</Text>
          )}

          <TouchableOpacity
            style={[
              s.submitBtn,
              (!subject.trim() || !description.trim() || createMutation.isPending) && s.submitBtnDisabled,
            ]}
            onPress={() => createMutation.mutate()}
            disabled={!subject.trim() || !description.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>{t('support.sendMessage')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.textPrimary },
    scroll: { padding: 16, paddingBottom: 40 },
    formTitle: { fontSize: FontSize.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    formSubtitle: {
      fontSize: FontSize.sm, color: colors.textSecondary,
      marginBottom: 24, lineHeight: 20,
    },
    fieldLabel: {
      fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary,
      marginBottom: 6, marginTop: 16,
    },
    input: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: FontSize.sm, color: colors.textPrimary,
    },
    textarea: { minHeight: 110, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize' },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    errorText: { color: colors.error, fontSize: FontSize.sm, marginTop: 8 },
    submitBtn: {
      backgroundColor: colors.primary, borderRadius: Radius.lg,
      paddingVertical: 14, alignItems: 'center', marginTop: 28,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  });
