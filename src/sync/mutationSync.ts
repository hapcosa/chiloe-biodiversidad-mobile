import NetInfo from '@react-native-community/netinfo';
import {avistamientosApi, identificacionesApi} from '../api';
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

        if (mutation.type === 'create_identificacion') {
          await identificacionesApi.create(mutation.payload);
          await markMutationSynced(mutation.id, null);
          synced += 1;
        }

        if (mutation.type === 'retirar_identificacion') {
          await identificacionesApi.retirar(
            mutation.payload.avistamiento_id,
            mutation.payload.identificacion_id,
          );
          await markMutationSynced(mutation.id, null);
          synced += 1;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error de sincronización';

        // Retirar es idempotente desde el punto de vista del usuario: si el
        // servidor dice que ya está retirada (409) o que no existe (404), el
        // estado que se pidió ya es el actual. Marcarlo como rechazado dejaría
        // un error visible por algo que salió bien.
        if (
          mutation.type === 'retirar_identificacion' &&
          error instanceof ApiError &&
          (error.status === 404 || error.status === 409)
        ) {
          await markMutationSynced(mutation.id, null);
          continue;
        }

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

