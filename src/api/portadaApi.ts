import type {Portada, PortadaResponse} from '../types/portada';
import {portadaVacia} from '../types/portada';
import type {ApiClient} from './apiClient';
import {buildQueryString} from './apiClient';

export class PortadaApi {
  constructor(private readonly client: ApiClient) {}

  // Una llamada y no tres: la portada es lo primero que se abre y en la isla
  // encadenar peticiones se nota.
  async obtener(limite?: number): Promise<Portada> {
    const response = await this.client.get<PortadaResponse>(
      `/api/v1/portada${buildQueryString({limite})}`,
    );
    return response.data ?? portadaVacia();
  }
}
