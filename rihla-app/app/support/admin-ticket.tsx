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
  listAdminTickets, getAdminTicket, createAdminTicket, replyAdminTicket,
  SupportTicket, SupportTicketWithMessages,
} from '../../lib/supportApi';

const STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6',
  in_progress: '#F59E0B',
  waiting_on_user: '#F97316',
  resolved: '#10B981',
  closed: '#94A3B8',
};

const CATEGORY_OPTIONS = ['general', 'technical', 'billing'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

function useStatusLabel() {
  const { t } = useTranslation();
  return (status: string) => ({
    open: t('support.statusOpen'),
    in_progress: t('support.statusInProgress'),
    waiting_on_user: t('support.statusWaitingOnUser'),
    resolved: t('support.statusResolved'),
    closed: t('support.statusClosed'),
  }[status] ?? status.replace(/_/g, ' '));
}

function useCategoryLabel() {
  const { t } = useTranslation();
  return (cat: string) => ({
    general: t('support.categoryGeneral'),
    technical: t('support.categoryTechnical'),
    billing: t('support.categoryBilling'),
  }[cat] ?? cat);
}

function usePriorityLabel() {
  const { t } = useTranslation();
  return (p: string) => ({
    low: t('support.priorityLow'),
    medium: t('support.priorityMedium'),
    high: t('support.priorityHigh'),
    urgent: t('support.priorityUrgent'),
  }[p] ?? p);
}

// ── Ticket Thread View ────────────────────────────────────────────────────────

function TicketThread({ ticketId, colors }: { ticketId: string; colors: ThemeColors }) {
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const statusLabel = useStatusLabel();
  const categoryLabel = useCategoryLabel();
  const priorityLabel = usePriorityLabel();

  const { data: ticket, isLoading, refetch } = useQuery<SupportTicketWithMessages>({
    queryKey: ['admin-ticket', ticketId],
    queryFn: async () => (await getAdminTicket(ticketId)).data,
    refetchOnMount: 'always',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const replyMutation = useMutation({
    mutationFn: (msg: string) => replyAdminTicket(ticketId, msg),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['admin-ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['support-admin-tickets'] });
    },
  });

  if (isLoading) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />;
  }
  if (!ticket) return null;

  return (
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
              <Text style={s.statusPillText}>{statusLabel(ticket.status)}</Text>
            </View>
            <Text style={s.metaLabel}>{categoryLabel(ticket.category)}</Text>
            <Text style={s.metaLabel}>{priorityLabel(ticket.priority)}</Text>
          </View>
          <Text style={s.ticketDescription}>{ticket.description}</Text>
          <Text style={s.metaDate}>{new Date(ticket.created_at).toLocaleString()}</Text>
        </View>

        {/* Messages */}
        <Text style={s.messagesTitle}>{t('support.messagesTitle', { count: ticket.messages.length })}</Text>
        {ticket.messages.length === 0 && (
          <Text style={s.emptyMessages}>{t('support.noRepliesAdmin')}</Text>
        )}
        {ticket.messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              s.messageBubble,
              msg.sender_type === 'user' ? s.bubbleRight : s.bubbleLeft,
            ]}
          >
            <Text style={[s.senderLabel, msg.sender_type === 'user' ? s.senderYou : s.senderAdmin]}>
              {msg.sender_type === 'user' ? t('support.senderYou') : t('support.senderAdmin')}
            </Text>
            <Text style={s.messageText}>{msg.message}</Text>
            <Text style={s.messageTime}>{new Date(msg.created_at).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>

      {ticket.status === 'closed' ? (
        <View style={[s.closedBar, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={s.closedBarText}>{t('support.ticketClosed')}</Text>
        </View>
      ) : (
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
      )}
    </KeyboardAvoidingView>
  );
}

// ── New Ticket Form ───────────────────────────────────────────────────────────

function NewTicketForm({ colors, onCreated }: { colors: ThemeColors; onCreated: (id: string) => void }) {
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const priorityLabel = usePriorityLabel();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => createAdminTicket({ subject, description, category, priority }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['support-admin-tickets'] });
      onCreated(res.data.id);
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.formTitle}>{t('support.formTitle')}</Text>
        <Text style={s.formSubtitle}>{t('support.formSubtitle')}</Text>

        <Text style={s.fieldLabel}>{t('support.subjectLabel')} *</Text>
        <TextInput
          style={s.input}
          value={subject}
          onChangeText={setSubject}
          placeholder={t('support.subjectPlaceholder')}
          placeholderTextColor={colors.textTertiary}
        />

        <Text style={s.fieldLabel}>{t('support.descriptionLabel')} *</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('support.descriptionPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <Text style={s.fieldLabel}>{t('support.categoryLabel')}</Text>
        <View style={s.chipRow}>
          {CATEGORY_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[s.chip, category === c && s.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[s.chipText, category === c && s.chipTextActive]}>{categoryLabel(c)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.fieldLabel}>{t('support.priorityLabel')}</Text>
        <View style={s.chipRow}>
          {PRIORITY_OPTIONS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[s.chip, priority === p && s.chipActive]}
              onPress={() => setPriority(p)}
            >
              <Text style={[s.chipText, priority === p && s.chipTextActive]}>{priorityLabel(p)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {createMutation.isError && (
          <Text style={s.errorText}>{t('support.submitFailed')}</Text>
        )}

        <TouchableOpacity
          style={[s.submitBtn, (!subject.trim() || !description.trim() || createMutation.isPending) && s.submitBtnDisabled]}
          onPress={() => createMutation.mutate()}
          disabled={!subject.trim() || !description.trim() || createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.submitBtnText}>{t('support.submitTicket')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Ticket List ───────────────────────────────────────────────────────────────

function TicketList({
  colors, onSelect, onNew,
}: { colors: ThemeColors; onSelect: (id: string) => void; onNew: () => void }) {
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const [refreshing, setRefreshing] = useState(false);
  const { data: tickets, isLoading, refetch } = useQuery<SupportTicket[]>({
    queryKey: ['support-admin-tickets'],
    queryFn: async () => (await listAdminTickets()).data,
    refetchOnMount: 'always',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {(!tickets || tickets.length === 0) ? (
        <View style={s.emptyState}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textTertiary} />
          <Text style={s.emptyTitle}>{t('support.emptyTicketsTitle')}</Text>
          <Text style={s.emptyDesc}>{t('support.emptyTicketsDesc')}</Text>
          <TouchableOpacity style={s.emptyNewBtn} onPress={onNew}>
            <Text style={s.emptyNewBtnText}>{t('support.createTicket')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        tickets.map((t) => (
          <TouchableOpacity key={t.id} style={s.listRow} onPress={() => onSelect(t.id)} activeOpacity={0.7}>
            <View style={s.listRowLeft}>
              <Text style={s.listSubject} numberOfLines={1}>{t.subject}</Text>
              <Text style={s.listMeta}>{categoryLabel(t.category)} · {new Date(t.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[t.status] ?? '#94A3B8' }]} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type ScreenView = 'list' | 'new' | 'thread';

export default function AdminTicketScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const params = useLocalSearchParams<{ ticketId?: string }>();

  const [view, setView] = useState<ScreenView>(params.ticketId ? 'thread' : 'list');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(params.ticketId ?? null);

  const handleSelect = (id: string) => { setActiveTicketId(id); setView('thread'); };
  const handleCreated = (id: string) => { setActiveTicketId(id); setView('thread'); };
  const handleBack = () => {
    if (view === 'thread' || view === 'new') { setView('list'); setActiveTicketId(null); }
    else router.back();
  };

  const { t } = useTranslation();
  const title = view === 'new' ? t('support.newTicketScreenTitle') : view === 'thread' ? t('support.ticketScreenTitle') : t('support.adminTicketScreenTitle');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{title}</Text>
        {view === 'list' ? (
          <TouchableOpacity onPress={() => setView('new')} style={s.newIconBtn}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      {view === 'list' && <TicketList colors={colors} onSelect={handleSelect} onNew={() => setView('new')} />}
      {view === 'new' && <NewTicketForm colors={colors} onCreated={handleCreated} />}
      {view === 'thread' && activeTicketId && <TicketThread ticketId={activeTicketId} colors={colors} />}
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
    newIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.textPrimary },
    scroll: { padding: 16, paddingBottom: 40 },

    // Thread
    ticketCard: {
      backgroundColor: colors.surface, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16,
      ...Shadow.sm,
    },
    ticketSubject: { fontSize: FontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
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
    senderAdmin: { color: colors.success },
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

    // Form
    formTitle: { fontSize: FontSize.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    formSubtitle: { fontSize: FontSize.sm, color: colors.textSecondary, marginBottom: 24, lineHeight: 20 },
    fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 16 },
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

    // List
    listRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: colors.border,
      padding: 14, marginBottom: 10, ...Shadow.sm,
    },
    listRowLeft: { flex: 1 },
    listSubject: { fontSize: FontSize.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: 3 },
    listMeta: { fontSize: 12, color: colors.textTertiary, textTransform: 'capitalize' },
    statusDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 12 },
    emptyState: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.textPrimary, marginTop: 12 },
    emptyDesc: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
    emptyNewBtn: {
      marginTop: 20, backgroundColor: colors.primary,
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.full,
    },
    emptyNewBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  });
