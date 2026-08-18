import {haVistoBienvenida, marcarBienvenidaVista} from '../bienvenida';
import {executeSql, querySql} from '../connection';

jest.mock('../connection', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  executeSql: jest.fn().mockResolvedValue(undefined),
  querySql: jest.fn().mockResolvedValue([]),
}));

const mockExecuteSql = executeSql as jest.MockedFunction<typeof executeSql>;
const mockQuerySql = querySql as jest.MockedFunction<typeof querySql>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('bienvenida', () => {
  it('no la da por vista si no hay marca', async () => {
    mockQuerySql.mockResolvedValueOnce([]);
    await expect(haVistoBienvenida()).resolves.toBe(false);
  });

  it('la da por vista cuando la marca está guardada', async () => {
    mockQuerySql.mockResolvedValueOnce([{value: 'true'}]);
    await expect(haVistoBienvenida()).resolves.toBe(true);
  });

  it('guarda la marca en sync_state, que no se borra al cerrar sesión', async () => {
    await marcarBienvenidaVista();

    const [sql, params] = mockExecuteSql.mock.calls[0] ?? [];
    expect(sql).toContain('INSERT INTO sync_state');
    expect(params?.[0]).toBe('bienvenida_vista');
    expect(params?.[1]).toBe('true');
  });
});
