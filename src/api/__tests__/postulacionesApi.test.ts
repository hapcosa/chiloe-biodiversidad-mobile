// El alta y el listado de postulaciones responden con formas distintas —objeto
// pelado una, sobre {success, data} el otro—, así que lo que importa acá es que
// el cliente no confunda una con la otra.
import {ApiClient} from '../apiClient';
import {PostulacionesApi} from '../postulacionesApi';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const api = new PostulacionesApi(
  new ApiClient({
    baseUrl: 'https://api.example.com',
    timeoutMs: 1000,
    getAccessToken: () => 'token',
  }),
);

const llamada = (): {url: string; init: RequestInit} => ({
  url: String(mockFetch.mock.calls[0]?.[0] ?? ''),
  init: (mockFetch.mock.calls[0]?.[1] ?? {}) as RequestInit,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PostulacionesApi.mias', () => {
  it('desenvuelve el sobre del listado', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {success: true, data: [{id: 7, categoria_id: 2}]}),
    );

    await expect(api.mias()).resolves.toEqual([{id: 7, categoria_id: 2}]);
    expect(llamada().url).toContain('/api/v1/postulaciones');
  });

  it('devuelve una lista vacía si el cuerpo no trae data', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true}));

    await expect(api.mias()).resolves.toEqual([]);
  });
});

describe('PostulacionesApi.create', () => {
  it('manda solo la categoría y el texto: el usuario lo pone el servidor', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {id: 9, usuario_id: 3, estado: 'pendiente'}),
    );

    await api.create({categoria_id: 4, texto: 'Anillo aves hace diez años'});

    const {init} = llamada();
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      categoria_id: 4,
      texto: 'Anillo aves hace diez años',
    });
  });

  it('devuelve el objeto pelado que responde el alta', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {id: 9, usuario_id: 3, estado: 'pendiente'}),
    );

    await expect(api.create({categoria_id: 4, texto: 'hola'})).resolves.toMatchObject({
      id: 9,
      estado: 'pendiente',
    });
  });

  it('propaga el motivo del rechazo del servidor', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(400, {
        success: false,
        error: 'ya tienes una postulación pendiente para esta categoría',
      }),
    );

    await expect(api.create({categoria_id: 4, texto: 'hola'})).rejects.toThrow(
      'ya tienes una postulación pendiente para esta categoría',
    );
  });
});
