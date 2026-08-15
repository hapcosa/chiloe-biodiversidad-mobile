// El feed de comunidad es un GET con filtros opcionales: lo que no se elige no
// debe viajar en la query, porque el backend rechaza valores vacíos de enum.
import {ApiClient} from '../apiClient';
import {AvistamientosApi} from '../avistamientosApi';

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
const api = new AvistamientosApi(client);

const listado = {
  success: true,
  data: [],
  pagination: {limit: 20, offset: 0, total: 0},
};

const urlDeLaLlamada = (): string => String(mockFetch.mock.calls[0]?.[0] ?? '');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AvistamientosApi.list', () => {
  it('pide el listado sin query cuando no hay filtros', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, listado));

    await expect(api.list()).resolves.toEqual(listado);

    expect(urlDeLaLlamada()).toBe('https://api.example.com/api/v1/avistamientos');
    expect(mockFetch.mock.calls[0]?.[1].method).toBe('GET');
  });

  it('manda reino, grado y paginación', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, listado));

    await api.list({
      reino: 'fungi',
      grado_identificacion: 'en_discusion',
      limit: 20,
      offset: 40,
    });

    const url = urlDeLaLlamada();
    expect(url).toContain('reino=fungi');
    expect(url).toContain('grado_identificacion=en_discusion');
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=40');
  });

  it('omite los filtros no elegidos', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, listado));

    await api.list({limit: 20, offset: 0});

    const url = urlDeLaLlamada();
    expect(url).not.toContain('reino=');
    expect(url).not.toContain('grado_identificacion=');
  });

  // El servidor ya acota a público + aprobado; mandarlos sería confiar en el
  // cliente para una decisión de autorización.
  it('no manda estado ni visibilidad', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, listado));

    await api.list({reino: 'plantae'});

    const url = urlDeLaLlamada();
    expect(url).not.toContain('estado=');
    expect(url).not.toContain('visibilidad=');
  });

  it('comparte con PATCH sobre el avistamiento concreto', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {id: 12, estado: 'pendiente'}));

    await expect(api.compartir(12)).resolves.toMatchObject({id: 12});

    expect(urlDeLaLlamada()).toBe(
      'https://api.example.com/api/v1/avistamientos/12/compartir',
    );
    expect(mockFetch.mock.calls[0]?.[1].method).toBe('PATCH');
  });
});
