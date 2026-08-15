import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import {avistamientosApi} from '../api';
import {initializeDatabase} from '../db/connection';
import {getCachedSpecies} from '../db/speciesCache';
import {colors, reinoColors, reinoEmoji, reinoLabels, spacing} from '../styles/theme';
import type {RemoteAvistamiento} from '../types/avistamiento';
import type {Reino} from '../types/domain';
import type {GradoIdentificacion} from '../types/identificacion';
import {formatFechaCorta} from '../utils/fechas';

interface FeedScreenProps {
  onOpenAvistamiento: (avistamientoId: number) => void;
}

const PAGE_SIZE = 20;

const reinoOptions: Array<Reino | undefined> = [
  undefined,
  'animalia',
  'plantae',
  'fungi',
  'protista',
  'monera',
];

const gradoOptions: Array<GradoIdentificacion | undefined> = [
  undefined,
  'sin_identificar',
  'en_discusion',
  'investigacion',
];

const gradoLabels: Record<GradoIdentificacion, string> = {
  sin_identificar: 'Sin identificar',
  en_discusion: 'En discusión',
  investigacion: 'Grado investigación',
};

const gradoColors: Record<GradoIdentificacion, string> = {
  sin_identificar: colors.muted,
  en_discusion: colors.secondary,
  investigacion: colors.success,
};

const contarIdentificaciones = (total: number): string => {
  if (total === 0) {
    return 'Nadie lo ha identificado';
  }
  return total === 1 ? '1 identificación' : `${total} identificaciones`;
};

export const FeedScreen = ({onOpenAvistamiento}: FeedScreenProps): React.JSX.Element => {
  const [avistamientos, setAvistamientos] = useState<RemoteAvistamiento[]>([]);
  const [nombres, setNombres] = useState<Record<number, string>>({});
  const [selectedReino, setSelectedReino] = useState<Reino | undefined>();
  const [selectedGrado, setSelectedGrado] = useState<GradoIdentificacion | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Descarta respuestas de peticiones que ya quedaron obsoletas: cambiar de
  // filtro mientras carga la página anterior, si no, mezcla resultados.
  const requestRef = useRef(0);

  // Los nombres de especie salen del cache local: el feed devuelve `especie_id`
  // y pedir cada ficha por separado multiplicaría las llamadas por tarjeta.
  const resolverNombres = useCallback(async (items: RemoteAvistamiento[]): Promise<void> => {
    const ids = Array.from(
      new Set(
        items
          .map(item => item.especie_id)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    if (ids.length === 0) {
      return;
    }

    const resueltos = await Promise.all(
      ids.map(async id => [id, await getCachedSpecies(id)] as const),
    );

    setNombres(previos => {
      const siguiente = {...previos};
      for (const [id, species] of resueltos) {
        if (species) {
          siguiente[id] = species.nombre_comun || species.nombre_cientifico;
        }
      }
      return siguiente;
    });
  }, []);

  const cargarPagina = useCallback(
    async (offset: number): Promise<void> => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      if (offset === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        await initializeDatabase();
        const response = await avistamientosApi.list({
          reino: selectedReino,
          grado_identificacion: selectedGrado,
          limit: PAGE_SIZE,
          offset,
        });

        if (requestRef.current !== requestId) {
          return;
        }

        setTotal(response.pagination.total);
        setAvistamientos(previos =>
          offset === 0 ? response.data : [...previos, ...response.data],
        );
        void resolverNombres(response.data);
      } catch (loadError) {
        if (requestRef.current !== requestId) {
          return;
        }
        // Sin cache local a propósito: las URLs de las fotos caducan a los
        // ~15 minutos, así que un feed guardado se vería sin imágenes, que es
        // justo lo que se viene a mirar.
        setError(
          loadError instanceof Error
            ? `No se pudo cargar la comunidad: ${loadError.message}`
            : 'No se pudo cargar la comunidad',
        );
      } finally {
        if (requestRef.current === requestId) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [resolverNombres, selectedGrado, selectedReino],
  );

  useEffect(() => {
    void cargarPagina(0);
  }, [cargarPagina]);

  const cargarMas = (): void => {
    if (isLoading || isLoadingMore || avistamientos.length >= total) {
      return;
    }
    void cargarPagina(avistamientos.length);
  };

  const tituloDe = (item: RemoteAvistamiento): string => {
    const nombreCacheado = item.especie_id ? nombres[item.especie_id] : undefined;
    return nombreCacheado ?? (item.nombre_sugerido?.trim() || 'Encuentro sin nombre');
  };

  const renderAvistamiento: ListRenderItem<RemoteAvistamiento> = ({item}) => {
    const reinoColor = reinoColors[item.reino];

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpenAvistamiento(item.id)}
        style={({pressed}) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.media}>
          {item.foto_url ? (
            <Image resizeMode="cover" source={{uri: item.foto_url}} style={styles.image} />
          ) : (
            <View style={[styles.placeholder, {backgroundColor: `${reinoColor}22`}]}>
              <Text style={styles.placeholderEmoji}>{reinoEmoji[item.reino]}</Text>
            </View>
          )}
          <View style={[styles.reinoBadge, {backgroundColor: reinoColor}]}>
            <Text style={styles.reinoBadgeText}>
              {reinoEmoji[item.reino]} {reinoLabels[item.reino]}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text numberOfLines={1} style={styles.title}>
            {tituloDe(item)}
          </Text>
          {item.descripcion ? (
            <Text numberOfLines={2} style={styles.description}>
              {item.descripcion}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View
              style={[
                styles.gradoChip,
                {backgroundColor: `${gradoColors[item.grado_identificacion]}22`},
              ]}>
              <Text
                style={[styles.gradoText, {color: gradoColors[item.grado_identificacion]}]}>
                {gradoLabels[item.grado_identificacion]}
              </Text>
            </View>
            <Text style={styles.meta}>
              {contarIdentificaciones(item.identificaciones_count)}
            </Text>
          </View>

          <Text style={styles.meta}>{formatFechaCorta(item.observado_en)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Comunidad</Text>
        <Text style={styles.headerSubtitle}>
          Encuentros que otras personas compartieron. ¿Reconoces alguno? Ábrelo y propón
          una especie.
        </Text>
      </View>

      <View style={styles.filters}>
        {reinoOptions.map(reino => {
          const selected = reino === selectedReino;
          return (
            <Pressable
              accessibilityRole="button"
              key={reino ?? 'todos'}
              onPress={() => setSelectedReino(reino)}
              style={[
                styles.chip,
                selected && {
                  backgroundColor: reino ? reinoColors[reino] : colors.primary,
                  borderColor: reino ? reinoColors[reino] : colors.primary,
                },
              ]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {reino ? `${reinoEmoji[reino]} ${reinoLabels[reino]}` : 'Todos'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filters}>
        {gradoOptions.map(grado => {
          const selected = grado === selectedGrado;
          return (
            <Pressable
              accessibilityRole="button"
              key={grado ?? 'cualquiera'}
              onPress={() => setSelectedGrado(grado)}
              style={[
                styles.chip,
                selected && {backgroundColor: colors.primary, borderColor: colors.primary},
              ]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {grado ? gradoLabels[grado] : 'Cualquier grado'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void cargarPagina(0)}
            style={styles.retryButton}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading && avistamientos.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={avistamientos}
          keyExtractor={item => String(item.id)}
          ListEmptyComponent={
            error ? null : (
              <Text style={styles.emptyText}>
                Todavía no hay encuentros compartidos con estos filtros.
              </Text>
            )
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
            ) : null
          }
          onEndReached={cargarMas}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => void cargarPagina(0)}
              refreshing={isLoading}
            />
          }
          renderItem={renderAvistamiento}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  body: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  chip: {
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
  },
  chipTextSelected: {
    color: colors.surface,
    fontWeight: '600',
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  description: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: `${colors.danger}18`,
    borderRadius: 10,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  footerLoader: {
    marginVertical: spacing.md,
  },
  gradoChip: {
    borderRadius: 10,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  gradoText: {
    fontSize: 11,
    fontWeight: '600',
  },
  header: {
    marginBottom: spacing.md,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  loader: {
    marginTop: spacing.xl,
  },
  media: {
    backgroundColor: colors.background,
    height: 200,
    width: '100%',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  placeholder: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  placeholderEmoji: {
    fontSize: 48,
  },
  reinoBadge: {
    borderRadius: 12,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    position: 'absolute',
    top: spacing.sm,
  },
  reinoBadgeText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  retryText: {
    color: colors.danger,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
