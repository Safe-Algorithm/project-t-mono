import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAllMyTripUpdates, useMarkUpdateRead } from '../hooks/useTrips';
import { FontSize, Radius, Shadow, ThemeColors } from '../constants/Theme';
import { useTheme } from '../hooks/useTheme';
import { Skeleton } from '../components/ui/SkeletonLoader';
import { TripUpdate } from '../types/trip';

function UpdateItem({ update, onPress }: { update: TripUpdate; onPress: () => void }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const isTargeted = !!update.registration_id;
  const timeStr = new Date(update.created_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={[s.item, !update.read && s.itemUnread]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={s.iconWrap}>
        <Ionicons
          name={isTargeted ? 'person-circle' : 'megaphone'}
          size={28}
          color={update.read ? colors.gray300 : colors.primary}
        />
        {!update.read && <View style={s.unreadDot} />}
      </View>
      <View style={s.itemContent}>
        <View style={s.itemHeader}>
          <Text style={[s.itemTitle, !update.read && s.itemTitleUnread]} numberOfLines={1}>
            {update.title}
          </Text>
          <Text style={s.itemTime}>{timeStr}</Text>
        </View>
        <Text style={s.itemBody} numberOfLines={2}>{update.body}</Text>
        {isTargeted && (
          <View style={s.targetedTag}>
            <Ionicons name="person" size={10} color={colors.primary} />
            <Text style={s.targetedText}>Personal update</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TripUpdatesScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { data: updates, isLoading, refetch } = useAllMyTripUpdates();
  const markRead = useMarkUpdateRead();

  const handlePress = useCallback((update: TripUpdate) => {
    if (!update.read) {
      markRead.mutate(update.id);
    }
    router.push(`/booking/${update.registration_id ?? update.trip_id}` as any);
  }, [markRead]);

  const unreadCount = updates?.filter((u) => !u.read).length ?? 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons
            name={i18n.language === 'ar' ? 'arrow-forward' : 'arrow-back'}
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{t('trip.updates') ?? 'Trip Updates'}</Text>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={s.list}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={s.skeletonItem}>
              <Skeleton height={44} width={44} borderRadius={22} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton height={16} width="70%" />
                <Skeleton height={12} width="90%" />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={updates ?? []}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <UpdateItem update={item} onPress={() => handlePress(item)} />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-outline" size={64} color={colors.gray300} />
              <Text style={s.emptyTitle}>{t('trip.noUpdates') ?? 'No updates yet'}</Text>
              <Text style={s.emptyText}>
                {t('trip.noUpdatesText') ?? 'Updates from your trip providers will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    unreadBadge: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
    unreadBadgeText: { color: c.white, fontSize: FontSize.xs, fontWeight: '700' },
    list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 10 },
    item: {
      flexDirection: 'row', gap: 12, backgroundColor: c.surface,
      borderRadius: Radius.xl, padding: 14, ...Shadow.sm,
      borderLeftWidth: 3, borderLeftColor: 'transparent',
    },
    itemUnread: { borderLeftColor: c.primary, backgroundColor: c.primarySurface },
    iconWrap: { position: 'relative', width: 36, alignItems: 'center', paddingTop: 2 },
    unreadDot: {
      position: 'absolute', top: 0, right: 0,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: c.primary, borderWidth: 2, borderColor: c.surface,
    },
    itemContent: { flex: 1, gap: 4 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    itemTitle: { fontSize: FontSize.md, fontWeight: '600', color: c.textSecondary, flex: 1 },
    itemTitleUnread: { fontWeight: '800', color: c.textPrimary },
    itemTime: { fontSize: FontSize.xs, color: c.textTertiary, flexShrink: 0 },
    itemBody: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 20 },
    targetedTag: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start', marginTop: 4,
      backgroundColor: c.primarySurface, paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: Radius.full,
    },
    targetedText: { fontSize: FontSize.xs, color: c.primary, fontWeight: '600' },
    skeletonItem: { flexDirection: 'row', gap: 12, backgroundColor: c.surface, borderRadius: Radius.xl, padding: 14, ...Shadow.sm },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    emptyText: { fontSize: FontSize.md, color: c.textTertiary, textAlign: 'center', paddingHorizontal: 32 },
  });
}
