import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors, reinoColors, reinoEmoji, reinoLabels, spacing} from '../styles/theme';
import type {Species} from '../types/domain';

interface EspecieDetailScreenProps {
  species: Species;
  onBack: () => void;
}

const Field = ({label, value}: {label: string; value?: string | number | null}): React.JSX.Element | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
};

export const EspecieDetailScreen = ({
  species,
  onBack,
}: EspecieDetailScreenProps): React.JSX.Element => (
  <ScrollView contentContainerStyle={styles.container}>
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
      <Text style={styles.backButtonText}>← Biblioteca</Text>
    </Pressable>

    {species.imagenes_urls?.[0] ? (
      <Image resizeMode="cover" source={{uri: species.imagenes_urls[0]}} style={styles.hero} />
    ) : (
      <View style={[styles.hero, styles.heroPlaceholder, {backgroundColor: `${reinoColors[species.reino]}22`}]}>
        <Text style={styles.heroPlaceholderEmoji}>{reinoEmoji[species.reino]}</Text>
      </View>
    )}

    <View style={styles.headerCard}>
      <View style={[styles.reinoBadge, {backgroundColor: reinoColors[species.reino]}]}>
        <Text style={styles.reinoBadgeText}>
          {reinoEmoji[species.reino]} {reinoLabels[species.reino]}
        </Text>
      </View>
      <Text style={styles.commonName}>{species.nombre_comun || species.nombre_cientifico}</Text>
      <Text style={styles.scientificName}>{species.nombre_cientifico}</Text>
      <Field label="Autor científico" value={species.autor_cientifico} />
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Descripción</Text>
      <Text style={styles.paragraph}>{species.descripcion}</Text>
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Hábitat y distribución</Text>
      <Field label="Hábitat" value={species.habitat} />
      <Field label="Distribución en Chiloé" value={species.distribucion_chiloe} />
      <Field label="Estado de conservación" value={species.estado_conservacion} />
      <Field label="Endémica" value={species.endemica ? 'Sí' : 'No'} />
      <Field
        label="Coordenadas"
        value={
          species.geo_lat !== null && species.geo_lat !== undefined
            ? `${species.geo_lat}, ${species.geo_lng ?? ''}`
            : undefined
        }
      />
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
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
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  reinoBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  reinoBadgeText: {
    color: colors.surface,
    fontWeight: '800',
  },
  commonName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  scientificName: {
    color: colors.primaryDark,
    fontSize: 18,
    fontStyle: 'italic',
    marginTop: spacing.xs,
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
  field: {
    marginTop: spacing.md,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    marginTop: spacing.xs,
  },
});

