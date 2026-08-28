import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {MapType, Marker, Polygon, PROVIDER_GOOGLE} from 'react-native-maps';
import {mapaApi} from '../api';
import {getCachedSpecies} from '../db/speciesCache';
import {listLocalAvistamientos} from '../db/mutationQueue';
import {
  getCurrentLocation,
  hasLocationPermission,
  requestLocationPermission,
} from '../native/location';
import {colors, reinoColors, reinoLabels, spacing} from '../styles/theme';
import type {LocalAvistamiento} from '../types/avistamiento';
import type {Reino, Species} from '../types/domain';
import type {AreaProtegida, CeldaMapa} from '../types/mapa';
import {
  esPuntoCaliente,
  radioCeldaMetros,
  regionDeUbicacion,
  regionToBbox,
  regionToZoom,
  regionesEquivalentes,
  resumenCelda,
  tituloCelda,
  verticesCirculo,
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

interface CeldaCapaProps {
  celda: CeldaMapa;
  onPress: (celda: CeldaMapa) => void;
}

// Memoizado: mover el mapa vuelve a renderizar la pantalla, y sin esto cada
// gesto redibujaba la celda entera. Con celdas suficientes eso es lo que se
// siente como tirones.
//
// La celda se dibuja como un polígono y no como una chincheta porque el punto
// que devuelve el servidor no es un lugar: es el centro de una celda de la
// rejilla, y esa celda se redefine con el zoom, así que el centro salta aunque
// el encuentro no se haya movido. Una chincheta de Google significa "acá, en
// este punto"; el área dice la verdad, y encima cambia de tamaño con el zoom,
// que es como cambia la precisión real.
const CeldaCapa = React.memo(({celda, onPress}: CeldaCapaProps): React.JSX.Element => {
  const caliente = esPuntoCaliente(celda);
  const color = caliente ? colors.secondary : colors.primary;
  const vertices = useMemo(
    () => verticesCirculo(celda.lat, celda.lng, radioCeldaMetros(celda)),
    [celda],
  );

  return (
    <Polygon
      accessibilityLabel={`${tituloCelda(celda)}: ${resumenCelda(celda)}`}
      coordinates={vertices}
      fillColor={`${color}55`}
      onPress={() => onPress(celda)}
      strokeColor={color}
      strokeWidth={caliente ? 2 : 1}
      tappable
    />
  );
});

const MiEncuentroMarcador = React.memo(
  ({encuentro}: {encuentro: LocalAvistamiento}): React.JSX.Element => (
    <Marker
      coordinate={{latitude: encuentro.geo_lat, longitude: encuentro.geo_lng}}
      description={encuentro.nombre_sugerido ?? 'Mi encuentro'}
      pinColor={reinoColors[encuentro.reino]}
      title="Mi encuentro"
    />
  ),
);

const AreaMarcador = React.memo(
  ({area}: {area: AreaProtegida}): React.JSX.Element => (
    <Marker
      coordinate={{latitude: area.centro_lat, longitude: area.centro_lng}}
      description={area.administrador ?? undefined}
      pinColor={colors.success}
      title={area.nombre}
    />
  ),
);

interface HojaCeldaProps {
  celda: CeldaMapa;
  onLayout: (alto: number) => void;
  especie: Species | null;
  filtrada: boolean;
  onAbrirFicha: (especie: Species) => void;
  onCerrar: () => void;
  onFiltrar: (especie: Species) => void;
}

// Hoja de resumen de la celda tocada. Reemplaza al callout nativo de Google,
// que se perdía en cada recarga, y es el lugar donde ahora vive el aviso de
// especie sensible: antes flotaba abajo sin decir de qué celda hablaba.
const HojaCelda = ({
  celda,
  especie,
  filtrada,
  onAbrirFicha,
  onCerrar,
  onFiltrar,
  onLayout,
}: HojaCeldaProps): React.JSX.Element => (
  <View
    onLayout={evento => onLayout(evento.nativeEvent.layout.height)}
    style={styles.hoja}>
    <View style={styles.hojaEncabezado}>
      <View style={styles.hojaTitulos}>
        <Text style={styles.hojaTitulo}>{tituloCelda(celda)}</Text>
        <Text style={styles.hojaResumen}>{resumenCelda(celda)}</Text>
      </View>
      <Pressable
        accessibilityLabel="Cerrar el resumen"
        accessibilityRole="button"
        hitSlop={12}
        onPress={onCerrar}
        style={styles.hojaCerrar}>
        <Text style={styles.hojaCerrarTexto}>✕</Text>
      </Pressable>
    </View>

    {especie !== null && (
      <Text style={styles.hojaEspecie}>
        Más vista acá: {especie.nombre_comun || especie.nombre_cientifico}
      </Text>
    )}

    {celda.sensible && (
      <Text style={styles.hojaAviso}>
        Esta especie está amenazada. Su ubicación se muestra aproximada a propósito, para no
        facilitar su captura ni la presión de visitantes.
      </Text>
    )}

    {especie === null ? (
      // Sin especie no hay nada que filtrar ni que abrir. El servidor deja el
      // dominante en null exactamente cuando ningún encuentro de la celda está
      // identificado, así que ese caso se puede nombrar por lo que es.
      <Text style={styles.hojaSinEspecie}>
        {celda.especie_dominante_id === null
          ? 'Todavía nadie identificó los encuentros de esta zona.'
          : 'La ficha de esta especie todavía no está descargada.'}
      </Text>
    ) : (
      <View style={styles.hojaAcciones}>
        <Pressable
          accessibilityRole="button"
          disabled={filtrada}
          onPress={() => onFiltrar(especie)}
          style={[styles.hojaBoton, filtrada && styles.hojaBotonInactivo]}>
          <Text style={[styles.hojaBotonTexto, filtrada && styles.hojaBotonTextoInactivo]}>
            {filtrada ? 'Ya estás viendo solo esta especie' : 'Ver solo esta especie'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onAbrirFicha(especie)}
          style={[styles.hojaBoton, styles.hojaBotonPrimario]}>
          <Text style={[styles.hojaBotonTexto, styles.hojaBotonTextoPrimario]}>
            Abrir la ficha
          </Text>
        </Pressable>
      </View>
    )}
  </View>
);

interface MapaScreenProps {
  onSelectSpecies: (species: Species) => void;
}

export const MapaScreen = ({onSelectSpecies}: MapaScreenProps): React.JSX.Element => {
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
  const [especieDeSeleccion, setEspecieDeSeleccion] = useState<Species | null>(null);
  // La hoja crece o se achica según lo que tenga que decir, así que el botón de
  // ubicación se corre midiendo la hoja en vez de con un número inventado.
  const [altoHoja, setAltoHoja] = useState(0);
  const [ubicando, setUbicando] = useState(false);
  const [verMiUbicacion, setVerMiUbicacion] = useState(false);

  const areas = useAreasProtegidas(verAreas);
  const mapaRef = useRef<MapView | null>(null);
  // La región no es estado: guardarla en uno volvía a renderizar la pantalla
  // entera —y con ella cada Marker y cada Circle— en cada gesto sobre el mapa.
  // Solo la leen callbacks, nunca el render.
  const region = useRef<RegionLike>(REGION_CHILOE);
  const ultimaRegion = useRef<RegionLike | null>(null);

  useEffect(() => {
    void listLocalAvistamientos().then(setMios);
  }, []);

  // Si el permiso ya se concedió antes —el formulario de encuentro lo pide—,
  // el punto azul aparece sin diálogo. Si no, no se molesta a nadie al abrir
  // el mapa: el permiso se pide recién al tocar "Mi ubicación".
  useEffect(() => {
    void hasLocationPermission().then(setVerMiUbicacion);
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
      void cargarCeldas(region.current);
    }
  }, [cargarCeldas, verComunidad]);

  const onRegionChangeComplete = useCallback(
    (nueva: RegionLike) => {
      region.current = nueva;
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

  const irAMiUbicacion = useCallback(async () => {
    setUbicando(true);
    setError(null);
    try {
      // Se pide aparte de getCurrentLocation —que también lo pediría— para
      // poder distinguir "no me dejaron" de "el GPS no respondió".
      if (!(await requestLocationPermission())) {
        setVerMiUbicacion(false);
        setError('Sin permiso de ubicación no puedo mostrarte dónde estás.');
        return;
      }
      setVerMiUbicacion(true);
      const {lat, lng} = await getCurrentLocation();
      const destino = regionDeUbicacion(lat, lng, region.current);
      region.current = destino;
      mapaRef.current?.animateToRegion(destino, 500);
    } catch {
      setError('No se pudo obtener tu ubicación. Probá al aire libre.');
    } finally {
      setUbicando(false);
    }
  }, []);

  const limpiarEspecie = useCallback(() => {
    setEspecieId(null);
    setNombreEspecie(null);
  }, []);

  const cerrarHoja = useCallback(() => {
    setSeleccion(null);
    setEspecieDeSeleccion(null);
  }, []);

  // Tocar una celda solo abre su resumen. Filtrar recarga las celdas y desmonta
  // los Marker, así que hacerlo en el mismo gesto dejaba al usuario sin ver
  // nunca de qué zona hablaba: ahora el filtro es una acción aparte de la hoja.
  const onCeldaPress = useCallback((celda: CeldaMapa) => {
    setSeleccion(celda);
    setEspecieDeSeleccion(null);
    if (celda.especie_dominante_id === null) {
      return;
    }
    void getCachedSpecies(celda.especie_dominante_id).then(especie => {
      setEspecieDeSeleccion(especie);
    });
  }, []);

  const filtrarPorEspecie = useCallback((especie: Species) => {
    setEspecieId(especie.id);
    setNombreEspecie(especie.nombre_comun || especie.nombre_cientifico);
  }, []);

  const abrirFicha = useCallback(
    (especie: Species) => {
      cerrarHoja();
      onSelectSpecies(especie);
    },
    [cerrarHoja, onSelectSpecies],
  );

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
        ref={mapaRef}
        showsMyLocationButton={false}
        showsUserLocation={verMiUbicacion}
        style={styles.mapa}>
        {verComunidad &&
          celdas.map(celda => (
            <CeldaCapa
              celda={celda}
              key={`${celda.lat}:${celda.lng}:${celda.grados}`}
              onPress={onCeldaPress}
            />
          ))}

        {verMios &&
          miosVisibles.map(encuentro => (
            <MiEncuentroMarcador encuentro={encuentro} key={encuentro.local_id} />
          ))}

        {verAreas &&
          areas.map(area => <AreaMarcador area={area} key={`area-${area.id}`} />)}

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

      <Pressable
        accessibilityLabel="Ir a mi ubicación"
        accessibilityRole="button"
        disabled={ubicando}
        onPress={() => {
          void irAMiUbicacion();
        }}
        style={[
          styles.botonUbicacion,
          seleccion !== null && {bottom: altoHoja + spacing.md},
        ]}>
        {ubicando ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text style={styles.botonUbicacionTexto}>Mi ubicación</Text>
        )}
      </Pressable>

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

      {seleccion !== null && (
        <HojaCelda
          celda={seleccion}
          especie={especieDeSeleccion}
          filtrada={especieDeSeleccion !== null && especieId === especieDeSeleccion.id}
          onAbrirFicha={abrirFicha}
          onCerrar={cerrarHoja}
          onFiltrar={filtrarPorEspecie}
          onLayout={setAltoHoja}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  hoja: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    bottom: 0,
    elevation: 8,
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
  },
  hojaAcciones: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  hojaAviso: {
    color: colors.text,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  hojaBoton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  hojaBotonInactivo: {
    borderColor: colors.border,
  },
  hojaBotonPrimario: {
    backgroundColor: colors.primary,
  },
  hojaBotonTexto: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  hojaBotonTextoInactivo: {
    color: colors.muted,
  },
  hojaBotonTextoPrimario: {
    color: colors.surface,
  },
  hojaCerrar: {
    paddingHorizontal: spacing.xs,
  },
  hojaCerrarTexto: {
    color: colors.muted,
    fontSize: 18,
  },
  hojaEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hojaEspecie: {
    color: colors.text,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  hojaResumen: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  hojaSinEspecie: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.md,
  },
  hojaTitulo: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: '700',
  },
  hojaTitulos: {
    flex: 1,
  },

  botonUbicacion: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    elevation: 3,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    position: 'absolute',
    // Por encima del aviso de especie sensible, que ocupa el borde inferior.
    bottom: 96,
    right: spacing.lg,
  },
  botonUbicacionTexto: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
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
