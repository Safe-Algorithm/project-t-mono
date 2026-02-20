import React from 'react';
import {
  View, Text, StyleSheet, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFavorites, useToggleFavorite } from '../../hooks/useTrips';
import TripCard from '../../components/trips/TripCard';
import { TripCardSkeleton } from '../../components/ui/SkeletonLoader';
import { FontSize, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import { Trip } from '../../types/trip';

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { data: favorites, isLoading } = useFavorites();
  const toggleFav = useToggleFavorite();

  const renderTrip = ({ item }: { item: Trip }) => (
    <TripCard
      trip={item}
      onPress={() => router.push(`/trip/${item.id}`)}
      isFavorite
      onFavoriteToggle={() => toggleFav.mutate({ tripId: item.id, isFav: true })}
    />
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('favorites.title')}</Text>
        {favorites && favorites.length > 0 && (
          <Text style={s.count}>{favorites.length}</Text>
        )}
      </View>
      {isLoading ? (
        <FlatList data={[1, 2, 3]} keyExtractor={(i) => String(i)}
          renderItem={() => <TripCardSkeleton />}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false} />
      ) : (
        <FlatList data={favorites ?? []} keyExtractor={(t) => t.id}
          renderItem={renderTrip} contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="heart-outline" size={64} color={colors.gray300} />
              <Text style={s.emptyTitle}>{t('favorites.noFavoritesTitle')}</Text>
              <Text style={s.emptyText}>{t('favorites.noFavoritesText')}</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: c.textPrimary },
    count: { backgroundColor: c.primary, color: c.white, fontSize: FontSize.sm, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, overflow: 'hidden' },
    list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: c.textPrimary },
    emptyText: { fontSize: FontSize.md, color: c.textTertiary, textAlign: 'center', paddingHorizontal: 32 },
  });
}
