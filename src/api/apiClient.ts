import {ApiError} from './errors';

type TokenProvider = () => Promise<string | null> | string | null;

interface ApiClientOptions {
  baseUrl: string;
  timeoutMs: number;
  getAccessToken?: TokenProvider;
  // Se invoca cuando el servidor rechaza un token que sí mandamos. No aplica a
  // login/refresh, que van sin Authorization: ahí un 401 es "credenciales
  // malas", no "sesión caducada".
  onUnauthorized?: () => void;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  authenticated?: boolean;
}

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, '');

const parseResponseBody = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (text.trim() === '') {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
};

export const buildQueryString = (
  params: Record<string, string | number | boolean | undefined | null>,
): string => {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return query.length > 0 ? `?${query}` : '';
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly getAccessToken?: TokenProvider;
  private onUnauthorized?: () => void;

  constructor(options: ApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs;
    this.getAccessToken = options.getAccessToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  setUnauthorizedHandler(handler: (() => void) | undefined): void {
    this.onUnauthorized = handler;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      body = JSON.stringify(options.body);
    }

    let sentToken = false;
    if (options.authenticated !== false && this.getAccessToken) {
      const token = await this.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        sentToken = true;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body,
        signal: controller.signal,
      });
      const payload = await parseResponseBody<T>(response);

      if (!response.ok) {
        if (response.status === 401 && sentToken) {
          this.onUnauthorized?.();
        }

        const message =
          typeof payload === 'object' && payload !== null && 'message' in payload
            ? String((payload as {message?: unknown}).message)
            : `HTTP ${response.status}`;
        throw new ApiError(message, response.status, payload);
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {...options, method: 'GET'});
  }

  post<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {...options, method: 'POST', body});
  }

  put<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {...options, method: 'PUT', body});
  }

  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {...options, method: 'PATCH', body});
  }

  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {...options, method: 'DELETE'});
  }
}

