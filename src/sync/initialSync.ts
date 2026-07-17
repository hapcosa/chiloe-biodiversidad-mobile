import {speciesApi} from '../api';
import {initializeDatabase} from '../db/connection';
import {upsertSpecies} from '../db/speciesCache';
import {setSyncState} from '../db/syncState';

interface InitialSyncOptions {
  pageSize?: number;
  onProgress?: (synced: number, total: number) => void;
}

export const runInitialSpeciesSync = async (
  options: InitialSyncOptions = {},
): Promise<number> => {
  const pageSize = options.pageSize ?? 100;
  let offset = 0;
  let total = 0;
  let synced = 0;

  await initializeDatabase();

  do {
    const response = await speciesApi.list({
      limit: pageSize,
      offset,
      orderby: 'nombre_comun',
      orderdir: 'asc',
    });

    total = response.pagination.total;
    await upsertSpecies(response.data);

    synced += response.data.length;
    offset += response.data.length;
    options.onProgress?.(synced, total);

    if (response.data.length === 0) {
      break;
    }
  } while (synced < total);

  await setSyncState('species.initialSyncAt', new Date().toISOString());
  return synced;
};

