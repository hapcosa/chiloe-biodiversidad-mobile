import type {
  AvistamientoDraft,
  CreateAvistamientoResponse,
} from '../types/avistamiento';
import type {ApiClient} from './apiClient';

export class AvistamientosApi {
  constructor(private readonly client: ApiClient) {}

  create(draft: AvistamientoDraft): Promise<CreateAvistamientoResponse> {
    return this.client.post<CreateAvistamientoResponse>('/api/v1/avistamientos', {
      especie_id: draft.especie_id ?? null,
      reino: draft.reino,
      nombre_sugerido: draft.nombre_sugerido ?? null,
      descripcion: draft.descripcion ?? null,
      foto_key: draft.foto_key,
      geo_lat: draft.geo_lat,
      geo_lng: draft.geo_lng,
      precision_metros: draft.precision_metros ?? null,
      observado_en: draft.observado_en,
    });
  }
}

