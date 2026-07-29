import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import {speciesApi} from '../api';
import {initializeDatabase} from '../db/connection';
import {listCachedSpecies, upsertSpecies} from '../db/speciesCache';
import {listViewedSpeciesIds, markSpeciesViewed} from '../db/speciesViewed';
import {colors, reinoColors, reinoEmoji, reinoLabels, spacing} from '../styles/theme';
import type {Reino, Species} from '../types/domain';

interface BibliotecaScreenProps {
  onSelectSpecies: (species: Species) => void;
}

const reinoOptions: Array<Reino | undefined> = [
  undefined,
  'animalia',
  'plantae',
  'fungi',
  'protista',
  'monera',
];

const catalogNumber = (id: number): string => `N° ${String(id).padStart(3, '0')}`;

export const BibliotecaScreen = ({
  onSelectSpecies,
}: BibliotecaScreenProps): React.JSX.Element => {
  const [species, setSpecies] = useState<Species[]>([]);
  const [query, setQuery] = useState('');
  const [selectedReino, setSelectedReino] = useState<Reino | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<number>>(new Set());

  const loadSpecies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await initializeDatabase();
    setViewedIds(await listViewedSpeciesIds());

    try {
      const response = await speciesApi.list({
        reino: selectedReino,
        q: query.trim() || undefined,
        limit: 50,
        offset: 0,
        orderby: 'nombre_comun',
        orderdir: 'asc',
      });
      await upsertSpecies(response.data);
      setSpecies(response.data);
      setIsOfflineData(false);
    } catch (loadError) {
      const cached = await listCachedSpecies({
        reino: selectedReino,
        q: query.trim() || undefined,
        limit: 50,
        offset: 0,
      });
      setSpecies(cached);
      setIsOfflineData(true);
      setError(
        cached.length > 0
          ? 'Sin conexión al backend. Mostrando cache local.'
          : loadError instanceof Error
            ? loadError.message
            : 'No se pudo cargar la biblioteca',
      );
    } finally {
      setIsLoading(false);
    }
  }, [query, selectedReino]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadSpecies();
    }, 250);

    return () => clearTimeout(timeout);
  }, [loadSpecies]);

  const openSpecies = (item: Species): void => {
    setViewedIds(previous => new Set(previous).add(item.id));
    void markSpeciesViewed(item.id);
    onSelectSpecies(item);
  };

  const renderSpecies: ListRenderItem<Species> = ({item}) => {
    const cover = item.imagenes_urls?.[0];
    const isViewed = viewedIds.has(item.id);
    const reinoColor = reinoColors[item.reino];

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => openSpecies(item)}
        style={({pressed}) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.cardMedia}>
          {cover ? (
            <Image resizeMode="cover" source={{uri: cover}} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardPlaceholder, {backgroundColor: `${reinoColor}22`}]}>
              <Text style={styles.cardPlaceholderEmoji}>{reinoEmoji[item.reino]}</Text>
            </View>
          )}
          <View style={styles.catalogTag}>
            <Text style={styles.catalogTagText}>{catalogNumber(item.id)}</Text>
          </View>
          <View style={[styles.reinoBadge, {backgroundColor: reinoColor}]}>
            <Text style={styles.reinoBadgeEmoji}>{reinoEmoji[item.reino]}</Text>
          </View>
          {isViewed ? (
            <View style={styles.viewedBadge}>
              <Text style={styles.viewedBadgeText}>✓</Text>
            </View>
          ) : null}
          {item.endemica ? (
            <View style={styles.endemicBadge}>
              <Text style={styles.endemicBadgeText}>★ Endémica</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.reinoLabel, {color: reinoColor}]}>{reinoLabels[item.reino]}</Text>
        <Text numberOfLines={1} style={styles.commonName}>
          {item.nombre_comun || item.nombre_cientifico}
        </Text>
        <Text numberOfLines={1} style={styles.scientificName}>
          {item.nombre_cientifico}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="Buscar especie, nombre científico o local..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          value={query}
        />
      </View>

      <View style={styles.filters}>
        {reinoOptions.map(reino => {
          const selected = reino === selectedReino;
          return (
            <Pressable
              accessibilityRole="button"
              key={reino ?? 'all'}
              onPress={() => setSelectedReino(reino)}
              style={[
                styles.filterChip,
                selected && {
                  backgroundColor: reino ? reinoColors[reino] : colors.primary,
                  borderColor: reino ? reinoColors[reino] : colors.primary,
                },
              ]}>
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                {reino ? `${reinoEmoji[reino]} ${reinoLabels[reino]}` : 'Todos'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.statusText}>{error}</Text> : null}
      {isOfflineData ? <Text style={styles.offlineText}>Modo offline</Text> : null}

      {isLoading && species.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          data={species}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={loadSpecies}
              refreshing={isLoading}
            />
          }
          renderItem={renderSpecies}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay especies para los filtros actuales.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    paddingVertical: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterChip: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterText: {
    color: colors.text,
    fontWeight: '600',
  },
  filterTextSelected: {
    color: colors.surface,
  },
  statusText: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  offlineText: {
    color: colors.secondary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  loader: {
    marginTop: spacing.xl,
  },
  row: {
    gap: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    marginBottom: spacing.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardMedia: {
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardImage: {
    height: '100%',
    width: '100%',
  },
  cardPlaceholder: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  cardPlaceholderEmoji: {
    fontSize: 44,
  },
  catalogTag: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    left: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    position: 'absolute',
    top: spacing.xs,
  },
  catalogTagText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  reinoBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
    width: 26,
  },
  reinoBadgeEmoji: {
    fontSize: 13,
  },
  viewedBadge: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 999,
    bottom: spacing.xs,
    height: 22,
    justifyContent: 'center',
    left: spacing.xs,
    position: 'absolute',
    width: 22,
  },
  viewedBadgeText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '800',
  },
  endemicBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 999,
    bottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    position: 'absolute',
    right: spacing.xs,
  },
  endemicBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '800',
  },
  reinoLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  commonName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  scientificName: {
    color: colors.primaryDark,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyText: {
    color: colors.muted,
    padding: spacing.xl,
    textAlign: 'center',
  },
});
