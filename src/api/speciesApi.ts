import type {Species, SpeciesFilters, SpeciesListResponse} from '../types/domain';
import type {ApiClient} from './apiClient';
import {buildQueryString} from './apiClient';

export class SpeciesApi {
  constructor(private readonly client: ApiClient) {}

  list(filters: SpeciesFilters = {}): Promise<SpeciesListResponse> {
    const query = buildQueryString({
      reino: filters.reino,
      genero_id: filters.genero_id,
      familia_id: filters.familia_id,
      conservacion: filters.conservacion,
      endemica: filters.endemica,
      q: filters.q,
      limit: filters.limit,
      offset: filters.offset,
      orderby: filters.orderby,
      orderdir: filters.orderdir,
    });

    return this.client.get<SpeciesListResponse>(`/api/v1/especies${query}`);
  }

  getById(id: number): Promise<Species> {
    return this.client.get<Species>(`/api/v1/especies/${id}`);
  }
}

