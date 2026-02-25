import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useInfinitePublicTrips, useFavorites, useToggleFavorite, TripFilters } from '../../hooks/useTrips';
import TripCard from '../../components/trips/TripCard';
import FilterSheet from '../../components/trips/FilterSheet';
import { TripCardSkeleton } from '../../components/ui/SkeletonLoader';
import { FontSize, Shadow, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { Trip } from '../../types/trip';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TripFilters>({});
  const [filterVisible, setFilterVisible] = useState(false);

  const activeFilters = useMemo(
    () => ({ ...filters, search: search || undefined }),
    [filters, search]
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfinitePublicTrips(activeFilters);

  const { data: favorites } = useFavorites();
  const toggleFav = useToggleFavorite();

  const trips = useMemo(() => data?.pages.flat() ?? [], [data]);
  const favoriteIds = new Set(favorites?.map((t) => t.id) ?? []);
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined).length;

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderTrip = useCallback(({ item }: { item: Trip }) => (
    <TripCard
      trip={item}
      onPress={() => router.push(`/trip/${item.id}`)}
      isFavorite={favoriteIds.has(item.id)}
      onFavoriteToggle={() =>
        toggleFav.mutate({ tripId: item.id, isFav: favoriteIds.has(item.id) })
      }
    />
  ), [favoriteIds, toggleFav]);

  const ListFooter = isFetchingNextPage ? (
    <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.primary} />
  ) : null;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{t('explore.greeting', { name: user?.name?.split(' ')[0] ?? 'Traveler' })}</Text>
          <Text style={s.headerTitle}>{t('explore.subtitle')}</Text>
        </View>
        <TouchableOpacity style={s.avatarBtn} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={s.searchInput}
            placeholder={t('explore.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
          onPress={() => setFilterVisible(true)}
        >
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? colors.white : colors.textPrimary} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {!isLoading && trips.length > 0 && (
        <Text style={s.resultsText}>{t('explore.tripsFound', { count: trips.length })}</Text>
      )}

      {isLoading ? (
        <FlatList data={[1, 2, 3]} keyExtractor={(i) => String(i)}
          renderItem={() => <TripCardSkeleton />}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          renderItem={renderTrip}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={ListFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="search-outline" size={56} color={colors.gray300} />
              <Text style={s.emptyTitle}>{t('explore.noTripsTitle')}</Text>
              <Text style={s.emptyText}>{t('explore.noTripsText')}</Text>
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

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    greeting: { fontSize: FontSize.sm, color: c.textTertiary, fontWeight: '500' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: c.textPrimary, marginTop: 2 },
    avatarBtn: { padding: 4 },
    searchRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 10, alignItems: 'center' },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, gap: 8, ...Shadow.sm },
    searchInput: { flex: 1, fontSize: FontSize.md, color: c.textPrimary },
    filterBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
    filterBtnActive: { backgroundColor: c.primary },
    filterBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    filterBadgeText: { fontSize: 9, color: c.white, fontWeight: '700' },
    resultsText: { fontSize: FontSize.sm, color: c.textTertiary, paddingHorizontal: 20, paddingBottom: 4, fontWeight: '500' },
    list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    emptyText: { fontSize: FontSize.md, color: c.textTertiary },
  });
}
