import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProviderProfile, usePublicTrips } from '../../hooks/useTrips';
import { Colors, FontSize, Radius, Shadow } from '../../constants/Theme';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import StarRating from '../../components/ui/StarRating';
import TripCard from '../../components/trips/TripCard';

export default function ProviderProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: provider, isLoading } = useProviderProfile(id);
  const { data: trips } = usePublicTrips({ limit: 10 });
  const providerTrips = trips?.filter((t) => t.provider_id === id) ?? [];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={styles.skeletonProfile}>
            <Skeleton width={80} height={80} borderRadius={40} />
            <Skeleton height={24} width="60%" />
            <Skeleton height={16} width="40%" />
          </View>
          <Skeleton height={100} />
          <Skeleton height={180} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!provider) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color={Colors.gray300} />
          <Text style={styles.errorText}>Provider not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const bio = provider.bio_en ?? provider.bio_ar;

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Provider Profile</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          {provider.company_avatar_url ? (
            <Image source={{ uri: provider.company_avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>
                {provider.company_name?.[0]?.toUpperCase() ?? 'P'}
              </Text>
            </View>
          )}

          <Text style={styles.companyName}>{provider.company_name}</Text>

          {provider.average_rating > 0 && (
            <View style={styles.ratingRow}>
              <StarRating rating={provider.average_rating} size={16} />
              <Text style={styles.ratingText}>
                {provider.average_rating.toFixed(1)} ({provider.total_reviews} reviews)
              </Text>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatItem icon="map-outline" value={String(provider.total_trips)} label="Total Trips" />
            <View style={styles.statDivider} />
            <StatItem icon="compass-outline" value={String(provider.active_trips)} label="Active" />
            <View style={styles.statDivider} />
            <StatItem icon="star-outline" value={provider.average_rating > 0 ? provider.average_rating.toFixed(1) : '—'} label="Rating" />
          </View>
        </View>

        <View style={styles.content}>
          {/* Contact info */}
          {(provider.company_email || provider.company_phone) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact</Text>
              <View style={styles.contactCard}>
                {provider.company_email && (
                  <View style={styles.contactRow}>
                    <Ionicons name="mail-outline" size={16} color={Colors.primary} />
                    <Text style={styles.contactText}>{provider.company_email}</Text>
                  </View>
                )}
                {provider.company_phone && (
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={16} color={Colors.primary} />
                    <Text style={styles.contactText}>{provider.company_phone}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Bio */}
          {bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bio}>{bio}</Text>
            </View>
          )}

          {/* Trips */}
          {providerTrips.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Trips</Text>
              {providerTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onPress={() => router.push(`/trip/${trip.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function StatItem({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  backLink: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },

  profileCard: {
    backgroundColor: Colors.white,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.primaryLight,
  },
  avatarInitials: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  companyName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: Radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 8,
    width: '100%',
    marginTop: 4,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },

  content: { padding: 20, gap: 0 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },

  contactCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 12,
    ...Shadow.sm,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { fontSize: FontSize.md, color: Colors.textPrimary },

  bio: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },

  skeletonProfile: { alignItems: 'center', gap: 12, paddingVertical: 20 },
});
