import {speciesApi} from '../../api';
import {pruneSpeciesNotIn, upsertSpecies} from '../../db/speciesCache';
import {getSyncState} from '../../db/syncState';
import {ensureInitialSpeciesSync, runInitialSpeciesSync} from '../initialSync';

jest.mock('../../api', () => ({
  speciesApi: {list: jest.fn()},
}));

jest.mock('../../db/connection', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../db/speciesCache', () => ({
  upsertSpecies: jest.fn().mockResolvedValue(undefined),
  pruneSpeciesNotIn: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../db/syncState', () => ({
  setSyncState: jest.fn().mockResolvedValue(undefined),
  getSyncState: jest.fn().mockResolvedValue(null),
}));

const mockList = speciesApi.list as jest.Mock;
const mockPrune = pruneSpeciesNotIn as jest.Mock;
const mockGetSyncState = getSyncState as jest.Mock;

const species = (id: number) => ({id, nombre_comun: `especie-${id}`});

const pagina = (ids: number[], total: number) => ({
  data: ids.map(species),
  pagination: {total},
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runInitialSpeciesSync', () => {
  it('reconcilia el cache con los ids que devolvió el servidor', async () => {
    mockList.mockResolvedValueOnce(pagina([1, 2, 3], 3));

    await expect(runInitialSpeciesSync()).resolves.toBe(3);
    expect(upsertSpecies).toHaveBeenCalledTimes(1);
    expect(mockPrune).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('junta los ids de todas las páginas antes de podar', async () => {
    mockList
      .mockResolvedValueOnce(pagina([1, 2], 4))
      .mockResolvedValueOnce(pagina([3, 4], 4));

    await expect(runInitialSpeciesSync({pageSize: 2})).resolves.toBe(4);
    expect(mockPrune).toHaveBeenCalledWith([1, 2, 3, 4]);
  });

  it('vacía el cache cuando el servidor no tiene especies', async () => {
    mockList.mockResolvedValueOnce(pagina([], 0));

    await expect(runInitialSpeciesSync()).resolves.toBe(0);
    expect(mockPrune).toHaveBeenCalledWith([]);
  });

  // Lo importante: un barrido incompleto no debe borrar nada. Si la API corta
  // la paginación antes de tiempo, las especies que faltan siguen existiendo.
  it('no poda si el barrido terminó antes de recorrer el total', async () => {
    mockList
      .mockResolvedValueOnce(pagina([1, 2], 10))
      .mockResolvedValueOnce(pagina([], 10));

    await expect(runInitialSpeciesSync({pageSize: 2})).resolves.toBe(2);
    expect(mockPrune).not.toHaveBeenCalled();
  });

  it('no poda si una página falla a mitad del barrido', async () => {
    mockList
      .mockResolvedValueOnce(pagina([1, 2], 4))
      .mockRejectedValueOnce(new Error('sin red'));

    await expect(runInitialSpeciesSync({pageSize: 2})).rejects.toThrow('sin red');
    expect(mockPrune).not.toHaveBeenCalled();
  });

  // `synced` cuenta filas, no ids: si el orden cambia entre páginas una misma
  // especie puede venir dos veces y hacer creer que el barrido terminó.
  it('no poda si las páginas repitieron especies y falta cubrir el total', async () => {
    mockList
      .mockResolvedValueOnce(pagina([1, 2], 4))
      .mockResolvedValueOnce(pagina([2, 3], 4));

    await runInitialSpeciesSync({pageSize: 2});
    expect(mockPrune).not.toHaveBeenCalled();
  });
});

describe('ensureInitialSpeciesSync', () => {
  it('sincroniza si nunca se sincronizó', async () => {
    mockGetSyncState.mockResolvedValueOnce(null);
    mockList.mockResolvedValueOnce(pagina([1, 2], 2));

    await ensureInitialSpeciesSync();
    expect(mockList).toHaveBeenCalled();
  });

  it('no sincroniza si el último barrido es reciente', async () => {
    mockGetSyncState.mockResolvedValueOnce(new Date().toISOString());

    await ensureInitialSpeciesSync();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('vuelve a sincronizar pasado un día', async () => {
    const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    mockGetSyncState.mockResolvedValueOnce(hace2Dias.toISOString());
    mockList.mockResolvedValueOnce(pagina([1], 1));

    await ensureInitialSpeciesSync();
    expect(mockList).toHaveBeenCalled();
  });

  // Es trabajo de fondo del arranque: si revienta, no puede tumbar la sesión.
  it('se traga el error si no hay red', async () => {
    mockGetSyncState.mockResolvedValueOnce(null);
    mockList.mockRejectedValueOnce(new Error('sin red'));

    await expect(ensureInitialSpeciesSync()).resolves.toBeUndefined();
  });
});
