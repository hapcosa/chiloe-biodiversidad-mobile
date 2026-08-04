import type {
  Identificacion,
  IdentificacionDraft,
  IdentificacionListResponse,
} from '../types/identificacion';
import type {ApiClient} from './apiClient';

export class IdentificacionesApi {
  constructor(private readonly client: ApiClient) {}

  // El listado incluye las retiradas: la discusión se lee completa aunque
  // alguien se haya desdicho.
  async list(avistamientoId: number): Promise<Identificacion[]> {
    const response = await this.client.get<IdentificacionListResponse>(
      `/api/v1/avistamientos/${avistamientoId}/identificaciones`,
    );
    return response.data ?? [];
  }

  create(draft: IdentificacionDraft): Promise<Identificacion> {
    return this.client.post<Identificacion>(
      `/api/v1/avistamientos/${draft.avistamiento_id}/identificaciones`,
      {
        especie_id: draft.especie_id,
        comentario: draft.comentario ?? null,
      },
    );
  }

  retirar(avistamientoId: number, identificacionId: number): Promise<Identificacion> {
    return this.client.delete<Identificacion>(
      `/api/v1/avistamientos/${avistamientoId}/identificaciones/${identificacionId}`,
    );
  }
}
