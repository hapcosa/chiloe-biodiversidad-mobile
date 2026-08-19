import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, spacing} from '../styles/theme';

interface RevisionCapturaScreenProps {
  fotoPath: string;
  onCrearEncuentro: () => void;
  onRepetir: () => void;
  onDescartar: () => void;
}

// La foto recién sacada, a pantalla completa y con las tres salidas posibles.
// Antes esta pantalla no existía y la captura moría en la caché local.
export const RevisionCapturaScreen = ({
  fotoPath,
  onCrearEncuentro,
  onRepetir,
  onDescartar,
}: RevisionCapturaScreenProps): React.JSX.Element => (
  <View style={styles.contenedor}>
    <Image resizeMode="contain" source={{uri: `file://${fotoPath}`}} style={styles.foto} />

    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        onPress={onCrearEncuentro}
        style={styles.botonPrincipal}>
        <Text style={styles.botonPrincipalTexto}>Crear encuentro</Text>
      </Pressable>

      <View style={styles.fila}>
        <Pressable accessibilityRole="button" onPress={onRepetir} style={styles.botonSecundario}>
          <Text style={styles.botonSecundarioTexto}>Repetir</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDescartar} style={styles.botonSecundario}>
          <Text style={styles.botonSecundarioTexto}>Descartar</Text>
        </Pressable>
      </View>

      <Text style={styles.ayuda}>
        Sin crear el encuentro, la foto queda solo en tu teléfono.
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  ayuda: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  botonPrincipal: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.md,
  },
  botonPrincipalTexto: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  botonSecundario: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.md,
  },
  botonSecundarioTexto: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  contenedor: {
    backgroundColor: colors.background,
    flex: 1,
  },
  fila: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  foto: {
    backgroundColor: '#000',
    flex: 1,
  },
  panel: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
});
