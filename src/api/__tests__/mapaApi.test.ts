// El backend espera el bbox en orden GeoJSON (min_lng,min_lat,max_lng,max_lat),
// que es al revés de cómo uno nombra las coordenadas. Equivocarlo no da error:
// devuelve celdas de otro lugar del mundo, en silencio.
import {ApiClient} from '../apiClient';
import {MapaApi, serializeBbox} from '../mapaApi';

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
const api = new MapaApi(client);

const bbox = {min_lat: -43, min_lng: -74.2, max_lat: -42, max_lng: -73.4};

const urlDeLaLlamada = (): string => String(mockFetch.mock.calls[0]?.[0] ?? '');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('serializeBbox', () => {
  it('emite el orden GeoJSON, no el orden en que se nombran las coordenadas', () => {
    expect(serializeBbox(bbox)).toBe('-74.2,-43,-73.4,-42');
  });
});

describe('MapaApi.celdas', () => {
  it('manda bbox y zoom, y omite los filtros no elegidos', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: [], zoom: 11}));

    await api.celdas({bbox, zoom: 11});

    const url = urlDeLaLlamada();
    expect(url).toContain('/api/v1/avistamientos/mapa');
    expect(url).toContain(`bbox=${encodeURIComponent('-74.2,-43,-73.4,-42')}`);
    expect(url).toContain('zoom=11');
    expect(url).not.toContain('reino=');
    expect(url).not.toContain('especie_id=');
  });

  it('agrega reino y especie cuando se filtran', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: [], zoom: 11}));

    await api.celdas({bbox, zoom: 11, reino: 'fungi', especie_id: 42});

    const url = urlDeLaLlamada();
    expect(url).toContain('reino=fungi');
    expect(url).toContain('especie_id=42');
  });

  it('devuelve una lista vacía si el servidor no manda data', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, zoom: 11}));

    await expect(api.celdas({bbox, zoom: 11})).resolves.toEqual([]);
  });
});

describe('MapaApi.areasProtegidas', () => {
  it('pide todas las áreas sin query cuando no se filtra', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: []}));

    await api.areasProtegidas();

    expect(urlDeLaLlamada()).toBe('https://api.example.com/api/v1/areas-protegidas');
  });

  it('filtra por tipo y por bbox', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: []}));

    await api.areasProtegidas({tipo: 'parque_nacional', bbox});

    const url = urlDeLaLlamada();
    expect(url).toContain('tipo=parque_nacional');
    expect(url).toContain(`bbox=${encodeURIComponent('-74.2,-43,-73.4,-42')}`);
  });
});

describe('MapaApi.especiesEnArea', () => {
  it('consulta las especies registradas dentro del área', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {success: true, data: []}));

    await api.especiesEnArea(3, 25);

    const url = urlDeLaLlamada();
    expect(url).toContain('/api/v1/areas-protegidas/3/especies');
    expect(url).toContain('limit=25');
  });
});
