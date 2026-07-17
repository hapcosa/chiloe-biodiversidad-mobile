import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors, reinoColors, reinoLabels, spacing} from '../styles/theme';
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

    <View style={styles.headerCard}>
      <View style={[styles.reinoBadge, {backgroundColor: reinoColors[species.reino]}]}>
        <Text style={styles.reinoBadgeText}>{reinoLabels[species.reino]}</Text>
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

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Fotos</Text>
      <Field label="Portada" value={species.foto_portada_key} />
      <Field label="Total de fotos" value={species.fotos_keys.length} />
    </View>
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

