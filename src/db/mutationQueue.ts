import type {
  AvistamientoDraft,
  LocalAvistamiento,
  MutationQueueItem,
  MutationStatus,
} from '../types/avistamiento';
import {executeSql, initializeDatabase, querySql} from './connection';

interface MutationQueueRow {
  id: string;
  type: 'create_avistamiento';
  payload: string;
  status: MutationStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface LocalAvistamientoRow {
  local_id: string;
  remote_id: number | null;
  especie_id: number | null;
  reino: LocalAvistamiento['reino'];
  nombre_sugerido: string | null;
  descripcion: string | null;
  foto_key: string;
  local_photo_path: string | null;
  geo_lat: number;
  geo_lng: number;
  precision_metros: number | null;
  observado_en: string;
  estado: LocalAvistamiento['estado'];
  sync_status: MutationStatus;
  created_at: string;
  updated_at: string;
}

const makeLocalId = (): string =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const parsePayload = <T>(payload: string): T => JSON.parse(payload) as T;

const rowToMutation = <T>(row: MutationQueueRow): MutationQueueItem<T> => ({
  id: row.id,
  type: row.type,
  payload: parsePayload<T>(row.payload),
  status: row.status,
  attempts: row.attempts,
  last_error: row.last_error,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const rowToLocalAvistamiento = (row: LocalAvistamientoRow): LocalAvistamiento => ({
  local_id: row.local_id,
  remote_id: row.remote_id,
  especie_id: row.especie_id,
  reino: row.reino,
  nombre_sugerido: row.nombre_sugerido,
  descripcion: row.descripcion,
  foto_key: row.foto_key,
  local_photo_path: row.local_photo_path,
  geo_lat: row.geo_lat,
  geo_lng: row.geo_lng,
  precision_metros: row.precision_metros,
  observado_en: row.observado_en,
  estado: row.estado,
  sync_status: row.sync_status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const enqueueAvistamiento = async (
  draft: AvistamientoDraft,
): Promise<LocalAvistamiento> => {
  await initializeDatabase();

  const now = new Date().toISOString();
  const localId = makeLocalId();
  const localAvistamiento: LocalAvistamiento = {
    ...draft,
    local_id: localId,
    remote_id: null,
    estado: 'pendiente',
    sync_status: 'pending',
    created_at: now,
    updated_at: now,
  };

  await executeSql(
    `INSERT INTO local_avistamientos (
      local_id, remote_id, especie_id, reino, nombre_sugerido, descripcion,
      foto_key, local_photo_path, geo_lat, geo_lng, precision_metros,
      observado_en, estado, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      localAvistamiento.local_id,
      localAvistamiento.remote_id ?? null,
      localAvistamiento.especie_id ?? null,
      localAvistamiento.reino,
      localAvistamiento.nombre_sugerido ?? null,
      localAvistamiento.descripcion ?? null,
      localAvistamiento.foto_key,
      localAvistamiento.local_photo_path ?? null,
      localAvistamiento.geo_lat,
      localAvistamiento.geo_lng,
      localAvistamiento.precision_metros ?? null,
      localAvistamiento.observado_en,
      localAvistamiento.estado,
      localAvistamiento.sync_status,
      localAvistamiento.created_at,
      localAvistamiento.updated_at,
    ],
  );

  await executeSql(
    `INSERT INTO mutation_queue (
      id, type, payload, status, attempts, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      localId,
      'create_avistamiento',
      JSON.stringify({...draft, local_id: localId}),
      'pending',
      0,
      null,
      now,
      now,
    ],
  );

  return localAvistamiento;
};

export const listPendingMutations = async (
  limit = 20,
): Promise<Array<MutationQueueItem<AvistamientoDraft & {local_id: string}>>> => {
  await initializeDatabase();

  const rows = await querySql<MutationQueueRow>(
    `SELECT * FROM mutation_queue
     WHERE status IN ('pending', 'failed', 'syncing')
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );

  return rows.map(row => rowToMutation<AvistamientoDraft & {local_id: string}>(row));
};

export const markMutationSyncing = async (id: string): Promise<void> => {
  const now = new Date().toISOString();
  await executeSql(
    `UPDATE mutation_queue
     SET status = 'syncing', updated_at = ?
     WHERE id = ?`,
    [now, id],
  );
  await executeSql(
    `UPDATE local_avistamientos
     SET sync_status = 'syncing', updated_at = ?
     WHERE local_id = ?`,
    [now, id],
  );
};

export const markMutationSynced = async (
  id: string,
  remoteId: number,
): Promise<void> => {
  const now = new Date().toISOString();
  await executeSql(
    `UPDATE mutation_queue
     SET status = 'synced', last_error = NULL, updated_at = ?
     WHERE id = ?`,
    [now, id],
  );
  await executeSql(
    `UPDATE local_avistamientos
     SET remote_id = ?, sync_status = 'synced', updated_at = ?
     WHERE local_id = ?`,
    [remoteId, now, id],
  );
};

export const markMutationFailed = async (
  id: string,
  errorMessage: string,
): Promise<void> => {
  const now = new Date().toISOString();
  await executeSql(
    `UPDATE mutation_queue
     SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ?
     WHERE id = ?`,
    [errorMessage, now, id],
  );
  await executeSql(
    `UPDATE local_avistamientos
     SET sync_status = 'failed', updated_at = ?
     WHERE local_id = ?`,
    [now, id],
  );
};

export const listLocalAvistamientos = async (): Promise<LocalAvistamiento[]> => {
  await initializeDatabase();
  const rows = await querySql<LocalAvistamientoRow>(
    'SELECT * FROM local_avistamientos ORDER BY created_at DESC',
  );
  return rows.map(rowToLocalAvistamiento);
};
