import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {BIENVENIDA} from '../content/avisos';
import {colors, spacing} from '../styles/theme';

interface BienvenidaScreenProps {
  onContinue: () => void;
}

export const BienvenidaScreen = ({onContinue}: BienvenidaScreenProps): React.JSX.Element => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.eyebrow}>ANTES DE EMPEZAR</Text>
    <Text style={styles.title}>{BIENVENIDA.titulo}</Text>
    <View style={styles.card}>
      {BIENVENIDA.parrafos.map(parrafo => (
        <Text key={parrafo} style={styles.parrafo}>
          {parrafo}
        </Text>
      ))}
    </View>
    <Pressable accessibilityRole="button" onPress={onContinue} style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{BIENVENIDA.boton}</Text>
    </Pressable>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 26,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  parrafo: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '800',
  },
});
