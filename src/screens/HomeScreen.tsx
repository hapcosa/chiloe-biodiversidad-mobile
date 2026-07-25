import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {speciesApi} from '../api';
import {useAuth} from '../auth/AuthContext';
import {initializeDatabase} from '../db/connection';
import {listCachedSpecies, upsertSpecies} from '../db/speciesCache';
import {colors, reinoColors, reinoEmoji, reinoLabels, spacing} from '../styles/theme';
import type {Reino, Species} from '../types/domain';

interface HomeScreenProps {
  onSelectSpecies: (species: Species) => void;
}

const reinos: Reino[] = ['animalia', 'plantae', 'fungi', 'protista', 'monera'];

const frases = [
  'Chiloé guarda un archipiélago de vida que todavía estamos aprendiendo a nombrar.',
  'Cada encuentro que registras ayuda a construir el mapa vivo de la isla.',
  'La biodiversidad de los cinco reinos convive en un mismo paisaje: mira de cerca.',
];

export const HomeScreen = ({onSelectSpecies}: HomeScreenProps): React.JSX.Element => {
  const {user} = useAuth();
  const [species, setSpecies] = useState<Species[]>([]);
  const [selectedReino, setSelectedReino] = useState<Reino | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [frase] = useState(() => frases[Math.floor(Math.random() * frases.length)]);

  const load = useCallback(async (reino?: Reino) => {
    setIsLoading(true);
    await initializeDatabase();

    try {
      const response = await speciesApi.list({
        reino,
        limit: 12,
        offset: 0,
        orderby: 'nombre_comun',
        orderdir: 'asc',
      });
      await upsertSpecies(response.data);
      setSpecies(response.data);
    } catch {
      setSpecies(await listCachedSpecies({reino, limit: 12, offset: 0}));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selectedReino);
  }, [load, selectedReino]);

  const destacada = species[0];
  const primerNombre = user?.name?.split(' ')[0] || 'explorador';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🌲🦉🍄</Text>
        <Text style={styles.heroTitle}>Hola, {primerNombre}</Text>
        <Text style={styles.heroSubtitle}>Descubre la biodiversidad de Chiloé, reino por reino.</Text>
      </View>

      <Text style={styles.sectionTitle}>Los cinco reinos</Text>
      <View style={styles.reinoRow}>
        {reinos.map(reino => {
          const selected = reino === selectedReino;
          return (
            <Pressable
              accessibilityRole="button"
              key={reino}
              onPress={() => setSelectedReino(selected ? undefined : reino)}
              style={[
                styles.reinoChip,
                {borderColor: reinoColors[reino]},
                selected && {backgroundColor: reinoColors[reino]},
              ]}>
              <Text style={styles.reinoChipEmoji}>{reinoEmoji[reino]}</Text>
              <Text style={[styles.reinoChipText, selected && styles.reinoChipTextSelected]}>
                {reinoLabels[reino]}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
              <Text style={styles.featuredName}>
                {destacada.nombre_comun || destacada.nombre_cientifico}
              </Text>
              <Text style={styles.featuredScientific}>{destacada.nombre_cientifico}</Text>
            </View>
          </Pressable>

          {species.length > 1 ? (
            <>
              <Text style={styles.sectionTitle}>
                {selectedReino ? `Más de ${reinoLabels[selectedReino]}` : 'Explora más especies'}
              </Text>
              <FlatList
                contentContainerStyle={styles.miniListContent}
                data={species.slice(1)}
                horizontal
                keyExtractor={item => String(item.id)}
                renderItem={({item}) => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelectSpecies(item)}
                    style={styles.miniCard}>
                    {item.imagenes_urls?.[0] ? (
                      <Image
                        resizeMode="cover"
                        source={{uri: item.imagenes_urls[0]}}
                        style={styles.miniImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.miniImage,
                          styles.miniPlaceholder,
                          {backgroundColor: `${reinoColors[item.reino]}22`},
                        ]}>
                        <Text style={styles.miniPlaceholderEmoji}>{reinoEmoji[item.reino]}</Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={styles.miniName}>
                      {item.nombre_comun || item.nombre_cientifico}
                    </Text>
                  </Pressable>
                )}
                showsHorizontalScrollIndicator={false}
              />
            </>
          ) : null}
        </>
      ) : (
        <Text style={styles.emptyText}>No hay especies para mostrar todavía.</Text>
      )}

      <View style={styles.quoteCard}>
        <Text style={styles.quoteText}>{frase}</Text>
      </View>
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
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  heroEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 26,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#DCE8E1',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  reinoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reinoChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reinoChipEmoji: {
    fontSize: 16,
  },
  reinoChipText: {
    color: colors.text,
    fontWeight: '700',
  },
  reinoChipTextSelected: {
    color: colors.surface,
  },
  loader: {
    marginTop: spacing.xl,
  },
  featuredCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
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
  featuredName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  featuredScientific: {
    color: colors.primaryDark,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  miniListContent: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  miniCard: {
    width: 110,
  },
  miniImage: {
    borderRadius: 14,
    height: 110,
    marginBottom: spacing.xs,
    width: 110,
  },
  miniPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlaceholderEmoji: {
    fontSize: 36,
  },
  miniName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  quoteCard: {
    backgroundColor: `${colors.secondary}22`,
    borderRadius: 18,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  quoteText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    textAlign: 'center',
  },
});
