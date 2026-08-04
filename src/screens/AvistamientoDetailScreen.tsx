import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {identificacionesApi, avistamientosApi} from '../api';
import {useAuth} from '../auth/AuthContext';
import {
  enqueueIdentificacion,
  listPendingIdentificaciones,
  type IdentificacionMutation,
} from '../db/mutationQueue';
import {getCachedSpecies, listCachedSpecies} from '../db/speciesCache';
import {colors, reinoLabels, spacing} from '../styles/theme';
import {syncPendingMutations} from '../sync/mutationSync';
import type {RemoteAvistamiento} from '../types/avistamiento';
import type {Species} from '../types/domain';
import type {GradoIdentificacion, Identificacion} from '../types/identificacion';
import {formatFechaCorta} from '../utils/fechas';

interface AvistamientoDetailScreenProps {
  avistamientoId: number;
  onBack: () => void;
}

const gradoLabels: Record<GradoIdentificacion, string> = {
  sin_identificar: 'Sin identificar',
  en_discusion: 'En discusión',
  investigacion: 'Grado investigación',
};

const gradoDescripciones: Record<GradoIdentificacion, string> = {
  sin_identificar: 'Nadie ha propuesto una especie todavía.',
  en_discusion: 'Hay propuestas, pero aún no coinciden lo suficiente.',
  investigacion: 'La comunidad (o un curador) llegó a un acuerdo.',
};

const gradoColors: Record<GradoIdentificacion, string> = {
  sin_identificar: colors.muted,
  en_discusion: colors.secondary,
  investigacion: colors.success,
};

const syncLabels: Record<IdentificacionMutation['status'], string> = {
  pending: 'Pendiente de enviar',
  syncing: 'Enviando...',
  failed: 'Sin conexión, se reintentará',
  rejected: 'El servidor la rechazó',
  synced: 'Enviada',
};

export const AvistamientoDetailScreen = ({
  avistamientoId,
  onBack,
}: AvistamientoDetailScreenProps): React.JSX.Element => {
  const {user} = useAuth();
  const [avistamiento, setAvistamiento] = useState<RemoteAvistamiento | null>(null);
  const [identificaciones, setIdentificaciones] = useState<Identificacion[]>([]);
  const [pendientes, setPendientes] = useState<IdentificacionMutation[]>([]);
  const [nombres, setNombres] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [query, setQuery] = useState('');
  const [candidatas, setCandidatas] = useState<Species[]>([]);
  const [elegida, setElegida] = useState<Species | null>(null);
  const [comentario, setComentario] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retirandoId, setRetirandoId] = useState<number | null>(null);

  const resolverNombres = useCallback(async (ids: number[]): Promise<void> => {
    const unicos = Array.from(new Set(ids));
    const resueltos = await Promise.all(
      unicos.map(async id => [id, await getCachedSpecies(id)] as const),
    );

    setNombres(previos => {
      const siguiente = {...previos};
      for (const [id, species] of resueltos) {
        // Si la especie no está en el cache local, el id crudo es mejor que
        // una etiqueta vacía: identifica la fila aunque no sea legible.
        siguiente[id] =
          species?.nombre_comun || species?.nombre_cientifico || `Especie #${id}`;
      }
      return siguiente;
    });
  }, []);

  const cargar = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const [detalle, lista, enCola] = await Promise.all([
        avistamientosApi.getById(avistamientoId),
        identificacionesApi.list(avistamientoId),
        listPendingIdentificaciones(avistamientoId),
      ]);

      setAvistamiento(detalle);
      setIdentificaciones(lista);
      setPendientes(enCola);
      await resolverNombres([
        ...lista.map(item => item.especie_id),
        ...enCola.map(item => item.payload.especie_id),
        ...(detalle.especie_id ? [detalle.especie_id] : []),
      ]);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'No se pudo cargar el avistamiento',
      );
    } finally {
      setIsLoading(false);
    }
  }, [avistamientoId, resolverNombres]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!isSuggesting) {
      return;
    }
    // El buscador va contra el cache SQLite, no contra la red: sugerir tiene
    // que funcionar en terreno sin señal.
    void listCachedSpecies({q: query, limit: 20}).then(setCandidatas);
  }, [isSuggesting, query]);

  const sugerir = async (): Promise<void> => {
    if (!elegida) {
      return;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      await enqueueIdentificacion({
        avistamiento_id: avistamientoId,
        especie_id: elegida.id,
        comentario: comentario.trim() || null,
      });
      // Esperamos el intento de envío para que `cargar()` vea la identificación
      // ya sincronizada. Sin red devuelve 0 sin lanzar y la sugerencia se queda
      // en la cola, que es justo lo que la tarjeta pendiente refleja.
      await syncPendingMutations();

      setIsSuggesting(false);
      setElegida(null);
      setComentario('');
      setQuery('');
      await cargar();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'No se pudo guardar la sugerencia',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const retirar = async (identificacion: Identificacion): Promise<void> => {
    setRetirandoId(identificacion.id);
    setActionError(null);
    try {
      await identificacionesApi.retirar(avistamientoId, identificacion.id);
      await cargar();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'No se pudo retirar la identificación',
      );
    } finally {
      setRetirandoId(null);
    }
  };

  const vigentes = useMemo(
    () => identificaciones.filter(item => !item.retirada),
    [identificaciones],
  );
  const retiradas = useMemo(
    () => identificaciones.filter(item => item.retirada),
    [identificaciones],
  );
  const yaIdentifique = useMemo(
    () => vigentes.some(item => item.usuario_id === user?.id),
    [vigentes, user?.id],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const grado = avistamiento?.grado_identificacion ?? 'sin_identificar';

  const renderIdentificacion = (item: Identificacion): React.JSX.Element => (
    <View key={item.id} style={[styles.card, item.retirada && styles.cardRetirada]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{nombres[item.especie_id] ?? '...'}</Text>
        {item.decisiva ? <Text style={styles.badgeCurador}>curador</Text> : null}
      </View>
      {item.comentario ? <Text style={styles.cardBody}>{item.comentario}</Text> : null}
      <Text style={styles.cardMeta}>
        {item.usuario_id === user?.id ? 'Tú' : `Usuario #${item.usuario_id}`}
        {formatFechaCorta(item.created_at) ? ` · ${formatFechaCorta(item.created_at)}` : ''}
        {item.retirada ? ' · retirada' : ''}
      </Text>
      {!item.retirada && item.usuario_id === user?.id ? (
        <Pressable
          accessibilityRole="button"
          disabled={retirandoId === item.id}
          onPress={() => retirar(item)}
          style={styles.linkButton}>
          <Text style={styles.linkDanger}>
            {retirandoId === item.id ? 'Retirando...' : 'Retirar mi identificación'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Volver</Text>
      </Pressable>

      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      <Text style={styles.eyebrow}>AVISTAMIENTO #{avistamientoId}</Text>
      <Text style={styles.title}>
        {avistamiento?.especie_id
          ? nombres[avistamiento.especie_id] ?? 'Especie propuesta'
          : avistamiento?.nombre_sugerido || 'Sin especie asignada'}
      </Text>
      {avistamiento ? (
        <Text style={styles.subtitle}>
          {reinoLabels[avistamiento.reino]}
          {formatFechaCorta(avistamiento.observado_en)
            ? ` · ${formatFechaCorta(avistamiento.observado_en)}`
            : ''}
        </Text>
      ) : null}

      <View style={[styles.gradoCard, {borderColor: gradoColors[grado]}]}>
        <Text style={[styles.gradoLabel, {color: gradoColors[grado]}]}>
          {gradoLabels[grado]}
        </Text>
        <Text style={styles.gradoCaption}>{gradoDescripciones[grado]}</Text>
      </View>

      {avistamiento?.descripcion ? (
        <Text style={styles.descripcion}>{avistamiento.descripcion}</Text>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Identificaciones</Text>
        <Text style={styles.sectionSubtitle}>
          Se necesitan al menos dos coincidiendo (2/3 del total) para llegar a grado
          investigación. Un curador de la categoría decide por sí solo.
        </Text>
      </View>

      {pendientes.map(pendiente => (
        <View key={pendiente.id} style={[styles.card, styles.cardPendiente]}>
          <Text style={styles.cardTitle}>
            {nombres[pendiente.payload.especie_id] ?? '...'}
          </Text>
          {pendiente.payload.comentario ? (
            <Text style={styles.cardBody}>{pendiente.payload.comentario}</Text>
          ) : null}
          <Text style={styles.cardMeta}>Tú · {syncLabels[pendiente.status]}</Text>
          {pendiente.last_error ? (
            <Text style={styles.errorText}>{pendiente.last_error}</Text>
          ) : null}
        </View>
      ))}

      {vigentes.length === 0 && pendientes.length === 0 ? (
        <Text style={styles.emptyText}>Nadie ha sugerido una especie todavía.</Text>
      ) : (
        vigentes.map(renderIdentificacion)
      )}

      {retiradas.length > 0 ? (
        <>
          <Text style={styles.retiradasHeader}>Retiradas</Text>
          {retiradas.map(renderIdentificacion)}
        </>
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      {isSuggesting ? (
        <View style={styles.sugerirPanel}>
          <Text style={styles.label}>Especie</Text>
          {elegida ? (
            <View style={styles.elegidaRow}>
              <Text style={styles.elegidaNombre}>
                {elegida.nombre_comun || elegida.nombre_cientifico}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setElegida(null)}>
                <Text style={styles.linkButtonText}>Cambiar</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Buscar en tu biblioteca"
                style={styles.input}
                value={query}
              />
              {candidatas.length === 0 ? (
                <Text style={styles.emptyText}>
                  Ninguna especie del cache coincide. Sincroniza la biblioteca desde tu
                  perfil.
                </Text>
              ) : (
                candidatas.map(species => (
                  <Pressable
                    accessibilityRole="button"
                    key={species.id}
                    onPress={() => setElegida(species)}
                    style={styles.candidataRow}>
                    <Text style={styles.candidataNombre}>
                      {species.nombre_comun || species.nombre_cientifico}
                    </Text>
                    <Text style={styles.candidataMeta}>{species.nombre_cientifico}</Text>
                  </Pressable>
                ))
              )}
            </>
          )}

          {elegida ? (
            <>
              <Text style={styles.label}>Por qué (opcional)</Text>
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={setComentario}
                placeholder="Ej: por la nervadura de la hoja"
                style={[styles.input, styles.inputMultiline]}
                value={comentario}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={sugerir}
                style={[styles.primaryButton, isSaving && styles.disabled]}>
                {isSaving ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.primaryButtonText}>Enviar sugerencia</Text>
                )}
              </Pressable>
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setIsSuggesting(false);
              setElegida(null);
            }}
            style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={yaIdentifique}
          onPress={() => setIsSuggesting(true)}
          style={[styles.primaryButton, yaIdentifique && styles.disabled]}>
          <Text style={styles.primaryButtonText}>
            {yaIdentifique ? 'Ya sugeriste una especie' : 'Sugerir especie'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
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
  subtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  gradoCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 2,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  gradoLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  gradoCaption: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  descripcion: {
    color: colors.text,
    marginTop: spacing.md,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardPendiente: {
    borderColor: colors.secondary,
    borderStyle: 'dashed',
  },
  cardRetirada: {
    opacity: 0.6,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  badgeCurador: {
    backgroundColor: `${colors.success}22`,
    borderRadius: 999,
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cardBody: {
    color: colors.text,
    marginTop: spacing.xs,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  retiradasHeader: {
    color: colors.muted,
    fontWeight: '800',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyText: {
    color: colors.muted,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.xs,
  },
  sugerirPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  input: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: spacing.md,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  candidataRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  candidataNombre: {
    color: colors.text,
    fontWeight: '700',
  },
  candidataMeta: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  elegidaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  elegidaNombre: {
    color: colors.text,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 48,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '800',
  },
  linkButton: {
    marginTop: spacing.sm,
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: '700',
  },
  linkDanger: {
    color: colors.danger,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
});
