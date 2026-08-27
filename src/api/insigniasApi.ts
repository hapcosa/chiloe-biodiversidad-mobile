import type {
  Insignia,
  InsigniaListResponse,
  InsigniaOtorgada,
} from '../types/insignia';
import type {ApiClient} from './apiClient';

export class InsigniasApi {
  constructor(private readonly client: ApiClient) {}

  // El catálogo completo (una docena de filas). Sirve para mostrar lo que
  // falta por ganar, no solo lo ganado.
  async catalogo(): Promise<Insignia[]> {
    const response =
      await this.client.get<InsigniaListResponse<Insignia>>('/api/v1/insignias');
    return response.data ?? [];
  }

  async mias(): Promise<InsigniaOtorgada[]> {
    const response = await this.client.get<InsigniaListResponse<InsigniaOtorgada>>(
      '/api/v1/insignias/mias',
    );
    return response.data ?? [];
  }

  // Las de otra persona. Son públicas dentro de la app: se ven junto a su
  // nombre igual que su perfil.
  async deUsuario(usuarioId: number): Promise<InsigniaOtorgada[]> {
    const response = await this.client.get<InsigniaListResponse<InsigniaOtorgada>>(
      `/api/v1/insignias/usuario/${usuarioId}`,
    );
    return response.data ?? [];
  }
}
