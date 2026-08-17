import {speciesApi} from '../api';
import {initializeDatabase} from '../db/connection';
import {pruneSpeciesNotIn, upsertSpecies} from '../db/speciesCache';
import {getSyncState, setSyncState} from '../db/syncState';

const INITIAL_SYNC_KEY = 'species.initialSyncAt';

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

  await setSyncState(INITIAL_SYNC_KEY, new Date().toISOString());
  return synced;
};

const MAX_EDAD_SYNC_MS = 24 * 60 * 60 * 1000;

// El cache local solo se llenaba con lo que cada pantalla pedía de paso (el
// Home trae una especie por reino), así que el contador de la biblioteca
// mostraba una fracción del catálogo hasta que el usuario apretara
// "Sincronizar" en Perfil. Esto lo dispara al arrancar la sesión, y lo repite
// pasado un día para que el catálogo que crece en el servidor no quede
// congelado. Si falla no propaga: es trabajo de fondo y las pantallas siguen
// leyendo de la API.
export const ensureInitialSpeciesSync = async (): Promise<void> => {
  await initializeDatabase();

  const ultimo = await getSyncState(INITIAL_SYNC_KEY);
  if (ultimo) {
    const edad = Date.now() - new Date(ultimo).getTime();
    // `edad` es NaN si el valor guardado no parsea; en ese caso resincronizamos.
    if (edad >= 0 && edad < MAX_EDAD_SYNC_MS) {
      return;
    }
  }

  try {
    await runInitialSpeciesSync();
  } catch {
    // Sin red o backend caído: se reintenta en el próximo arranque.
  }
};
