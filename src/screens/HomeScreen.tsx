import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {speciesApi} from '../api';
import {initializeDatabase} from '../db/connection';
import {getLibraryStats, listCachedSpecies, upsertSpecies, type LibraryStats} from '../db/speciesCache';
import {colors, reinoColors, reinoEmoji, reinoLabels, spacing} from '../styles/theme';
import type {Reino, Species} from '../types/domain';

interface HomeScreenProps {
  onSelectSpecies: (species: Species) => void;
}

const reinos: Reino[] = ['animalia', 'plantae', 'fungi', 'protista', 'monera'];

export const HomeScreen = ({onSelectSpecies}: HomeScreenProps): React.JSX.Element => {
  const [species, setSpecies] = useState<Species[]>([]);
  const [selectedReino, setSelectedReino] = useState<Reino | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<LibraryStats>({total: 0, endemicas: 0});

  const load = useCallback(async (reino?: Reino) => {
    setIsLoading(true);
    await initializeDatabase();
    setStats(await getLibraryStats());

    try {
      const response = await speciesApi.list({
        reino,
        limit: 1,
        offset: 0,
        orderby: 'nombre_comun',
        orderdir: 'asc',
      });
      await upsertSpecies(response.data);
      setSpecies(response.data);
    } catch {
      setSpecies(await listCachedSpecies({reino, limit: 1, offset: 0}));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selectedReino);
  }, [load, selectedReino]);

  const destacada = species[0];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🧭 Bitácora natural</Text>
        </View>
        <Text style={styles.eyebrow}>ARCHIPIÉLAGO DE CHILOÉ</Text>
        <Text style={styles.heroTitle}>Los cinco reinos de la vida chilota</Text>
        <Text style={styles.heroSubtitle}>
          Una biblioteca ilustrada de la biodiversidad del archipiélago. Recorre bosques de
          niebla, costas y turberas descubriendo las especies que habitan esta isla del sur del
          mundo.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ESPECIES</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>REINOS</Text>
            <Text style={styles.statValue}>5</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ENDÉMICAS</Text>
            <Text style={styles.statValue}>{stats.endemicas}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Explora por reino</Text>
      <View style={styles.reinoRow}>
        {reinos.map(reino => {
          const selected = reino === selectedReino;
          return (
            <Pressable
              accessibilityRole="button"
              key={reino}
              onPress={() => setSelectedReino(selected ? undefined : reino)}
              style={[
                styles.reinoCircle,
                {borderColor: reinoColors[reino]},
                selected && {backgroundColor: reinoColors[reino]},
              ]}>
              <Text style={styles.reinoCircleEmoji}>{reinoEmoji[reino]}</Text>
            </Pressable>
          );
        })}
      </View>
      {selectedReino ? (
        <Text style={styles.reinoSelectedLabel}>{reinoLabels[selectedReino]}</Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : destacada ? (
        <>
          <Text style={styles.sectionTitle}>Especie destacada</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelectSpecies(destacada)}
            style={styles.featuredCard}>
            {destacada.imagenes_urls?.[0] ? (
              <Image
                resizeMode="cover"
                source={{uri: destacada.imagenes_urls[0]}}
                style={styles.featuredImage}
              />
            ) : (
              <View
                style={[
                  styles.featuredImage,
                  styles.featuredPlaceholder,
                  {backgroundColor: `${reinoColors[destacada.reino]}22`},
                ]}>
                <Text style={styles.featuredPlaceholderEmoji}>{reinoEmoji[destacada.reino]}</Text>
              </View>
            )}
            <View style={styles.featuredInfo}>
              <Text style={styles.featuredReino}>{reinoLabels[destacada.reino]}</Text>
              <Text style={styles.featuredName}>
                {destacada.nombre_comun || destacada.nombre_cientifico}
              </Text>
              <Text style={styles.featuredScientific}>{destacada.nombre_cientifico}</Text>
            </View>
          </Pressable>
        </>
      ) : (
        <Text style={styles.emptyText}>No hay especies para mostrar todavía.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: 22,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSubtitle: {
    color: '#DCE8E1',
    lineHeight: 21,
    marginTop: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  statItem: {},
  statLabel: {
    color: '#9CC2AE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  reinoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  reinoCircle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  reinoCircleEmoji: {
    fontSize: 22,
  },
  reinoSelectedLabel: {
    color: colors.muted,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  loader: {
    marginTop: spacing.xl,
  },
  featuredCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  featuredImage: {
    height: 160,
    width: '100%',
  },
  featuredPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredPlaceholderEmoji: {
    fontSize: 56,
  },
  featuredInfo: {
    padding: spacing.lg,
  },
  featuredReino: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  featuredName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  featuredScientific: {
    color: colors.primaryDark,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    marginTop: spacing.sm,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
});
