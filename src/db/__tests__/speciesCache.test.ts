import {executeSql, querySql} from '../connection';
import {pruneSpeciesNotIn} from '../speciesCache';

jest.mock('../connection', () => ({
  executeSql: jest.fn().mockResolvedValue(undefined),
  querySql: jest.fn().mockResolvedValue([]),
}));

const mockExecuteSql = executeSql as jest.MockedFunction<typeof executeSql>;
const mockQuerySql = querySql as jest.MockedFunction<typeof querySql>;

const sentencias = () =>
  mockExecuteSql.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').trim());

beforeEach(() => {
  jest.clearAllMocks();
  mockQuerySql.mockResolvedValue([]);
});

describe('pruneSpeciesNotIn', () => {
  it('no borra nada cuando el cache ya coincide con el servidor', async () => {
    await expect(pruneSpeciesNotIn([1, 2, 3])).resolves.toBe(0);

    expect(sentencias().some(sql => sql.startsWith('DELETE FROM species '))).toBe(
      false,
    );
  });

  it('borra las obsoletas y sus referencias en guardadas y vistas', async () => {
    mockQuerySql.mockResolvedValue([{id: 14}, {id: 15}]);

    await expect(pruneSpeciesNotIn([1, 2])).resolves.toBe(2);

    const sqls = sentencias();
    expect(sqls).toContain(
      'DELETE FROM species WHERE id NOT IN (SELECT id FROM species_sync_ids)',
    );
    expect(sqls).toContain(
      'DELETE FROM especies_guardadas WHERE especie_id NOT IN (SELECT id FROM species)',
    );
    expect(sqls).toContain(
      'DELETE FROM especies_vistas WHERE especie_id NOT IN (SELECT id FROM species)',
    );
  });

  // La lista de ids no puede ir como parámetros de una sola sentencia: SQLite
  // los limita y el catálogo crece.
  it('inserta los ids en lotes y limpia la tabla temporal al terminar', async () => {
    const ids = Array.from({length: 450}, (_, i) => i + 1);

    await pruneSpeciesNotIn(ids);

    const inserts = mockExecuteSql.mock.calls.filter(([sql]) =>
      sql.startsWith('INSERT OR IGNORE INTO species_sync_ids'),
    );
    expect(inserts).toHaveLength(3);
    expect(inserts.flatMap(([, params]) => params ?? [])).toEqual(ids);
    expect(sentencias()).toContain('DROP TABLE IF EXISTS temp.species_sync_ids');
  });

  it('acepta una lista vacía sin romper la sentencia de inserción', async () => {
    await pruneSpeciesNotIn([]);

    expect(
      mockExecuteSql.mock.calls.some(([sql]) =>
        sql.startsWith('INSERT OR IGNORE INTO species_sync_ids'),
      ),
    ).toBe(false);
  });
});
