import type {
  PostulacionCurador,
  PostulacionDraft,
  PostulacionListResponse,
} from '../types/postulacion';
import type {ApiClient} from './apiClient';

export class PostulacionesApi {
  constructor(private readonly client: ApiClient) {}

  // Sin filtro por estado: el backend le devuelve al usuario común solo las
  // suyas, y son pocas. El filtro que existe es para la bandeja del admin.
  async mias(): Promise<PostulacionCurador[]> {
    const response = await this.client.get<PostulacionListResponse>(
      '/api/v1/postulaciones',
    );
    return response.data ?? [];
  }

  // El alta responde el objeto pelado, sin el sobre {success, data} que sí usa
  // el listado. Se replica tal cual en vez de normalizarlo acá para no
  // inventar un contrato que el servidor no tiene.
  create(draft: PostulacionDraft): Promise<PostulacionCurador> {
    return this.client.post<PostulacionCurador>('/api/v1/postulaciones', {
      categoria_id: draft.categoria_id,
      texto: draft.texto,
    });
  }
}
