import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import {speciesApi} from '../api';
import {initializeDatabase} from '../db/connection';
import {listCachedSpecies, upsertSpecies} from '../db/speciesCache';
import {colors, reinoColors, reinoEmoji, spacing} from '../styles/theme';
import type {Reino, Species} from '../types/domain';

interface SeleccionEspecieScreenProps {
  onSelect: (species: Species) => void;
  onSinEspecie: (reino: Reino) => void;
  onBack: () => void;
}

// Quien no sabe la especie sí sabe qué clase de ser vio. El reino igual hace
// falta —el mapa filtra por él— así que se pregunta en lenguaje llano en vez
// del nombre del reino, que a esa altura no le dice nada a nadie.
const GRUPOS: Array<{reino: Reino; titulo: string; ayuda: string}> = [
  {reino: 'animalia', titulo: 'Un animal', ayuda: 'Ave, pez, insecto, mamífero…'},
  {reino: 'plantae', titulo: 'Una planta', ayuda: 'Árbol, arbusto, hierba, helecho…'},
  {reino: 'fungi', titulo: 'Un hongo', ayuda: 'Seta, líquen, moho'},
  {reino: 'protista', titulo: 'Un alga o similar', ayuda: 'Algas y otros protistas'},
  {reino: 'monera', titulo: 'Una bacteria', ayuda: 'Tapices y costras microbianas'},
];

const PAGE_SIZE = 30;

export const SeleccionEspecieScreen = ({
  onSelect,
  onSinEspecie,
  onBack,
}: SeleccionEspecieScreenProps): React.JSX.Element => {
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState<Species[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [eligiendoGrupo, setEligiendoGrupo] = useState(false);

  const buscar = useCallback(async () => {
    setIsLoading(true);
    setAviso(null);
    await initializeDatabase();
    try {
      const response = await speciesApi.list({
        q: query.trim() || undefined,
        limit: PAGE_SIZE,
        offset: 0,
        orderby: 'nombre_comun',
        orderdir: 'asc',
      });
      await upsertSpecies(response.data);
      setSpecies(response.data);
    } catch {
      // Identificar en terreno es justo donde no hay señal: el cache local
      // manda mientras tanto y el encuentro se guarda igual.
      const cached = await listCachedSpecies({
        q: query.trim() || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setSpecies(cached);
      setAviso(
        cached.length > 0
          ? 'Sin conexión: buscando solo en lo descargado.'
          : 'Sin conexión y sin especies descargadas. Puedes guardarlo sin especie.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void buscar();
    }, 250);
    return () => clearTimeout(timeout);
  }, [buscar]);

  const renderItem: ListRenderItem<Species> = ({item}) => (
    <Pressable accessibilityRole="button" onPress={() => onSelect(item)} style={styles.fila}>
      <Text style={[styles.filaEmoji, {color: reinoColors[item.reino]}]}>
        {reinoEmoji[item.reino]}
      </Text>
      <View style={styles.filaTexto}>
        <Text style={styles.filaTitulo}>{item.nombre_comun || item.nombre_cientifico}</Text>
        <Text style={styles.filaSubtitulo}>{item.nombre_cientifico}</Text>
      </View>
    </Pressable>
  );

  if (eligiendoGrupo) {
    return (
      <View style={styles.contenedor}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEligiendoGrupo(false)}
          style={styles.volver}>
          <Text style={styles.volverTexto}>← Volver a buscar</Text>
        </Pressable>
        <Text style={styles.titulo}>¿Qué viste?</Text>
        <Text style={styles.ayuda}>
          Guárdalo así y la comunidad puede ayudarte a identificarlo después.
        </Text>
        {GRUPOS.map(grupo => (
          <Pressable
            accessibilityRole="button"
            key={grupo.reino}
            onPress={() => onSinEspecie(grupo.reino)}
            style={styles.grupo}>
            <Text style={styles.grupoTitulo}>{grupo.titulo}</Text>
            <Text style={styles.grupoAyuda}>{grupo.ayuda}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.volver}>
        <Text style={styles.volverTexto}>← Volver a la foto</Text>
      </Pressable>

      <Text style={styles.titulo}>¿Qué especie es?</Text>
      <TextInput
        autoCorrect={false}
        onChangeText={setQuery}
        placeholder="Buscar por nombre común o científico"
        style={styles.buscador}
        value={query}
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => setEligiendoGrupo(true)}
        style={styles.noSe}>
        <Text style={styles.noSeTexto}>Todavía no sé cuál es</Text>
      </Pressable>

      {aviso !== null && <Text style={styles.aviso}>{aviso}</Text>}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.cargando} />
      ) : (
        <FlatList
          data={species}
          keyboardShouldPersistTaps="handled"
          keyExtractor={item => String(item.id)}
          ListEmptyComponent={
            <Text style={styles.vacio}>
              Nada con ese nombre. Puedes guardarlo sin especie y resolverlo después.
            </Text>
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  aviso: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  ayuda: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  buscador: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cargando: {
    marginTop: spacing.lg,
  },
  contenedor: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.lg,
  },
  fila: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  filaEmoji: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  filaSubtitulo: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  filaTexto: {
    flex: 1,
  },
  filaTitulo: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  grupo: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  grupoAyuda: {
    color: colors.muted,
    fontSize: 12,
  },
  grupoTitulo: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  noSe: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  noSeTexto: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  titulo: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  vacio: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  volver: {
    marginBottom: spacing.md,
  },
  volverTexto: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
