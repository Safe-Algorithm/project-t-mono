import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyRegistrations } from '../../hooks/useTrips';
import { Colors, FontSize, Radius, Shadow } from '../../constants/Theme';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import Badge from '../../components/ui/Badge';
import { TripRegistration } from '../../types/trip';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' | 'primary' }> = {
  confirmed: { label: 'Confirmed', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  completed: { label: 'Completed', variant: 'neutral' },
  payment_pending: { label: 'Payment Pending', variant: 'warning' },
};

function BookingCard({ reg }: { reg: TripRegistration }) {
  const status = STATUS_BADGE[reg.status] ?? { label: reg.status, variant: 'neutral' as const };
  const tripName = reg.trip?.name_en ?? reg.trip?.name_ar ?? 'Trip';
  const startDate = reg.trip?.start_date
    ? new Date(reg.trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/trip/${reg.trip_id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tripName} numberOfLines={1}>{tripName}</Text>
          <Text style={styles.pkgName}>{reg.trip?.provider?.company_name ?? ''}</Text>
        </View>
        <Badge label={status.label} variant={status.variant} size="sm" />
      </View>

      <View style={styles.cardMeta}>
        {startDate && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
            <Text style={styles.metaText}>{startDate}</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={13} color={Colors.primary} />
          <Text style={styles.metaText}>{reg.total_participants} participant{reg.total_participants > 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="receipt-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.refText}>{reg.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.dateBooked}>
          Booked {new Date(reg.registration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function BookingsScreen() {
  const { data: registrations, isLoading } = useMyRegistrations();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
        {registrations && registrations.length > 0 && (
          <Text style={styles.count}>{registrations.length}</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={20} width="70%" />
              <Skeleton height={14} width="40%" />
              <Skeleton height={14} width="60%" />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={registrations ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <BookingCard reg={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={64} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>No trips booked yet</Text>
              <Text style={styles.emptyText}>
                Explore and book your first adventure!
              </Text>
            </View>
          }
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
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  count: {
    backgroundColor: Colors.primary,
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 10,
    ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tripName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  pkgName: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  refText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontFamily: 'monospace' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dateBooked: { fontSize: FontSize.xs, color: Colors.textTertiary },
  skeletonCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 10,
    ...Shadow.sm,
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.md, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: 32 },
});
