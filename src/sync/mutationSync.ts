import NetInfo from '@react-native-community/netinfo';
import {avistamientosApi} from '../api';
import {
  listPendingMutations,
  markMutationFailed,
  markMutationSynced,
  markMutationSyncing,
} from '../db/mutationQueue';

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
          const response = await avistamientosApi.create(mutation.payload);
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

