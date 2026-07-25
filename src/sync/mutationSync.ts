import NetInfo from '@react-native-community/netinfo';
import {avistamientosApi} from '../api';
import {
  listPendingMutations,
  markMutationFailed,
  markMutationSynced,
  markMutationSyncing,
} from '../db/mutationQueue';
import {uploadLocalPhoto} from '../native/photoUpload';

let isSyncing = false;

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
        await markMutationFailed(
          mutation.id,
          error instanceof Error ? error.message : 'Error de sincronización',
        );
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

