import type {Reino} from './domain';

// Celda agregada del endpoint del mapa. El servidor no devuelve avistamientos
// sueltos: agrupa por rejilla según el zoom para no publicar de una vez miles
// de ubicaciones exactas.
export interface CeldaMapa {
  lat: number;
  lng: number;
  // Lado de la celda en grados. Sirve para dibujarla y para saber cuánta
  // imprecisión trae el punto que devuelve el servidor.
  grados: number;
  total: number;
  especies_distintas: number;
  especie_dominante_id: number | null;
  // La especie dominante está en categoría de conservación de riesgo, así que
  // la coordenada viene deliberadamente redondeada.
  sensible: boolean;
}

export interface CeldaMapaResponse {
  success: boolean;
  data: CeldaMapa[];
  zoom: number;
}

// Un vértice del polígono con que se dibuja una celda. Coincide con el `LatLng`
// de react-native-maps, pero no se importa de ahí para no atar los tipos del
// dominio a la librería del mapa.
export interface LatLngLike {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  min_lat: number;
  min_lng: number;
  max_lat: number;
  max_lng: number;
}

export interface MapaFilters {
  bbox: BoundingBox;
  zoom: number;
  reino?: Reino;
  especie_id?: number;
}

export type AreaProtegidaTipo =
  | 'parque_nacional'
  | 'reserva_nacional'
  | 'monumento_natural'
  | 'santuario_naturaleza'
  | 'parque_privado'
  | 'sitio_ramsar'
  | 'humedal_urbano';

// `bbox` viene en orden GeoJSON: [min_lng, min_lat, max_lng, max_lat].
export type AreaProtegidaBbox = [number, number, number, number];

export interface AreaProtegida {
  id: number;
  nombre: string;
  tipo: AreaProtegidaTipo;
  descripcion: string | null;
  administrador: string | null;
  accesos: string | null;
  sitio_web: string | null;
  centro_lat: number;
  centro_lng: number;
  bbox: AreaProtegidaBbox;
  // Polígono GeoJSON cuando curaduría lo cargó; si no, se dibuja el bbox.
  geometria: unknown | null;
  superficie_ha: number | null;
  fuente: string | null;
  verificado: boolean;
}

export interface EspecieEnArea {
  especie_id: number;
  nombre_comun: string;
  nombre_cientifico: string;
  reino: Reino;
  avistamientos: number;
  ultimo_avistamiento: string | null;
}

export interface AreaProtegidaListResponse {
  success: boolean;
  data: AreaProtegida[];
}

export interface AreaProtegidaResponse {
  success: boolean;
  data: AreaProtegida;
}

export interface EspeciesEnAreaResponse {
  success: boolean;
  data: EspecieEnArea[];
}

export interface AreaProtegidaFilters {
  tipo?: AreaProtegidaTipo;
  bbox?: BoundingBox;
}
