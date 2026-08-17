import {executeSql} from '../connection';
import {clearLocalUserData, ensureLocalDataOwner} from '../localUserData';
import {getSyncState, setSyncState} from '../syncState';

jest.mock('../connection', () => ({
  executeSql: jest.fn().mockResolvedValue(undefined),
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../syncState', () => ({
  getSyncState: jest.fn().mockResolvedValue(null),
  setSyncState: jest.fn().mockResolvedValue(undefined),
}));

const mockExecuteSql = executeSql as jest.MockedFunction<typeof executeSql>;
const mockGetSyncState = getSyncState as jest.Mock;

const borradas = () =>
  mockExecuteSql.mock.calls
    .map(([sql]) => sql.trim())
    .filter(sql => sql.startsWith('DELETE FROM '))
    .map(sql => sql.replace('DELETE FROM ', ''));

// Lo que se borra es exactamente lo personal: el catálogo (`species`) y el
// estado de sincronización se conservan porque son públicos y compartidos.
const PERSONALES = [
  'especies_vistas',
  'especies_guardadas',
  'local_avistamientos',
  'mutation_queue',
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('clearLocalUserData', () => {
  it('borra todas las tablas personales y ninguna más', async () => {
    await clearLocalUserData();

    expect(borradas().sort()).toEqual([...PERSONALES].sort());
  });

  it('suelta la marca de dueño', async () => {
    await clearLocalUserData();

    expect(setSyncState).toHaveBeenCalledWith('local.ownerUserId', '');
  });
});

describe('ensureLocalDataOwner', () => {
  it('no borra nada si los datos ya son del usuario que entra', async () => {
    mockGetSyncState.mockResolvedValueOnce('7');

    await ensureLocalDataOwner(7);

    expect(borradas()).toEqual([]);
    expect(setSyncState).not.toHaveBeenCalled();
  });

  it('borra los datos del usuario anterior al entrar otro', async () => {
    mockGetSyncState.mockResolvedValueOnce('7');

    await ensureLocalDataOwner(9);

    expect(borradas().sort()).toEqual([...PERSONALES].sort());
    expect(setSyncState).toHaveBeenCalledWith('local.ownerUserId', '9');
  });

  // El caso de la app que ya venía instalada: no hay dueño anotado, así que los
  // datos son de procedencia desconocida y no se le muestran a quien entra.
  it('borra también cuando no hay dueño anotado', async () => {
    mockGetSyncState.mockResolvedValueOnce(null);

    await ensureLocalDataOwner(7);

    expect(borradas().sort()).toEqual([...PERSONALES].sort());
    expect(setSyncState).toHaveBeenCalledWith('local.ownerUserId', '7');
  });
});
