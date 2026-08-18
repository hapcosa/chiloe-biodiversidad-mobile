import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AVISO_FAUNA_FICHA} from '../content/avisos';
import {colors, spacing} from '../styles/theme';

/** Aviso permanente en la ficha de una especie de `animalia`. */
export const AvisoFauna = (): React.JSX.Element => (
  <View accessibilityRole="alert" style={styles.card}>
    <Text style={styles.titulo}>{AVISO_FAUNA_FICHA.titulo}</Text>
    {AVISO_FAUNA_FICHA.puntos.map(punto => (
      <Text key={punto} style={styles.punto}>
        · {punto}
      </Text>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: `${colors.secondary}1A`,
    borderLeftColor: colors.secondary,
    borderLeftWidth: 4,
    borderRadius: 14,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  titulo: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  punto: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
});
