import {speciesApi} from '../api';
import {initializeDatabase} from '../db/connection';
import {pruneSpeciesNotIn, upsertSpecies} from '../db/speciesCache';
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
  const idsVistos = new Set<number>();

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
    for (const species of response.data) {
      idsVistos.add(species.id);
    }

    synced += response.data.length;
    offset += response.data.length;
    options.onProgress?.(synced, total);

    if (response.data.length === 0) {
      break;
    }
  } while (synced < total);

  // Solo reconciliamos si el barrido llegó hasta el final: con un recorrido
  // parcial (página vacía antes de tiempo) borraríamos especies que sí
  // existen. Se compara contra los ids únicos porque un cambio de orden entre
  // páginas puede repetir filas e inflar `synced`.
  if (idsVistos.size >= total) {
    await pruneSpeciesNotIn([...idsVistos]);
  }

  await setSyncState('species.initialSyncAt', new Date().toISOString());
  return synced;
};
