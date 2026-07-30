import {ApiClient} from '../apiClient';
import {ApiError} from '../errors';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ApiClient · manejo del 401', () => {
  it('avisa cuando el servidor rechaza un token que sí mandamos', async () => {
    const onUnauthorized = jest.fn();
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      timeoutMs: 1000,
      getAccessToken: () => 'token-caducado',
      onUnauthorized,
    });

    mockFetch.mockResolvedValueOnce(jsonResponse(401, {message: 'Unauthorized'}));

    await expect(client.get('/api/v1/auth/whoami')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('no avisa si el 401 viene de una petición sin token (login)', async () => {
    const onUnauthorized = jest.fn();
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      timeoutMs: 1000,
      getAccessToken: () => 'token-valido',
      onUnauthorized,
    });

    mockFetch.mockResolvedValueOnce(
      jsonResponse(401, {message: 'Invalid email or password'}),
    );

    await expect(
      client.post('/api/v1/auth/login', {}, {authenticated: false}),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('no avisa cuando no hay sesión guardada', async () => {
    const onUnauthorized = jest.fn();
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      timeoutMs: 1000,
      getAccessToken: () => null,
      onUnauthorized,
    });

    mockFetch.mockResolvedValueOnce(jsonResponse(401, {message: 'Unauthorized'}));

    await expect(client.get('/api/v1/especies')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ignora otros errores HTTP', async () => {
    const onUnauthorized = jest.fn();
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      timeoutMs: 1000,
      getAccessToken: () => 'token-valido',
      onUnauthorized,
    });

    mockFetch.mockResolvedValueOnce(jsonResponse(500, {message: 'boom'}));

    await expect(client.get('/api/v1/especies')).rejects.toMatchObject({
      status: 500,
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
