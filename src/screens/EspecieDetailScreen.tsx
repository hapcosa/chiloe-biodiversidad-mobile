import React, {useEffect, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {listSavedSpeciesIds, saveSpecies, unsaveSpecies} from '../db/savedSpecies';
import {colors, conservacionColors, reinoColors, reinoEmoji, spacing} from '../styles/theme';
import type {Species} from '../types/domain';

interface EspecieDetailScreenProps {
  species: Species;
  onBack: () => void;
  onAddEncuentro: () => void;
}

const catalogNumber = (id: number): string => `N° ${String(id).padStart(3, '0')}`;

export const EspecieDetailScreen = ({
  species,
  onBack,
  onAddEncuentro,
}: EspecieDetailScreenProps): React.JSX.Element => {
  const [isSaved, setIsSaved] = useState(false);
  const conservacionColor = conservacionColors[species.estado_conservacion] ?? colors.muted;

  useEffect(() => {
    let cancelled = false;
    void listSavedSpeciesIds().then(ids => {
      if (!cancelled) {
        setIsSaved(ids.has(species.id));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [species.id]);

  const toggleSaved = async (): Promise<void> => {
    if (isSaved) {
      await unsaveSpecies(species.id);
    } else {
      await saveSpecies(species.id);
    }
    setIsSaved(!isSaved);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>
        <View style={styles.catalogTag}>
          <Text style={styles.catalogTagText}>{catalogNumber(species.id)}</Text>
        </View>
      </View>

      {species.imagenes_urls?.[0] ? (
        <Image resizeMode="cover" source={{uri: species.imagenes_urls[0]}} style={styles.hero} />
      ) : (
        <View
          style={[
            styles.hero,
            styles.heroPlaceholder,
            {backgroundColor: `${reinoColors[species.reino]}22`},
          ]}>
          <Text style={styles.heroPlaceholderEmoji}>{reinoEmoji[species.reino]}</Text>
        </View>
      )}

      <View style={styles.titleRow}>
        <Text style={styles.commonName}>{species.nombre_comun || species.nombre_cientifico}</Text>
        <Pressable accessibilityRole="button" onPress={toggleSaved} style={styles.saveButton}>
          <Text style={[styles.saveButtonText, !isSaved && styles.saveButtonInactive]}>🔖</Text>
        </Pressable>
      </View>
      <Text style={styles.scientificName}>{species.nombre_cientifico}</Text>

      <View style={styles.badgeRow}>
        {species.estado_conservacion ? (
          <View style={[styles.conservacionPill, {backgroundColor: `${conservacionColor}22`}]}>
            <View style={[styles.conservacionDot, {backgroundColor: conservacionColor}]} />
            <Text style={[styles.conservacionText, {color: conservacionColor}]}>
              {species.estado_conservacion}
            </Text>
          </View>
        ) : null}
        {species.endemica ? (
          <View style={styles.endemicPill}>
            <Text style={styles.endemicPillText}>★ Endémica</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.factsRow}>
        {species.habitat ? (
          <View style={styles.factCard}>
            <Text style={styles.factIcon}>📍</Text>
            <Text style={styles.factLabel}>HÁBITAT</Text>
            <Text style={styles.factValue}>{species.habitat}</Text>
          </View>
        ) : null}
        {species.distribucion_chiloe ? (
          <View style={styles.factCard}>
            <Text style={styles.factIcon}>🗺️</Text>
            <Text style={styles.factLabel}>DISTRIBUCIÓN</Text>
            <Text style={styles.factValue}>{species.distribucion_chiloe}</Text>
          </View>
        ) : null}
      </View>

      <Pressable accessibilityRole="button" onPress={onAddEncuentro} style={styles.encuentroButton}>
        <Text style={styles.encuentroButtonText}>+ Marcar como visto / agregar mi encuentro</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sobre la especie</Text>
        <Text style={styles.paragraph}>{species.descripcion}</Text>
      </View>

      {species.imagenes_urls?.length > 1 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Más fotos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {species.imagenes_urls.slice(1).map(url => (
              <Image key={url} resizeMode="cover" source={{uri: url}} style={styles.thumb} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backButton: {},
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  catalogTag: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  catalogTagText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  hero: {
    borderRadius: 18,
    height: 220,
    marginBottom: spacing.md,
    width: '100%',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderEmoji: {
    fontSize: 72,
  },
  thumb: {
    borderRadius: 12,
    height: 96,
    marginRight: spacing.sm,
    width: 96,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  commonName: {
    color: colors.text,
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
  },
  saveButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  saveButtonText: {
    fontSize: 24,
  },
  saveButtonInactive: {
    opacity: 0.3,
  },
  scientificName: {
    color: colors.primaryDark,
    fontSize: 17,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  conservacionPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  conservacionDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  conservacionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  endemicPill: {
    backgroundColor: `${colors.secondary}22`,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  endemicPillText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  factsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  factCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md,
  },
  factIcon: {
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  factValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  encuentroButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  encuentroButtonText: {
    color: colors.surface,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  paragraph: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
  },
});
