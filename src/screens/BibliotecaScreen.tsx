import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import {colors, reinoColors, reinoLabels, spacing} from '../styles/theme';
import type {Reino, Species} from '../types/domain';

interface BibliotecaScreenProps {
  onOpenProfile: () => void;
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
  onOpenProfile,
  onSelectSpecies,
}: BibliotecaScreenProps): React.JSX.Element => {
  const [species, setSpecies] = useState<Species[]>([]);
  const [query, setQuery] = useState('');
  const [selectedReino, setSelectedReino] = useState<Reino | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSpecies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await initializeDatabase();

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

  const renderSpecies: ListRenderItem<Species> = ({item}) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelectSpecies(item)}
      style={({pressed}) => [styles.speciesCard, pressed && styles.cardPressed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.commonName}>{item.nombre_comun || item.nombre_cientifico}</Text>
        <View style={[styles.reinoBadge, {backgroundColor: reinoColors[item.reino]}]}>
          <Text style={styles.reinoBadgeText}>{reinoLabels[item.reino]}</Text>
        </View>
      </View>
      <Text style={styles.scientificName}>{item.nombre_cientifico}</Text>
      <Text numberOfLines={2} style={styles.description}>
        {item.descripcion}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Biblioteca</Text>
          <Text style={styles.subtitle}>Catálogo multi-reino de Chiloé</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpenProfile} style={styles.profileButton}>
          <Text style={styles.profileButtonText}>Perfil</Text>
        </Pressable>
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
                {reino ? reinoLabels[reino] : 'Todos'}
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
          contentContainerStyle={styles.listContent}
          data={species}
          keyExtractor={item => String(item.id)}
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
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  profileButton: {
    borderColor: colors.primary,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  profileButtonText: {
    color: colors.primary,
    fontWeight: '700',
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
    marginBottom: spacing.md,
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
  listContent: {
    paddingBottom: spacing.xl,
  },
  speciesCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  commonName: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  scientificName: {
    color: colors.primaryDark,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  reinoBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  reinoBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    padding: spacing.xl,
    textAlign: 'center',
  },
});

