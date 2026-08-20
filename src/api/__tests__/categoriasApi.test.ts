// El listado de subgrupos alimenta los chips de la biblioteca. Lo que importa
// acá no es el caso feliz sino que un backend viejo —sin `data`, sin
// `total_especies`— no rompa la pantalla.
import {ApiClient} from '../apiClient';
import {CategoriasApi} from '../categoriasApi';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const api = new CategoriasApi(
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

describe('CategoriasApi.list', () => {
  it('pide todas las categorías cuando no se filtra por reino', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: []}));

    await api.list();

    expect(urlDeLaLlamada()).toContain('/api/v1/categorias');
    expect(urlDeLaLlamada()).not.toContain('reino=');
  });

  it('manda el reino cuando se pide uno', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: []}));

    await api.list('fungi');

    expect(urlDeLaLlamada()).toContain('reino=fungi');
  });

  it('devuelve una lista vacía si el cuerpo no trae data', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true}));

    await expect(api.list()).resolves.toEqual([]);
  });
});
