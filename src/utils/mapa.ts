import type {BoundingBox, CeldaMapa} from '../types/mapa';

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

// Radio del círculo con que se pinta una celda, en metros. Se deriva del lado
// real de la celda para no sugerir más precisión de la que hay.
export const radioCeldaMetros = (celda: CeldaMapa): number => {
  const metrosPorGradoLat = 111_320;
  return (celda.grados * metrosPorGradoLat) / 2;
};
