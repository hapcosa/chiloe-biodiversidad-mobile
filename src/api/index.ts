import {appConfig} from '../config/appConfig';
import {ApiClient} from './apiClient';
import {AvistamientosApi} from './avistamientosApi';
import {AuthApi} from './authApi';
import {SpeciesApi} from './speciesApi';

let currentAccessToken: string | null = null;

export const setApiAccessToken = (token: string | null): void => {
  currentAccessToken = token;
};

export const apiClient = new ApiClient({
  baseUrl: appConfig.apiBaseUrl,
  timeoutMs: appConfig.requestTimeoutMs,
  getAccessToken: () => currentAccessToken,
});

export const authApi = new AuthApi(apiClient);
export const speciesApi = new SpeciesApi(apiClient);
export const avistamientosApi = new AvistamientosApi(apiClient);

