// Sin este cache, abrir la app sin señal deja la biblioteca con el filtro por
// reino pero sin subgrupos: aparecen y desaparecen según la red. Lo que puede
// romperlo es lo guardado por una versión anterior, que no debe llegar a los
// chips.
import {querySql} from '../connection';
import {getCachedCategorias, saveCachedCategorias} from '../categoriasCache';
import type {Categoria} from '../../types/domain';

jest.mock('../connection', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  executeSql: jest.fn().mockResolvedValue(undefined),
  querySql: jest.fn().mockResolvedValue([]),
}));

const mockQuerySql = querySql as jest.MockedFunction<typeof querySql>;

const aves: Categoria = {
  id: 6,
  slug: 'animalia-aves',
  nombre: 'Aves',
  reino: 'animalia',
  total_especies: 24,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('categoriasCache', () => {
  it('devuelve una lista vacía si nunca se guardó nada', async () => {
    mockQuerySql.mockResolvedValueOnce([]);
    await expect(getCachedCategorias()).resolves.toEqual([]);
  });

  it('devuelve lo guardado', async () => {
    mockQuerySql.mockResolvedValueOnce([{value: JSON.stringify([aves])}]);
    await expect(getCachedCategorias()).resolves.toEqual([aves]);
  });

  it('descarta las entradas sin la forma esperada y conserva el resto', async () => {
    mockQuerySql.mockResolvedValueOnce([
      {value: JSON.stringify([aves, {nombre: 'Sin id'}, null, 7])},
    ]);
    await expect(getCachedCategorias()).resolves.toEqual([aves]);
  });

  it('no revienta si lo guardado no es JSON', async () => {
    mockQuerySql.mockResolvedValueOnce([{value: 'no soy json'}]);
    await expect(getCachedCategorias()).resolves.toEqual([]);
  });

  it('guarda la lista entera bajo una sola clave', async () => {
    await saveCachedCategorias([aves]);
    // No revienta y no exige tablas nuevas: es un blob en sync_state.
    await expect(saveCachedCategorias([])).resolves.toBeUndefined();
  });
});
