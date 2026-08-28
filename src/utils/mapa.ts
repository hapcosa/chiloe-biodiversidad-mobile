import type {BoundingBox, CeldaMapa, LatLngLike} from '../types/mapa';

export interface RegionLike {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// Chiloé entero, para abrir el mapa en algo reconocible antes de saber dónde
// está quien mira.
export const REGION_CHILOE: RegionLike = {
  latitude: -42.62,
  longitude: -73.85,
  latitudeDelta: 1.6,
  longitudeDelta: 1.6,
};

export const regionToBbox = (region: RegionLike): BoundingBox => {
  const halfLat = Math.abs(region.latitudeDelta) / 2;
  const halfLng = Math.abs(region.longitudeDelta) / 2;

  return {
    min_lat: Math.max(-90, region.latitude - halfLat),
    max_lat: Math.min(90, region.latitude + halfLat),
    min_lng: Math.max(-180, region.longitude - halfLng),
    max_lng: Math.min(180, region.longitude + halfLng),
  };
};

// El zoom de Google Maps es logarítmico: cada nivel parte en dos el ancho
// visible. `react-native-maps` entrega deltas, no zoom, así que hay que
// deducirlo — el backend lo usa para elegir el tamaño de celda.
export const regionToZoom = (region: RegionLike): number => {
  const delta = Math.abs(region.longitudeDelta);
  if (!Number.isFinite(delta) || delta <= 0) {
    return 20;
  }
  const zoom = Math.log2(360 / delta);
  return Math.min(20, Math.max(0, Math.round(zoom)));
};

// Dos regiones se consideran la misma si el centro y la escala apenas se
// movieron. Sin esto, cada temblor del dedo dispararía una petición.
export const regionesEquivalentes = (a: RegionLike, b: RegionLike): boolean => {
  const toleranciaCentro = Math.abs(a.latitudeDelta) * 0.1;
  return (
    Math.abs(a.latitude - b.latitude) < toleranciaCentro &&
    Math.abs(a.longitude - b.longitude) < toleranciaCentro &&
    Math.abs(a.latitudeDelta - b.latitudeDelta) < Math.abs(a.latitudeDelta) * 0.1
  );
};

// A partir de acá una celda deja de ser "algunos registros" y pasa a ser un
// lugar donde de verdad se ve la especie.
export const UMBRAL_PUNTO_CALIENTE = 8;
// ~5 km de lado. Con celdas más grandes, "acá se ve mucho" no dice nada útil:
// el punto podría estar a media hora de camino.
const GRADOS_MAXIMOS_PUNTO_CALIENTE = 0.05;

// Un punto caliente es una concentración apretada y de una sola especie. Si la
// celda mezcla especies, el número alto habla del tránsito de gente, no de la
// presencia del bicho.
export const esPuntoCaliente = (celda: CeldaMapa): boolean =>
  celda.total >= UMBRAL_PUNTO_CALIENTE &&
  celda.grados <= GRADOS_MAXIMOS_PUNTO_CALIENTE &&
  celda.especies_distintas === 1 &&
  celda.especie_dominante_id !== null;

const METROS_POR_GRADO_LAT = 111_320;

// Radio del círculo con que se pinta una celda, en metros. Se deriva del lado
// real de la celda para no sugerir más precisión de la que hay.
export const radioCeldaMetros = (celda: CeldaMapa): number =>
  (celda.grados * METROS_POR_GRADO_LAT) / 2;

// Con menos lados el borde se ve como un polígono; con más, cada celda cuesta
// vértices sin que la diferencia se note en pantalla.
export const LADOS_CELDA = 48;

// El `Circle` de react-native-maps no se puede tocar: `MapCircleManager` no
// declara la prop `tappable` y `MapView` no registra un `OnCircleClickListener`,
// así que el tap nunca llega a JS. El `Polygon` sí lo hace de punta a punta, y
// por eso la celda se dibuja como un polígono de muchos lados que a simple
// vista es un círculo.
export const verticesCirculo = (
  lat: number,
  lng: number,
  radioMetros: number,
  lados: number = LADOS_CELDA,
): LatLngLike[] => {
  const deltaLat = radioMetros / METROS_POR_GRADO_LAT;
  // Un grado de longitud mide menos cuanto más lejos del ecuador; sin corregir,
  // el círculo saldría achatado. El piso del coseno solo evita dividir por cero
  // en los polos, donde no hay nada que mostrar.
  const deltaLng = deltaLat / Math.max(Math.abs(Math.cos((lat * Math.PI) / 180)), 1e-6);

  return Array.from({length: lados}, (_, i) => {
    const angulo = (2 * Math.PI * i) / lados;
    return {
      latitude: lat + deltaLat * Math.cos(angulo),
      longitude: normalizarLng(lng + deltaLng * Math.sin(angulo)),
    };
  });
};

// Una celda pegada al antimeridiano generaría vértices fuera de rango y Google
// dibujaría el polígono dando la vuelta al mundo.
const normalizarLng = (lng: number): number => ((((lng + 180) % 360) + 360) % 360) - 180;

// "1 encuentros" delataba que los textos del mapa se arman concatenando. El
// singular se decide por el número, no por el sustantivo.
export const plural = (cantidad: number, singular: string, plural_: string): string =>
  `${cantidad} ${cantidad === 1 ? singular : plural_}`;

// Zoom con el que se abre "mi ubicación" cuando el mapa todavía muestra Chiloé
// entero: centrarse sin acercar dejaría al usuario mirando un punto perdido en
// la isla. ~11 km de lado.
export const DELTA_UBICACION_CERCANA = 0.1;

// Adónde mover el mapa al tocar "mi ubicación". Si ya estaba cerca conserva la
// escala —moverse no debería cambiar el zoom que uno eligió—; si estaba lejos
// acerca hasta ver el entorno.
export const regionDeUbicacion = (
  lat: number,
  lng: number,
  actual: RegionLike,
): RegionLike => {
  const latitudeDelta = Math.abs(actual.latitudeDelta);
  const longitudeDelta = Math.abs(actual.longitudeDelta);
  if (latitudeDelta <= DELTA_UBICACION_CERCANA) {
    return {latitude: lat, longitude: lng, latitudeDelta, longitudeDelta};
  }
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: DELTA_UBICACION_CERCANA,
    longitudeDelta: DELTA_UBICACION_CERCANA,
  };
};

// Encabezado de la hoja de resumen. Un punto caliente merece nombrarse: es el
// dato que alguien busca cuando abre el mapa para salir a ver algo.
export const tituloCelda = (celda: CeldaMapa): string =>
  esPuntoCaliente(celda) ? 'Punto caliente' : 'Zona con encuentros';

// Línea de conteos de la hoja. En un punto caliente todos los registros son de
// la misma especie, así que contar especies distintas ahí sobra y encima
// diría siempre "1 especie".
//
// El servidor cuenta como especie distinta solo el encuentro que tiene una
// asignada, así que una zona donde nadie identificó nada devuelve 0 y decir
// "1 encuentro · 0 especies" sonaba a error de cálculo.
export const resumenCelda = (celda: CeldaMapa): string => {
  if (esPuntoCaliente(celda)) {
    return plural(celda.total, 'registro', 'registros');
  }
  const encuentros = plural(celda.total, 'encuentro', 'encuentros');
  if (celda.especies_distintas === 0) {
    return `${encuentros} · sin identificar`;
  }
  return `${encuentros} · ${plural(celda.especies_distintas, 'especie', 'especies')}`;
};
