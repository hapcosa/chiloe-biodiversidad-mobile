// Rutas y envelopes de la identificación comunitaria: el listado viene envuelto
// en {success, data} y los recursos sueltos vienen pelados (ver el backend en
// services/especies-api/src/controllers/identificacion_controller.cpp).
import {ApiClient} from '../apiClient';
import {IdentificacionesApi} from '../identificacionesApi';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const client = new ApiClient({
  baseUrl: 'https://api.example.com',
  timeoutMs: 1000,
  getAccessToken: () => 'token',
});
const api = new IdentificacionesApi(client);

const identificacion = {
  id: 3,
  avistamiento_id: 12,
  usuario_id: 7,
  especie_id: 42,
  comentario: 'Por la nervadura',
  decisiva: false,
  retirada: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('IdentificacionesApi', () => {
  it('lista desenvolviendo el {success, data}', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {success: true, data: [identificacion]}),
    );

    await expect(api.list(12)).resolves.toEqual([identificacion]);

    const [url, init] = mockFetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example.com/api/v1/avistamientos/12/identificaciones');
    expect(init.method).toBe('GET');
  });

  it('devuelve lista vacía si el servidor omite data', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true}));

    await expect(api.list(12)).resolves.toEqual([]);
  });

  it('crea mandando solo especie_id y comentario', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, identificacion));

    await expect(
      api.create({avistamiento_id: 12, especie_id: 42, comentario: 'Por la nervadura'}),
    ).resolves.toEqual(identificacion);

    const [url, init] = mockFetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example.com/api/v1/avistamientos/12/identificaciones');
    expect(init.method).toBe('POST');
    // avistamiento_id viaja en la ruta, no en el cuerpo.
    expect(JSON.parse(init.body)).toEqual({
      especie_id: 42,
      comentario: 'Por la nervadura',
    });
  });

  it('manda comentario null cuando no hay justificación', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, identificacion));

    await api.create({avistamiento_id: 12, especie_id: 42});

    const [, init] = mockFetch.mock.calls[0] ?? [];
    expect(JSON.parse(init.body).comentario).toBeNull();
  });

  it('retira con DELETE sobre la identificación concreta', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {...identificacion, retirada: true}));

    await expect(api.retirar(12, 3)).resolves.toMatchObject({retirada: true});

    const [url, init] = mockFetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example.com/api/v1/avistamientos/12/identificaciones/3');
    expect(init.method).toBe('DELETE');
  });
});
