import React, {useCallback, useEffect, useState} from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import {initializeDatabase} from '../db/connection';
import {listSavedSpeciesIds, unsaveSpecies} from '../db/savedSpecies';
import {getCachedSpecies} from '../db/speciesCache';
import {colors, reinoColors, reinoEmoji, reinoLabels, spacing} from '../styles/theme';
import type {Species} from '../types/domain';

interface GuardadosScreenProps {
  onSelectSpecies: (species: Species) => void;
}

export const GuardadosScreen = ({onSelectSpecies}: GuardadosScreenProps): React.JSX.Element => {
  const [saved, setSaved] = useState<Species[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    await initializeDatabase();
    const ids = await listSavedSpeciesIds();
    const species = await Promise.all(Array.from(ids).map(id => getCachedSpecies(id)));
    setSaved(species.filter((item): item is Species => item !== null));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unsave = async (id: number): Promise<void> => {
    await unsaveSpecies(id);
    setSaved(previous => previous.filter(item => item.id !== id));
  };

  const renderItem: ListRenderItem<Species> = ({item}) => {
    const cover = item.imagenes_urls?.[0];
    const reinoColor = reinoColors[item.reino];

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onSelectSpecies(item)}
        style={styles.card}>
        {cover ? (
          <Image resizeMode="cover" source={{uri: cover}} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardPlaceholder, {backgroundColor: `${reinoColor}22`}]}>
            <Text style={styles.cardPlaceholderEmoji}>{reinoEmoji[item.reino]}</Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={[styles.reinoLabel, {color: reinoColor}]}>{reinoLabels[item.reino]}</Text>
          <Text style={styles.commonName}>{item.nombre_comun || item.nombre_cientifico}</Text>
          <Text style={styles.scientificName}>{item.nombre_cientifico}</Text>
          {item.habitat ? (
            <Text numberOfLines={1} style={styles.location}>
              📍 {item.habitat}
            </Text>
          ) : null}
        </View>

        <Pressable accessibilityRole="button" onPress={() => unsave(item.id)} style={styles.bookmarkButton}>
          <Text style={styles.bookmarkIcon}>🔖</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TU CUADERNO</Text>
      <Text style={styles.title}>Guardados</Text>
      <Text style={styles.subtitle}>Tus hallazgos favoritos, listos para volver a mirar.</Text>

      {!isLoading ? (
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>
            🔖 {saved.length} {saved.length === 1 ? 'especie guardada' : 'especies guardadas'}
          </Text>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={saved}
        keyExtractor={item => String(item.id)}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔖</Text>
              <Text style={styles.emptyText}>
                Aún no guardas especies. Desde el detalle de cualquiera, toca el ícono de
                marcador para agregarla aquí.
              </Text>
            </View>
          ) : null
        }
        renderItem={renderItem}
      />
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
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  countPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  countPillText: {
    color: colors.text,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  cardImage: {
    borderRadius: 12,
    height: 76,
    width: 76,
  },
  cardPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlaceholderEmoji: {
    fontSize: 32,
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  reinoLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  commonName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  scientificName: {
    color: colors.primaryDark,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  location: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  bookmarkButton: {
    padding: spacing.sm,
  },
  bookmarkIcon: {
    fontSize: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.muted,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
});
