import type {
  AreaProtegida,
  AreaProtegidaFilters,
  AreaProtegidaListResponse,
  AreaProtegidaResponse,
  BoundingBox,
  CeldaMapa,
  CeldaMapaResponse,
  EspecieEnArea,
  EspeciesEnAreaResponse,
  MapaFilters,
} from '../types/mapa';
import type {ApiClient} from './apiClient';
import {buildQueryString} from './apiClient';

// El backend espera el orden GeoJSON, que no es el orden en que uno lo dice en
// voz alta. Se serializa en un solo lugar para no equivocarlo en cada llamada.
export const serializeBbox = (bbox: BoundingBox): string =>
  [bbox.min_lng, bbox.min_lat, bbox.max_lng, bbox.max_lat].join(',');

export class MapaApi {
  constructor(private readonly client: ApiClient) {}

  // Celdas agregadas, no avistamientos. El servidor ya filtró por público y
  // aprobado, y redondeó las coordenadas de las especies amenazadas.
  async celdas(filters: MapaFilters): Promise<CeldaMapa[]> {
    const query = buildQueryString({
      bbox: serializeBbox(filters.bbox),
      zoom: filters.zoom,
      reino: filters.reino,
      especie_id: filters.especie_id,
    });

    const response = await this.client.get<CeldaMapaResponse>(
      `/api/v1/avistamientos/mapa${query}`,
    );
    return response.data ?? [];
  }

  async areasProtegidas(filters: AreaProtegidaFilters = {}): Promise<AreaProtegida[]> {
    const query = buildQueryString({
      tipo: filters.tipo,
      bbox: filters.bbox ? serializeBbox(filters.bbox) : undefined,
    });

    const response = await this.client.get<AreaProtegidaListResponse>(
      `/api/v1/areas-protegidas${query}`,
    );
    return response.data ?? [];
  }

  async areaProtegida(id: number): Promise<AreaProtegida> {
    const response = await this.client.get<AreaProtegidaResponse>(
      `/api/v1/areas-protegidas/${id}`,
    );
    return response.data;
  }

  async especiesEnArea(id: number, limit?: number): Promise<EspecieEnArea[]> {
    const query = buildQueryString({limit});
    const response = await this.client.get<EspeciesEnAreaResponse>(
      `/api/v1/areas-protegidas/${id}/especies${query}`,
    );
    return response.data ?? [];
  }
}
