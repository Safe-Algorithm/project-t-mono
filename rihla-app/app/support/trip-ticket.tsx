import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { FontSize, Radius, Shadow } from '../../constants/Theme';
import { ThemeColors } from '../../constants/Theme';
import {
  getTripTicket, replyTripTicket,
  TripSupportTicketWithMessages,
} from '../../lib/supportApi';

const STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6',
  in_progress: '#F59E0B',
  waiting_on_user: '#F97316',
  resolved: '#10B981',
  closed: '#94A3B8',
};

export default function TripTicketScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: ticket, isLoading, refetch } = useQuery<TripSupportTicketWithMessages>({
    queryKey: ['trip-ticket', ticketId],
    queryFn: async () => (await getTripTicket(ticketId!)).data,
    enabled: !!ticketId,
    refetchOnMount: 'always',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const replyMutation = useMutation({
    mutationFn: (msg: string) => replyTripTicket(ticketId!, msg),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['trip-ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['support-trip-tickets'] });
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('support.tripTicketScreenTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : !ticket ? (
        <View style={s.errorState}>
          <Text style={s.errorText}>{t('support.ticketNotFound')}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {/* Ticket header */}
            <View style={s.ticketCard}>
              <Text style={s.ticketSubject}>{ticket.subject}</Text>
              <View style={s.ticketMeta}>
                <View style={[s.statusPill, { backgroundColor: STATUS_COLORS[ticket.status] ?? '#94A3B8' }]}>
                  <Text style={s.statusPillText}>{({
                    open: t('support.statusOpen'),
                    in_progress: t('support.statusInProgress'),
                    waiting_on_user: t('support.statusWaitingOnUser'),
                    resolved: t('support.statusResolved'),
                    closed: t('support.statusClosed'),
                  }[ticket.status] ?? ticket.status.replace(/_/g, ' '))}</Text>
                </View>
                <Text style={s.metaLabel}>{({
                  low: t('support.priorityLow'),
                  medium: t('support.priorityMedium'),
                  high: t('support.priorityHigh'),
                  urgent: t('support.priorityUrgent'),
                }[ticket.priority] ?? ticket.priority)}</Text>
              </View>
              <Text style={s.ticketDescription}>{ticket.description}</Text>
              <Text style={s.metaDate}>{new Date(ticket.created_at).toLocaleString()}</Text>
            </View>

            {/* Messages */}
            <Text style={s.messagesTitle}>{t('support.messagesTitle', { count: ticket.messages.length })}</Text>
            {ticket.messages.length === 0 && (
              <Text style={s.emptyMessages}>{t('support.noRepliesProvider')}</Text>
            )}
            {ticket.messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  s.messageBubble,
                  msg.sender_type === 'user' ? s.bubbleRight : s.bubbleLeft,
                ]}
              >
                <Text style={[s.senderLabel, msg.sender_type === 'user' ? s.senderYou : s.senderProvider]}>
                  {msg.sender_type === 'user' ? t('support.senderYou') : t('support.senderProvider')}
                </Text>
                <Text style={s.messageText}>{msg.message}</Text>
                <Text style={s.messageTime}>{new Date(msg.created_at).toLocaleString()}</Text>
              </View>
            ))}
          </ScrollView>

          {(ticket.status === 'closed' || ticket.status === 'resolved') ? (
            <View style={[s.closedBar, { paddingBottom: insets.bottom + 8 }]}>
              <Text style={s.closedBarText}>{t('support.ticketClosed')}</Text>
            </View>
          ) : ticket.status === 'waiting_on_user' ? (
            <View style={[s.replyBar, { paddingBottom: insets.bottom + 8 }]}>
              <TextInput
                style={s.replyInput}
                value={reply}
                onChangeText={setReply}
                placeholder={t('support.replyPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
              />
              <TouchableOpacity
                style={[s.sendBtn, (!reply.trim() || replyMutation.isPending) && s.sendBtnDisabled]}
                onPress={() => reply.trim() && replyMutation.mutate(reply)}
                disabled={!reply.trim() || replyMutation.isPending}
              >
                {replyMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[s.closedBar, { paddingBottom: insets.bottom + 8 }]}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} style={{ marginBottom: 2 }} />
              <Text style={s.closedBarText}>{t('support.waitingForResponse')}</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
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
    errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { fontSize: FontSize.md, color: colors.textSecondary },
    ticketCard: {
      backgroundColor: colors.surface, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16,
      ...Shadow.sm,
    },
    ticketSubject: { fontSize: FontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
    statusPillText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    metaLabel: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
    ticketDescription: { fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: 8 },
    metaDate: { fontSize: 12, color: colors.textTertiary },
    messagesTitle: { fontSize: FontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
    emptyMessages: { fontSize: FontSize.sm, color: colors.textTertiary, textAlign: 'center', marginVertical: 24 },
    messageBubble: {
      padding: 12, borderRadius: Radius.lg, marginBottom: 10,
      maxWidth: '85%', borderWidth: 1,
    },
    bubbleRight: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primarySurface,
      borderColor: colors.primaryLight,
    },
    bubbleLeft: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    senderLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
    senderYou: { color: colors.primary },
    senderProvider: { color: colors.accent },
    messageText: { fontSize: FontSize.sm, color: colors.textPrimary, lineHeight: 20 },
    messageTime: { fontSize: 11, color: colors.textTertiary, marginTop: 4, alignSelf: 'flex-end' },
    closedBar: {
      paddingHorizontal: 16, paddingTop: 12,
      backgroundColor: colors.surface,
      borderTopWidth: 1, borderTopColor: colors.border,
      alignItems: 'center',
    },
    closedBarText: { fontSize: FontSize.sm, color: colors.textTertiary, fontStyle: 'italic' },
    replyBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 8,
      paddingHorizontal: 12, paddingTop: 12,
      backgroundColor: colors.surface,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    replyInput: {
      flex: 1, fontSize: FontSize.sm, color: colors.textPrimary,
      backgroundColor: colors.gray100, borderRadius: Radius.lg,
      paddingHorizontal: 14, paddingVertical: 10,
      maxHeight: 100, minHeight: 44,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
  });
