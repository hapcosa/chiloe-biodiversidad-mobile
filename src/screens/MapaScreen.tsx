import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {Circle, MapType, Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {mapaApi} from '../api';
import {getCachedSpecies} from '../db/speciesCache';
import {listLocalAvistamientos} from '../db/mutationQueue';
import {colors, reinoColors, reinoLabels, spacing} from '../styles/theme';
import type {LocalAvistamiento} from '../types/avistamiento';
import type {Reino} from '../types/domain';
import type {AreaProtegida, CeldaMapa} from '../types/mapa';
import {
  esPuntoCaliente,
  radioCeldaMetros,
  regionToBbox,
  regionToZoom,
  regionesEquivalentes,
  REGION_CHILOE,
  type RegionLike,
} from '../utils/mapa';

const REINOS: Reino[] = ['animalia', 'plantae', 'fungi', 'protista', 'monera'];

// Las áreas protegidas no cambian mientras uno mueve el mapa, así que se piden
// una vez y no en cada arrastre.
const useAreasProtegidas = (activa: boolean) => {
  const [areas, setAreas] = useState<AreaProtegida[]>([]);
  const [cargadas, setCargadas] = useState(false);

  useEffect(() => {
    if (!activa || cargadas) {
      return;
    }
    let vivo = true;
    void mapaApi
      .areasProtegidas()
      .then(resultado => {
        if (vivo) {
          setAreas(resultado);
          setCargadas(true);
        }
      })
      .catch(() => {
        // Sin áreas el mapa sigue sirviendo; no vale tapar la pantalla por esto.
      });
    return () => {
      vivo = false;
    };
  }, [activa, cargadas]);

  return areas;
};

interface CapaToggleProps {
  activa: boolean;
  etiqueta: string;
  onPress: () => void;
}

const CapaToggle = ({activa, etiqueta, onPress}: CapaToggleProps): React.JSX.Element => (
  <Pressable
    accessibilityRole="switch"
    accessibilityState={{checked: activa}}
    onPress={onPress}
    style={[styles.chip, activa && styles.chipActivo]}>
    <Text style={[styles.chipTexto, activa && styles.chipTextoActivo]}>{etiqueta}</Text>
  </Pressable>
);

export const MapaScreen = (): React.JSX.Element => {
  const [region, setRegion] = useState<RegionLike>(REGION_CHILOE);
  const [celdas, setCeldas] = useState<CeldaMapa[]>([]);
  const [mios, setMios] = useState<LocalAvistamiento[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [verComunidad, setVerComunidad] = useState(true);
  const [verMios, setVerMios] = useState(true);
  const [verAreas, setVerAreas] = useState(true);
  const [reino, setReino] = useState<Reino | null>(null);
  const [especieId, setEspecieId] = useState<number | null>(null);
  const [nombreEspecie, setNombreEspecie] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<CeldaMapa | null>(null);

  const areas = useAreasProtegidas(verAreas);
  const ultimaRegion = useRef<RegionLike | null>(null);

  useEffect(() => {
    void listLocalAvistamientos().then(setMios);
  }, []);

  const cargarCeldas = useCallback(
    async (nueva: RegionLike) => {
      setCargando(true);
      setError(null);
      try {
        const resultado = await mapaApi.celdas({
          bbox: regionToBbox(nueva),
          zoom: regionToZoom(nueva),
          reino: reino ?? undefined,
          especie_id: especieId ?? undefined,
        });
        setCeldas(resultado);
      } catch {
        setError('No se pudieron cargar los encuentros de la comunidad.');
      } finally {
        setCargando(false);
      }
    },
    [especieId, reino],
  );

  // Al cambiar un filtro hay que recargar aunque el mapa no se haya movido.
  useEffect(() => {
    ultimaRegion.current = null;
    if (verComunidad) {
      void cargarCeldas(region);
    }
    // `region` queda fuera a propósito: moverse lo maneja onRegionChangeComplete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargarCeldas, verComunidad]);

  const onRegionChangeComplete = useCallback(
    (nueva: RegionLike) => {
      setRegion(nueva);
      if (!verComunidad) {
        return;
      }
      const anterior = ultimaRegion.current;
      if (anterior && regionesEquivalentes(anterior, nueva)) {
        return;
      }
      ultimaRegion.current = nueva;
      void cargarCeldas(nueva);
    },
    [cargarCeldas, verComunidad],
  );

  const limpiarEspecie = useCallback(() => {
    setEspecieId(null);
    setNombreEspecie(null);
  }, []);

  // Filtrar por especie desde el mapa: se toca un punto caliente y el mapa
  // pasa a mostrar solo esa especie.
  const filtrarPorCelda = useCallback(async (celda: CeldaMapa) => {
    setSeleccion(celda);
    if (celda.especie_dominante_id === null) {
      return;
    }
    const especie = await getCachedSpecies(celda.especie_dominante_id);
    setEspecieId(celda.especie_dominante_id);
    setNombreEspecie(especie?.nombre_comun ?? `Especie #${celda.especie_dominante_id}`);
  }, []);

  const miosVisibles = useMemo(
    () => (reino ? mios.filter(encuentro => encuentro.reino === reino) : mios),
    [mios, reino],
  );

  return (
    <View style={styles.contenedor}>
      <MapView
        initialRegion={REGION_CHILOE}
        mapType={mapType}
        onRegionChangeComplete={onRegionChangeComplete}
        provider={PROVIDER_GOOGLE}
        style={styles.mapa}>
        {verComunidad &&
          celdas.map(celda => {
            const caliente = esPuntoCaliente(celda);
            const color = caliente ? colors.secondary : colors.primary;
            return (
              <React.Fragment key={`${celda.lat}:${celda.lng}:${celda.grados}`}>
                <Circle
                  center={{latitude: celda.lat, longitude: celda.lng}}
                  fillColor={`${color}55`}
                  radius={radioCeldaMetros(celda)}
                  strokeColor={color}
                  strokeWidth={caliente ? 2 : 1}
                />
                <Marker
                  coordinate={{latitude: celda.lat, longitude: celda.lng}}
                  onPress={() => {
                    void filtrarPorCelda(celda);
                  }}
                  title={
                    caliente
                      ? `Punto caliente: ${celda.total} registros`
                      : `${celda.total} encuentros`
                  }
                  description={
                    celda.sensible
                      ? 'Especie amenazada: la ubicación se muestra aproximada.'
                      : `${celda.especies_distintas} especie(s) en esta zona`
                  }
                />
              </React.Fragment>
            );
          })}

        {verMios &&
          miosVisibles.map(encuentro => (
            <Marker
              coordinate={{latitude: encuentro.geo_lat, longitude: encuentro.geo_lng}}
              description={encuentro.nombre_sugerido ?? 'Mi encuentro'}
              key={encuentro.local_id}
              pinColor={reinoColors[encuentro.reino]}
              title="Mi encuentro"
            />
          ))}

        {verAreas &&
          areas.map(area => (
            <Marker
              coordinate={{latitude: area.centro_lat, longitude: area.centro_lng}}
              description={area.administrador ?? undefined}
              key={`area-${area.id}`}
              pinColor={colors.success}
              title={area.nombre}
            />
          ))}
      </MapView>

      <View style={styles.panelSuperior}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <CapaToggle
            activa={mapType === 'hybrid'}
            etiqueta={mapType === 'hybrid' ? 'Híbrido' : 'Satelital'}
            onPress={() => setMapType(actual => (actual === 'satellite' ? 'hybrid' : 'satellite'))}
          />
          <CapaToggle
            activa={verComunidad}
            etiqueta="Comunidad"
            onPress={() => setVerComunidad(valor => !valor)}
          />
          <CapaToggle
            activa={verMios}
            etiqueta="Mis encuentros"
            onPress={() => setVerMios(valor => !valor)}
          />
          <CapaToggle
            activa={verAreas}
            etiqueta="Áreas protegidas"
            onPress={() => setVerAreas(valor => !valor)}
          />
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filaReinos}>
          <CapaToggle activa={reino === null} etiqueta="Todos" onPress={() => setReino(null)} />
          {REINOS.map(valor => (
            <CapaToggle
              activa={reino === valor}
              etiqueta={reinoLabels[valor]}
              key={valor}
              onPress={() => setReino(actual => (actual === valor ? null : valor))}
            />
          ))}
        </ScrollView>

        {nombreEspecie !== null && (
          <Pressable onPress={limpiarEspecie} style={styles.filtroEspecie}>
            <Text style={styles.filtroEspecieTexto}>Solo {nombreEspecie} — tocá para quitar</Text>
          </Pressable>
        )}
      </View>

      {cargando && (
        <View style={styles.estado}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {error !== null && (
        <View style={styles.errorCaja}>
          <Text style={styles.errorTexto}>{error}</Text>
        </View>
      )}

      {seleccion?.sensible === true && (
        <View style={styles.avisoSensible}>
          <Text style={styles.avisoSensibleTexto}>
            Esta especie está amenazada. Su ubicación se muestra aproximada a propósito, para no
            facilitar su captura ni la presión de visitantes.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avisoSensible: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    bottom: spacing.lg,
    left: spacing.lg,
    padding: spacing.md,
    position: 'absolute',
    right: spacing.lg,
  },
  avisoSensibleTexto: {
    color: colors.text,
    fontSize: 13,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipTexto: {
    color: colors.text,
    fontSize: 13,
  },
  chipTextoActivo: {
    color: colors.surface,
  },
  contenedor: {
    backgroundColor: colors.background,
    flex: 1,
  },
  errorCaja: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    bottom: spacing.lg,
    left: spacing.lg,
    padding: spacing.md,
    position: 'absolute',
    right: spacing.lg,
  },
  errorTexto: {
    color: colors.surface,
  },
  estado: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 120,
  },
  filaReinos: {
    marginTop: spacing.sm,
  },
  filtroEspecie: {
    backgroundColor: colors.secondary,
    borderRadius: 16,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filtroEspecieTexto: {
    color: colors.surface,
    fontSize: 13,
  },
  mapa: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  panelSuperior: {
    left: spacing.md,
    position: 'absolute',
    right: spacing.md,
    top: spacing.lg,
  },
});
