import {appConfig} from '../config/appConfig';
import {ApiClient} from './apiClient';
import {AvistamientosApi} from './avistamientosApi';
import {AuthApi} from './authApi';
import {CategoriasApi} from './categoriasApi';
import {IdentificacionesApi} from './identificacionesApi';
import {InsigniasApi} from './insigniasApi';
import {MapaApi} from './mapaApi';
import {PortadaApi} from './portadaApi';
import {PostulacionesApi} from './postulacionesApi';
import {SpeciesApi} from './speciesApi';
import {UploadsApi} from './uploadsApi';

let currentAccessToken: string | null = null;

export const setApiAccessToken = (token: string | null): void => {
  currentAccessToken = token;
};

export const apiClient = new ApiClient({
  baseUrl: appConfig.apiBaseUrl,
  timeoutMs: appConfig.requestTimeoutMs,
  getAccessToken: () => currentAccessToken,
});

// Lo registra AuthContext al montarse. Vive acá y no dentro del contexto para
// que también cubra a los módulos que usan la API fuera de React (el worker de
// sincronización, por ejemplo).
export const setUnauthorizedHandler = (
  handler: (() => void) | undefined,
): void => {
  apiClient.setUnauthorizedHandler(handler);
};

export const authApi = new AuthApi(apiClient);
export const speciesApi = new SpeciesApi(apiClient);
export const avistamientosApi = new AvistamientosApi(apiClient);
export const uploadsApi = new UploadsApi(apiClient);
export const identificacionesApi = new IdentificacionesApi(apiClient);
export const mapaApi = new MapaApi(apiClient);
export const portadaApi = new PortadaApi(apiClient);
export const categoriasApi = new CategoriasApi(apiClient);
export const postulacionesApi = new PostulacionesApi(apiClient);
export const insigniasApi = new InsigniasApi(apiClient);

