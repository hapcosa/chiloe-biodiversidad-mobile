import type {Reino} from './domain';

// La portada la arma el servidor en un solo endpoint (`GET /api/v1/portada`).
// Lo que llega no es el modelo completo sino un recorte pensado para tarjetas:
// en particular, un encuentro de portada **no trae coordenadas**. El mapa
// difumina la ubicación de las especies amenazadas y este endpoint, que es
// público y sin autenticación, no puede ser la puerta de atrás que lo deshaga.
export interface PortadaEspecie {
  id: number;
  reino: Reino;
  nombre_comun: string;
  nombre_cientifico: string;
  foto_portada_key: string | null;
  foto_url: string | null;
  // Publicación o última edición según el bloque en el que venga.
  fecha: string | null;
}

export interface PortadaEncuentro {
  id: number;
  especie_id: number | null;
  reino: Reino;
  nombre_sugerido: string | null;
  foto_key: string;
  foto_url: string | null;
  creado_por: number | null;
  observado_en: string | null;
  created_at: string | null;
}

export interface Portada {
  ultimas_publicadas: PortadaEspecie[];
  ultimas_ediciones: PortadaEspecie[];
  ultimos_encuentros: PortadaEncuentro[];
}

export interface PortadaResponse {
  success: boolean;
  data: Portada;
}

export const portadaVacia = (): Portada => ({
  ultimas_publicadas: [],
  ultimas_ediciones: [],
  ultimos_encuentros: [],
});
