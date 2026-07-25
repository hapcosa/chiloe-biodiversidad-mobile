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
import {
  colors,
  conservacionColors,
  reinoColors,
  reinoEmoji,
  reinoLabels,
  spacing,
} from '../styles/theme';
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
    const conservacionColor = conservacionColors[item.estado_conservacion] ?? colors.muted;

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => openSpecies(item)}
        style={({pressed}) => [styles.card, pressed && styles.cardPressed]}>
        <View style={[styles.cardMedia, {borderColor: reinoColor}]}>
          {cover ? (
            <Image resizeMode="cover" source={{uri: cover}} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardPlaceholder, {backgroundColor: `${reinoColor}22`}]}>
              <Text style={styles.cardPlaceholderEmoji}>{reinoEmoji[item.reino]}</Text>
            </View>
          )}
          <View style={[styles.reinoDot, {backgroundColor: reinoColor}]} />
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

        <Text numberOfLines={1} style={styles.commonName}>
          {item.nombre_comun || item.nombre_cientifico}
        </Text>
        <Text numberOfLines={1} style={styles.scientificName}>
          {item.nombre_cientifico}
        </Text>

        <View style={styles.cardFooter}>
          <View style={[styles.conservacionDot, {backgroundColor: conservacionColor}]} />
          <Text style={styles.conservacionText}>{item.estado_conservacion || '—'}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Biblioteca</Text>
          <Text style={styles.subtitle}>Catálogo multi-reino de la biodiversidad</Text>
        </View>
      </View>

      <TextInput
        autoCapitalize="none"
        onChangeText={setQuery}
        placeholder="Buscar por nombre común o científico"
        style={styles.searchInput}
        value={query}
      />

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
      {species.length > 0 ? (
        <Text style={styles.collectionText}>
          {viewedIds.size} de {species.length} vistas en esta lista
        </Text>
      ) : null}

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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
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
  collectionText: {
    color: colors.muted,
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
    borderWidth: 3,
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
  reinoDot: {
    borderRadius: 999,
    height: 14,
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
    width: 14,
  },
  viewedBadge: {
    backgroundColor: colors.success,
    borderRadius: 999,
    bottom: spacing.xs,
    height: 22,
    justifyContent: 'center',
    left: spacing.xs,
    position: 'absolute',
    width: 22,
    alignItems: 'center',
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
  commonName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  scientificName: {
    color: colors.primaryDark,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  conservacionDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  conservacionText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    padding: spacing.xl,
    textAlign: 'center',
  },
});