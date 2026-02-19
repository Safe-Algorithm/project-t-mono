import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePublicTrips, useFavorites, useToggleFavorite, TripFilters } from '../../hooks/useTrips';
import TripCard from '../../components/trips/TripCard';
import FilterSheet from '../../components/trips/FilterSheet';
import { TripCardSkeleton } from '../../components/ui/SkeletonLoader';
import { Colors, FontSize, Spacing, Shadow } from '../../constants/Theme';
import { useAuthStore } from '../../store/authStore';
import { Trip } from '../../types/trip';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TripFilters>({});
  const [filterVisible, setFilterVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeFilters = { ...filters, search: search || undefined };
  const { data: trips, isLoading, refetch } = usePublicTrips(activeFilters);
  const { data: favorites } = useFavorites();
  const toggleFav = useToggleFavorite();

  const favoriteIds = new Set(favorites?.map((t) => t.id) ?? []);
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderTrip = ({ item }: { item: Trip }) => (
    <TripCard
      trip={item}
      onPress={() => router.push(`/trip/${item.id}`)}
      isFavorite={favoriteIds.has(item.id)}
      onFavoriteToggle={() =>
        toggleFav.mutate({ tripId: item.id, isFav: favoriteIds.has(item.id) })
      }
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('explore.greeting', { name: user?.name?.split(' ')[0] ?? 'Traveler' })}</Text>
          <Text style={styles.headerTitle}>{t('explore.subtitle')}</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Ionicons name="person-circle-outline" size={36} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('explore.searchPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterVisible(true)}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? Colors.white : Colors.textPrimary}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Results count */}
      {!isLoading && trips && (
        <Text style={styles.resultsText}>
          {t('explore.tripsFound', { count: trips.length })}
        </Text>
      )}

      {/* Trip list */}
      {isLoading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <TripCardSkeleton />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={trips ?? []}
          keyExtractor={(t) => t.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={56} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>{t('explore.noTripsTitle')}</Text>
              <Text style={styles.emptyText}>{t('explore.noTripsText')}</Text>
            </View>
          }
        />
      )}

      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApply={setFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  greeting: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '500' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  avatarBtn: { padding: 4 },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, color: Colors.white, fontWeight: '700' },
  resultsText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    paddingHorizontal: 20,
    paddingBottom: 4,
    fontWeight: '500',
  },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.md, color: Colors.textTertiary },
});
