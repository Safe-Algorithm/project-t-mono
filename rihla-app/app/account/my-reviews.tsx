import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import { Colors, FontSize, Radius, Shadow } from '../../constants/Theme';
import StarRating from '../../components/ui/StarRating';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import { Review } from '../../types/trip';

function useMyReviews() {
  return useQuery({
    queryKey: ['reviews', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<Review[]>('/reviews/my-reviews');
      return data;
    },
  });
}

export default function MyReviewsScreen() {
  const { t, i18n } = useTranslation();
  const { data: reviews, isLoading } = useMyReviews();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myReviews.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={16} width="60%" />
              <Skeleton height={12} width="40%" />
              <Skeleton height={40} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={reviews ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={64} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>{t('myReviews.noReviewsTitle')}</Text>
              <Text style={styles.emptyText}>{t('myReviews.noReviewsText')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/trip/${item.trip_id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <StarRating rating={item.rating} size={15} />
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
              </View>
              {item.comment && (
                <Text style={styles.comment} numberOfLines={3}>{item.comment}</Text>
              )}
              <View style={styles.tripRow}>
                <Ionicons name="map-outline" size={13} color={Colors.primary} />
                <Text style={styles.tripId}>{t('trip.aboutTrip')}</Text>
                <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 10,
    ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: FontSize.xs, color: Colors.textTertiary },
  comment: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tripId: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', flex: 1 },
  skeletonCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: 16, gap: 10, ...Shadow.sm,
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.md, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: 32 },
});
