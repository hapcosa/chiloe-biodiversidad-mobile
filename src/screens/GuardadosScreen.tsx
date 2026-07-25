import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, spacing} from '../styles/theme';

// Placeholder: la funcionalidad real de guardados (tabla SQLite propia,
// marcar/desmarcar desde la biblioteca) queda como tarea separada.
export const GuardadosScreen = (): React.JSX.Element => (
  <View style={styles.container}>
    <Text style={styles.emoji}>🔖</Text>
    <Text style={styles.title}>Guardados</Text>
    <Text style={styles.subtitle}>
      Pronto podrás guardar especies favoritas para encontrarlas más rápido.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
});
