// Los tres endpoints devuelven el mismo sobre {success, data}; lo que se fija
// acá es que cada uno pegue en su ruta y que un cuerpo sin `data` no rompa la
// pantalla del perfil.
import {ApiClient} from '../apiClient';
import {InsigniasApi} from '../insigniasApi';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const api = new InsigniasApi(
  new ApiClient({
    baseUrl: 'https://api.example.com',
    timeoutMs: 1000,
    getAccessToken: () => 'token',
  }),
);

const urlLlamada = (): string => String(mockFetch.mock.calls[0]?.[0] ?? '');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InsigniasApi', () => {
  it('el catálogo desenvuelve el sobre', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: [{codigo: 'observador', tipo: 'automatica', umbral: 10}],
      }),
    );

    await expect(api.catalogo()).resolves.toEqual([
      {codigo: 'observador', tipo: 'automatica', umbral: 10},
    ]);
    expect(urlLlamada()).toContain('/api/v1/insignias');
  });

  it('las mías pegan en su propia ruta', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: []}));

    await api.mias();

    expect(urlLlamada()).toContain('/api/v1/insignias/mias');
  });

  it('las de otra persona van por id', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: []}));

    await api.deUsuario(42);

    expect(urlLlamada()).toContain('/api/v1/insignias/usuario/42');
  });

  it('un cuerpo sin data devuelve lista vacía', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true}));

    await expect(api.mias()).resolves.toEqual([]);
  });
});
