import type {Categoria, Reino} from '../types/domain';
import type {ApiClient} from './apiClient';
import {buildQueryString} from './apiClient';

interface CategoriasResponse {
  success: boolean;
  data: Categoria[];
}

export class CategoriasApi {
  constructor(private readonly client: ApiClient) {}

  async list(reino?: Reino): Promise<Categoria[]> {
    const response = await this.client.get<CategoriasResponse>(
      `/api/v1/categorias${buildQueryString({reino})}`,
    );
    return response.data ?? [];
  }
}
