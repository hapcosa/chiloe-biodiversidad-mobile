import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {portadaApi, speciesApi} from '../api';
import {initializeDatabase} from '../db/connection';
import {getCachedPortada, saveCachedPortada} from '../db/portadaCache';
import {getCachedSpecies, getLibraryStats, type LibraryStats} from '../db/speciesCache';
import {colors, reinoColors, reinoEmoji, reinoLabels, spacing} from '../styles/theme';
import type {Reino, Species} from '../types/domain';
import type {Portada, PortadaEncuentro, PortadaEspecie} from '../types/portada';
import {portadaVacia} from '../types/portada';

interface HomeScreenProps {
  onSelectSpecies: (species: Species) => void;
}

const reinos: Reino[] = ['animalia', 'plantae', 'fungi', 'protista', 'monera'];

// "hace 3 días" dice más que una fecha ISO en una portada que existe para
// mostrar movimiento. Por encima de un mes ya da igual el detalle.
const desde = (iso: string | null): string => {
  if (!iso) {
    return '';
  }
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  const dias = Math.floor((Date.now() - fecha.getTime()) / 86_400_000);
  if (dias <= 0) {
    return 'hoy';
  }
  if (dias === 1) {
    return 'ayer';
  }
  if (dias < 30) {
    return `hace ${dias} días`;
  }
  return fecha.toLocaleDateString('es-CL');
};

interface TarjetaEspecieProps {
  especie: PortadaEspecie;
  etiqueta: string;
  onPress: () => void;
}

const TarjetaEspecie = ({especie, etiqueta, onPress}: TarjetaEspecieProps): React.JSX.Element => (
  <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
    {especie.foto_url ? (
      <Image resizeMode="cover" source={{uri: especie.foto_url}} style={styles.cardImage} />
    ) : (
      <View
        style={[
          styles.cardImage,
          styles.cardPlaceholder,
          {backgroundColor: `${reinoColors[especie.reino]}22`},
        ]}>
        <Text style={styles.cardPlaceholderEmoji}>{reinoEmoji[especie.reino]}</Text>
      </View>
    )}
    <View style={styles.cardInfo}>
      <Text style={styles.cardEyebrow} numberOfLines={1}>
        {reinoLabels[especie.reino]}
      </Text>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {especie.nombre_comun || especie.nombre_cientifico}
      </Text>
      <Text style={styles.cardScientific} numberOfLines={1}>
        {especie.nombre_cientifico}
      </Text>
      <Text style={styles.cardMeta}>
        {etiqueta} {desde(especie.fecha)}
      </Text>
    </View>
  </Pressable>
);

interface TarjetaEncuentroProps {
  encuentro: PortadaEncuentro;
  onPress?: () => void;
}

const TarjetaEncuentro = ({encuentro, onPress}: TarjetaEncuentroProps): React.JSX.Element => (
  <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    disabled={!onPress}
    onPress={onPress}
    style={styles.card}>
    {encuentro.foto_url ? (
      <Image resizeMode="cover" source={{uri: encuentro.foto_url}} style={styles.cardImage} />
    ) : (
      <View
        style={[
          styles.cardImage,
          styles.cardPlaceholder,
          {backgroundColor: `${reinoColors[encuentro.reino]}22`},
        ]}>
        <Text style={styles.cardPlaceholderEmoji}>{reinoEmoji[encuentro.reino]}</Text>
      </View>
    )}
    <View style={styles.cardInfo}>
      <Text style={styles.cardEyebrow} numberOfLines={1}>
        {reinoLabels[encuentro.reino]}
      </Text>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {encuentro.nombre_sugerido ||
          (encuentro.especie_id ? 'Especie identificada' : 'Todavía sin identificar')}
      </Text>
      <Text style={styles.cardMeta}>Compartido {desde(encuentro.created_at)}</Text>
    </View>
  </Pressable>
);

interface CarruselProps {
  titulo: string;
  vacio: string;
  children: React.ReactNode;
  hayContenido: boolean;
}

const Carrusel = ({titulo, vacio, children, hayContenido}: CarruselProps): React.JSX.Element => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{titulo}</Text>
    {hayContenido ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
        {children}
      </ScrollView>
    ) : (
      <Text style={styles.emptyText}>{vacio}</Text>
    )}
  </View>
);

export const HomeScreen = ({onSelectSpecies}: HomeScreenProps): React.JSX.Element => {
  const [portada, setPortada] = useState<Portada>(portadaVacia());
  const [selectedReino, setSelectedReino] = useState<Reino | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [sinRed, setSinRed] = useState(false);
  const [stats, setStats] = useState<LibraryStats>({total: 0, endemicas: 0});

  const load = useCallback(async () => {
    setIsLoading(true);
    await initializeDatabase();
    setStats(await getLibraryStats());

    try {
      const fresca = await portadaApi.obtener();
      await saveCachedPortada(fresca);
      setPortada(fresca);
      setSinRed(false);
    } catch {
      // Las `foto_url` guardadas son firmadas y caducan: puede verse el texto
      // sin la imagen. Ver el comentario de portadaCache.
      setPortada((await getCachedPortada()) ?? portadaVacia());
      setSinRed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // El filtro por reino se aplica en el cliente: el endpoint devuelve pocos
  // elementos por bloque y pedirlo de nuevo por reino gastaría un viaje para
  // recortar una lista que ya está en memoria.
  const filtrada = useMemo<Portada>(() => {
    if (!selectedReino) {
      return portada;
    }
    return {
      ultimas_publicadas: portada.ultimas_publicadas.filter(e => e.reino === selectedReino),
      ultimas_ediciones: portada.ultimas_ediciones.filter(e => e.reino === selectedReino),
      ultimos_encuentros: portada.ultimos_encuentros.filter(e => e.reino === selectedReino),
    };
  }, [portada, selectedReino]);

  // La portada trae un recorte, no la ficha entera. Para abrir el detalle hay
  // que resolverla: primero la caché local, y si no está, la API.
  const abrirEspecie = useCallback(
    async (id: number) => {
      const local = await getCachedSpecies(id);
      if (local) {
        onSelectSpecies(local);
        return;
      }
      try {
        onSelectSpecies(await speciesApi.getById(id));
      } catch {
        // Sin red y sin caché no hay ficha que abrir; quedarse en la portada
        // es mejor que un detalle a medias.
      }
    },
    [onSelectSpecies],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🧭 Bitácora natural</Text>
        </View>
        <Text style={styles.eyebrow}>ARCHIPIÉLAGO DE CHILOÉ</Text>
        <Text style={styles.heroTitle}>Los cinco reinos de la vida chilota</Text>
        <Text style={styles.heroSubtitle}>
          Una biblioteca ilustrada de la biodiversidad del archipiélago. Recorre bosques de
          niebla, costas y turberas descubriendo las especies que habitan esta isla del sur del
          mundo.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ESPECIES</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>REINOS</Text>
            <Text style={styles.statValue}>5</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ENDÉMICAS</Text>
            <Text style={styles.statValue}>{stats.endemicas}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Explora por reino</Text>
      <View style={styles.reinoRow}>
        {reinos.map(reino => {
          const selected = reino === selectedReino;
          return (
            <Pressable
              accessibilityRole="button"
              key={reino}
              onPress={() => setSelectedReino(selected ? undefined : reino)}
              style={[
                styles.reinoCircle,
                {borderColor: reinoColors[reino]},
                selected && {backgroundColor: reinoColors[reino]},
              ]}>
              <Text style={styles.reinoCircleEmoji}>{reinoEmoji[reino]}</Text>
            </Pressable>
          );
        })}
      </View>
      {selectedReino ? (
        <Text style={styles.reinoSelectedLabel}>{reinoLabels[selectedReino]}</Text>
      ) : null}

      {sinRed ? (
        <Text style={styles.aviso}>Sin conexión: esto es lo último que se descargó.</Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <Carrusel
            hayContenido={filtrada.ultimas_publicadas.length > 0}
            titulo="Recién publicadas"
            vacio="Todavía no hay fichas nuevas.">
            {filtrada.ultimas_publicadas.map(especie => (
              <TarjetaEspecie
                especie={especie}
                etiqueta="Publicada"
                key={`pub-${especie.id}`}
                onPress={() => void abrirEspecie(especie.id)}
              />
            ))}
          </Carrusel>

          <Carrusel
            hayContenido={filtrada.ultimas_ediciones.length > 0}
            titulo="Fichas actualizadas"
            vacio="Todavía no hay ediciones recientes.">
            {filtrada.ultimas_ediciones.map(especie => (
              <TarjetaEspecie
                especie={especie}
                etiqueta="Editada"
                key={`edit-${especie.id}`}
                onPress={() => void abrirEspecie(especie.id)}
              />
            ))}
          </Carrusel>

          <Carrusel
            hayContenido={filtrada.ultimos_encuentros.length > 0}
            titulo="Últimos encuentros de la comunidad"
            vacio="Todavía nadie ha compartido un encuentro.">
            {filtrada.ultimos_encuentros.map(encuentro => (
              <TarjetaEncuentro
                encuentro={encuentro}
                key={`enc-${encuentro.id}`}
                onPress={
                  encuentro.especie_id
                    ? () => void abrirEspecie(encuentro.especie_id!)
                    : undefined
                }
              />
            ))}
          </Carrusel>
        </>
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
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: 22,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSubtitle: {
    color: '#DCE8E1',
    lineHeight: 21,
    marginTop: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  statItem: {},
  statLabel: {
    color: '#9CC2AE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  carousel: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  reinoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  reinoCircle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  reinoCircleEmoji: {
    fontSize: 22,
  },
  reinoSelectedLabel: {
    color: colors.muted,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  aviso: {
    color: colors.muted,
    marginTop: spacing.md,
  },
  loader: {
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    width: 220,
  },
  cardImage: {
    height: 130,
    width: '100%',
  },
  cardPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlaceholderEmoji: {
    fontSize: 44,
  },
  cardInfo: {
    padding: spacing.md,
  },
  cardEyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  cardScientific: {
    color: colors.primaryDark,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    paddingVertical: spacing.md,
  },
});
