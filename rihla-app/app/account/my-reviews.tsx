import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontSize, Radius, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import StarRating from '../../components/ui/StarRating';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import { useMyReviews } from '../../hooks/useTrips';

export default function MyReviewsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { data: reviews, isLoading } = useMyReviews();

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('myReviews.title')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {isLoading ? (
        <View style={s.list}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={s.skeletonCard}>
              <Skeleton height={16} width="60%" />
              <Skeleton height={12} width="40%" />
              <Skeleton height={40} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={reviews ?? []} keyExtractor={(r) => r.id}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="star-outline" size={64} color={colors.gray300} />
              <Text style={s.emptyTitle}>{t('myReviews.noReviewsTitle')}</Text>
              <Text style={s.emptyText}>{t('myReviews.noReviewsText')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/trip/${item.trip_id}`)} activeOpacity={0.85}>
              <View style={s.cardHeader}>
                <StarRating rating={item.rating} size={15} />
                <Text style={s.date}>
                  {new Date(item.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              {item.comment && <Text style={s.comment} numberOfLines={3}>{item.comment}</Text>}
              <View style={s.tripRow}>
                <Ionicons name="map-outline" size={13} color={colors.primary} />
                <Text style={s.tripId}>{t('trip.aboutTrip')}</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.textPrimary },
    list: { padding: 16, gap: 12 },
    card: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, gap: 10, ...Shadow.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    date: { fontSize: FontSize.xs, color: c.textTertiary },
    comment: { fontSize: FontSize.md, color: c.textSecondary, lineHeight: 22 },
    tripRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    tripId: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600', flex: 1 },
    skeletonCard: { backgroundColor: c.surface, borderRadius: Radius.xl, padding: 16, gap: 10, ...Shadow.sm },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    emptyText: { fontSize: FontSize.md, color: c.textTertiary, textAlign: 'center', paddingHorizontal: 32 },
  });
}
