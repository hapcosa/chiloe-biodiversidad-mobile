import type {
  AvistamientoDraft,
  AvistamientoFilters,
  AvistamientoListResponse,
  CreateAvistamientoResponse,
  RemoteAvistamiento,
} from '../types/avistamiento';
import type {ApiClient} from './apiClient';
import {buildQueryString} from './apiClient';

export class AvistamientosApi {
  constructor(private readonly client: ApiClient) {}

  // Encuentros de la comunidad. El servidor decide qué se ve: solo lo público y
  // aprobado, ordenado por `observado_en` descendente. No hace falta (ni sirve)
  // mandar `estado` ni `visibilidad`, los acota igual.
  list(filters: AvistamientoFilters = {}): Promise<AvistamientoListResponse> {
    const query = buildQueryString({
      reino: filters.reino,
      grado_identificacion: filters.grado_identificacion,
      limit: filters.limit,
      offset: filters.offset,
    });

    return this.client.get<AvistamientoListResponse>(`/api/v1/avistamientos${query}`);
  }

  create(draft: AvistamientoDraft): Promise<CreateAvistamientoResponse> {
    return this.client.post<CreateAvistamientoResponse>('/api/v1/avistamientos', {
      especie_id: draft.especie_id ?? null,
      reino: draft.reino,
      nombre_sugerido: draft.nombre_sugerido ?? null,
      descripcion: draft.descripcion ?? null,
      foto_key: draft.foto_key ?? null,
      geo_lat: draft.geo_lat,
      geo_lng: draft.geo_lng,
      precision_metros: draft.precision_metros ?? null,
      observado_en: draft.observado_en,
    });
  }

  getById(remoteId: number): Promise<RemoteAvistamiento> {
    return this.client.get<RemoteAvistamiento>(`/api/v1/avistamientos/${remoteId}`);
  }

  compartir(remoteId: number): Promise<CreateAvistamientoResponse> {
    return this.client.patch<CreateAvistamientoResponse>(
      `/api/v1/avistamientos/${remoteId}/compartir`,
    );
  }
}

