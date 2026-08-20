// La caché de la portada es el fallback de "abrí la app sin red". Lo que puede
// romperla no es el caso feliz sino lo guardado por una versión anterior de la
// app: si eso llegara a la pantalla, reventaría al pintar.
import {querySql} from '../connection';
import {getCachedPortada, saveCachedPortada} from '../portadaCache';
import {portadaVacia} from '../../types/portada';

jest.mock('../connection', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  executeSql: jest.fn().mockResolvedValue(undefined),
  querySql: jest.fn().mockResolvedValue([]),
}));

const mockQuerySql = querySql as jest.MockedFunction<typeof querySql>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('portadaCache', () => {
  it('devuelve null si nunca se guardó nada', async () => {
    mockQuerySql.mockResolvedValueOnce([]);
    await expect(getCachedPortada()).resolves.toBeNull();
  });

  it('descarta lo guardado si no tiene la forma esperada', async () => {
    mockQuerySql.mockResolvedValueOnce([{value: '{"ultimas_publicadas":[]}'}]);
    await expect(getCachedPortada()).resolves.toBeNull();
  });

  it('descarta lo guardado si no es JSON', async () => {
    mockQuerySql.mockResolvedValueOnce([{value: 'no soy json'}]);
    await expect(getCachedPortada()).resolves.toBeNull();
  });

  it('recupera lo que guardó', async () => {
    const portada = {
      ...portadaVacia(),
      ultimos_encuentros: [
        {
          id: 7,
          especie_id: null,
          reino: 'fungi' as const,
          nombre_sugerido: null,
          foto_key: 'avistamientos/7.jpg',
          foto_url: null,
          creado_por: 3,
          observado_en: '2026-03-01',
          created_at: '2026-08-18T10:00:00Z',
        },
      ],
    };

    await saveCachedPortada(portada);
    mockQuerySql.mockResolvedValueOnce([{value: JSON.stringify(portada)}]);

    await expect(getCachedPortada()).resolves.toEqual(portada);
  });
});
