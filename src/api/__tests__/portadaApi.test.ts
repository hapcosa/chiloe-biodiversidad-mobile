// La portada es pública y sin autenticación. Lo que se comprueba aquí es que
// el cliente no se cae si el servidor devuelve poco, y que un bloque vacío
// sigue siendo un array: la pantalla dibuja tres carruseles sin preguntar.
import {ApiClient} from '../apiClient';
import {PortadaApi} from '../portadaApi';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const api = new PortadaApi(
  new ApiClient({
    baseUrl: 'https://api.example.com',
    timeoutMs: 1000,
    getAccessToken: () => null,
  }),
);

const urlDeLaLlamada = (): string => String(mockFetch.mock.calls[0]?.[0] ?? '');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PortadaApi.obtener', () => {
  it('pide un solo endpoint agregado y no tres listados', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {ultimas_publicadas: [], ultimas_ediciones: [], ultimos_encuentros: []},
      }),
    );

    await api.obtener();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(urlDeLaLlamada()).toContain('/api/v1/portada');
    expect(urlDeLaLlamada()).not.toContain('limite');
  });

  it('manda el límite solo cuando se pide', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {ultimas_publicadas: [], ultimas_ediciones: [], ultimos_encuentros: []},
      }),
    );

    await api.obtener(3);

    expect(urlDeLaLlamada()).toContain('limite=3');
  });

  it('devuelve los tres bloques vacíos si el cuerpo no trae data', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true}));

    await expect(api.obtener()).resolves.toEqual({
      ultimas_publicadas: [],
      ultimas_ediciones: [],
      ultimos_encuentros: [],
    });
  });
});
