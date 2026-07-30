import NetInfo from '@react-native-community/netinfo';
import {avistamientosApi} from '../api';
import {ApiError} from '../api/errors';
import {
  listPendingMutations,
  markMutationFailed,
  markMutationRejected,
  markMutationSynced,
  markMutationSyncing,
} from '../db/mutationQueue';
import {uploadLocalPhoto} from '../native/photoUpload';

let isSyncing = false;

// Un 4xx significa que el servidor entendió la petición y la rechazó: mandarla
// otra vez idéntica da el mismo resultado, así que reintentar solo gasta batería
// y deja la mutación atascada para siempre. Las excepciones son las que sí
// cambian con el tiempo: 401 (el token se renueva al volver a entrar), 408 y 429
// (timeout y límite de tasa).
const RETRYABLE_CLIENT_ERRORS = new Set([401, 408, 429]);

const isPermanentRejection = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  !RETRYABLE_CLIENT_ERRORS.has(error.status);

export const syncPendingMutations = async (): Promise<number> => {
  if (isSyncing) {
    return 0;
  }

  isSyncing = true;
  let synced = 0;

  try {
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected || networkState.isInternetReachable === false) {
      return 0;
    }

    const mutations = await listPendingMutations();
    for (const mutation of mutations) {
      try {
        await markMutationSyncing(mutation.id);

        if (mutation.type === 'create_avistamiento') {
          let draft = mutation.payload;
          // La foto se sube recién acá (con red garantizada), no al crear
          // el encuentro offline: así el guardado nunca depende de red.
          if (!draft.foto_key && draft.local_photo_path) {
            const fotoKey = await uploadLocalPhoto(draft.local_photo_path, 'avistamientos-fotos');
            draft = {...draft, foto_key: fotoKey};
          }

          const response = await avistamientosApi.create(draft);
          await markMutationSynced(mutation.id, response.id);
          synced += 1;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error de sincronización';

        if (isPermanentRejection(error)) {
          await markMutationRejected(mutation.id, message);
        } else {
          await markMutationFailed(mutation.id, message);
        }
      }
    }
  } finally {
    isSyncing = false;
  }

  return synced;
};

export const startMutationSyncWorker = (): (() => void) =>
  NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void syncPendingMutations();
    }
  });

