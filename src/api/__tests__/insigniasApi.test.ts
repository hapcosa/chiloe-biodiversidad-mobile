// Los tres endpoints devuelven el mismo sobre {success, data}; lo que se fija
// acá es que cada uno pegue en su ruta y que un cuerpo sin `data` no rompa la
// pantalla del perfil.
import {ApiClient} from '../apiClient';
import {InsigniasApi, MAX_USUARIOS_POR_LOTE} from '../insigniasApi';

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

  it('el lote pide una sola vez, con los ids separados por coma', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: {}}));

    await api.deUsuarios([7, 9]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(urlLlamada()).toContain('/api/v1/insignias/usuarios?ids=7,9');
  });

  it('el lote indexa por numero, no por la clave de texto del JSON', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {'7': [{codigo: 'curador'}], '9': []},
      }),
    );

    const porUsuario = await api.deUsuarios([7, 9]);

    expect(porUsuario.get(7)).toEqual([{codigo: 'curador'}]);
    expect(porUsuario.get(9)).toEqual([]);
  });

  it('el lote no repite ids: la misma persona identifica varias veces', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: {}}));

    await api.deUsuarios([9, 7, 9, 9]);

    expect(urlLlamada()).toContain('ids=9,7');
  });

  it('un lote vacio no llega a la red', async () => {
    await expect(api.deUsuarios([])).resolves.toEqual(new Map());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('corta en el tope del servidor en vez de comerse un 400', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: {}}));

    const muchos = Array.from({length: MAX_USUARIOS_POR_LOTE + 20}, (_, i) => i + 1);
    await api.deUsuarios(muchos);

    const ids = urlLlamada().split('ids=')[1] ?? '';
    expect(ids.split(',')).toHaveLength(MAX_USUARIOS_POR_LOTE);
  });

  it('un cuerpo sin data deja el mapa vacio en vez de romper', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true}));

    await expect(api.deUsuarios([7])).resolves.toEqual(new Map());
  });
});

