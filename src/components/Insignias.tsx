import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, spacing} from '../styles/theme';
import type {Insignia, InsigniaOtorgada} from '../types/insignia';
import {insigniaEmoji} from '../utils/insignias';

interface InsigniasRowProps {
  insignias: InsigniaOtorgada[];
}

// Fila compacta de insignias ganadas, para poner junto a un nombre.
export const InsigniasRow = ({insignias}: InsigniasRowProps): React.JSX.Element | null => {
  if (insignias.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {insignias.map(insignia => (
        <View key={insignia.codigo} style={styles.chip}>
          <Text style={styles.chipEmoji}>{insigniaEmoji(insignia.codigo)}</Text>
          <Text style={styles.chipText}>{insignia.nombre}</Text>
        </View>
      ))}
    </View>
  );
};

interface InsigniasListaProps {
  ganadas: InsigniaOtorgada[];
  pendientes: Insignia[];
}

// Vista del perfil propio: lo ganado y lo que falta, cada una con su criterio.
// No hay comparación con nadie más, a propósito (Fase 9.0: sin ranking).
export const InsigniasLista = ({
  ganadas,
  pendientes,
}: InsigniasListaProps): React.JSX.Element => (
  <View>
    {ganadas.length === 0 ? (
      <Text style={styles.vacio}>
        Todavía no tienes insignias. Se otorgan solas cuando tus encuentros se
        aprueban.
      </Text>
    ) : (
      ganadas.map(insignia => (
        <View key={insignia.codigo} style={styles.item}>
          <Text style={styles.itemEmoji}>{insigniaEmoji(insignia.codigo)}</Text>
          <View style={styles.itemTexto}>
            <Text style={styles.itemNombre}>{insignia.nombre}</Text>
            <Text style={styles.itemDetalle}>
              {insignia.motivo ?? insignia.descripcion}
            </Text>
          </View>
        </View>
      ))
    )}

    {pendientes.length > 0 ? (
      <>
        <Text style={styles.subtitulo}>Por ganar</Text>
        {pendientes.map(insignia => (
          <View key={insignia.codigo} style={[styles.item, styles.itemApagado]}>
            <Text style={[styles.itemEmoji, styles.emojiApagado]}>
              {insigniaEmoji(insignia.codigo)}
            </Text>
            <View style={styles.itemTexto}>
              <Text style={styles.itemNombreApagado}>{insignia.nombre}</Text>
              <Text style={styles.itemDetalle}>{insignia.criterio}</Text>
            </View>
          </View>
        ))}
      </>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    flexDirection: 'row',
    marginRight: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipEmoji: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  chipText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  itemApagado: {
    opacity: 0.55,
  },
  itemEmoji: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  emojiApagado: {
    opacity: 0.6,
  },
  itemTexto: {
    flex: 1,
  },
  itemNombre: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  itemNombreApagado: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  itemDetalle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  subtitulo: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  vacio: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
