import type {
  Insignia,
  InsigniaListResponse,
  InsigniaOtorgada,
  InsigniasPorUsuarioResponse,
} from '../types/insignia';
import type {ApiClient} from './apiClient';

// Espejo de `InsigniaService::kMaxUsuariosPorLote` en especies-api.
export const MAX_USUARIOS_POR_LOTE = 100;

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

  // Las de varias personas de una vez. Una pantalla que nombra a N usuarios
  // —la lista de identificaciones de una ficha— haría N peticiones sin esto.
  //
  // El servidor rechaza pedir más de `MAX_USUARIOS_POR_LOTE`, así que la lista
  // se corta acá: mejor quedarse sin las insignias de los últimos que sin las
  // de nadie por un 400.
  async deUsuarios(usuarioIds: number[]): Promise<Map<number, InsigniaOtorgada[]>> {
    const unicos = [...new Set(usuarioIds)].slice(0, MAX_USUARIOS_POR_LOTE);
    if (unicos.length === 0) {
      return new Map();
    }

    const response = await this.client.get<InsigniasPorUsuarioResponse>(
      `/api/v1/insignias/usuarios?ids=${unicos.join(',')}`,
    );
    return new Map(
      Object.entries(response.data ?? {}).map(([id, insignias]) => [
        Number(id),
        insignias,
      ]),
    );
  }
}
