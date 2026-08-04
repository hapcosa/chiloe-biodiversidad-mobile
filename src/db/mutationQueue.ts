import type {
  AvistamientoDraft,
  LocalAvistamiento,
  MutationQueueItem,
  MutationStatus,
  MutationType,
} from '../types/avistamiento';
import type {IdentificacionDraft} from '../types/identificacion';
import {executeSql, initializeDatabase, querySql} from './connection';

interface MutationQueueRow {
  id: string;
  type: MutationType;
  payload: string;
  status: MutationStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type AvistamientoMutation = MutationQueueItem<
  AvistamientoDraft & {local_id: string}
> & {type: 'create_avistamiento'};

export type IdentificacionMutation = MutationQueueItem<IdentificacionDraft> & {
  type: 'create_identificacion';
};

export type PendingMutation = AvistamientoMutation | IdentificacionMutation;

interface LocalAvistamientoRow {
  local_id: string;
  remote_id: number | null;
  especie_id: number | null;
  reino: LocalAvistamiento['reino'];
  nombre_sugerido: string | null;
  descripcion: string | null;
  foto_key: string | null;
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

const rowToPendingMutation = (row: MutationQueueRow): PendingMutation =>
  row.type === 'create_identificacion'
    ? {...rowToMutation<IdentificacionDraft>(row), type: 'create_identificacion'}
    : {
        ...rowToMutation<AvistamientoDraft & {local_id: string}>(row),
        type: 'create_avistamiento',
      };

const rowToLocalAvistamiento =(row: LocalAvistamientoRow): LocalAvistamiento => ({
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
      localAvistamiento.foto_key ?? null,
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

// La identificación no tiene tabla local propia: mientras espera red vive solo
// en la cola, y la pantalla de detalle la lee de ahí para mostrarla junto a las
// que ya viajaron (ver listPendingIdentificaciones).
export const enqueueIdentificacion = async (
  draft: IdentificacionDraft,
): Promise<IdentificacionMutation> => {
  await initializeDatabase();

  const now = new Date().toISOString();
  const id = makeLocalId();
  const payload: IdentificacionDraft = {
    avistamiento_id: draft.avistamiento_id,
    especie_id: draft.especie_id,
    comentario: draft.comentario ?? null,
  };

  await executeSql(
    `INSERT INTO mutation_queue (
      id, type, payload, status, attempts, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, 'create_identificacion', JSON.stringify(payload), 'pending', 0, null, now, now],
  );

  return {
    id,
    type: 'create_identificacion',
    payload,
    status: 'pending',
    attempts: 0,
    last_error: null,
    created_at: now,
    updated_at: now,
  };
};

export const listPendingMutations = async (
  limit = 20,
): Promise<PendingMutation[]> => {
  await initializeDatabase();

  const rows = await querySql<MutationQueueRow>(
    `SELECT * FROM mutation_queue
     WHERE status IN ('pending', 'failed', 'syncing')
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );

  return rows.map(rowToPendingMutation);
};

// Incluye las 'rejected' a propósito: si el servidor rechazó la sugerencia, el
// usuario tiene que enterarse en la misma pantalla donde la escribió.
export const listPendingIdentificaciones = async (
  avistamientoId: number,
): Promise<IdentificacionMutation[]> => {
  await initializeDatabase();

  const rows = await querySql<MutationQueueRow>(
    `SELECT * FROM mutation_queue
     WHERE type = 'create_identificacion' AND status != 'synced'
     ORDER BY created_at ASC`,
  );

  // El avistamiento va dentro del payload JSON, así que el filtro es en JS:
  // un LIKE sobre el texto serializado confundiría 12 con 120.
  return rows
    .map(rowToPendingMutation)
    .filter(
      (mutation): mutation is IdentificacionMutation =>
        mutation.type === 'create_identificacion' &&
        mutation.payload.avistamiento_id === avistamientoId,
    );
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

// remoteId es null para las mutaciones que no crean un avistamiento local
// (identificaciones): no hay fila que enlazar.
export const markMutationSynced = async (
  id: string,
  remoteId: number | null,
): Promise<void> => {
  const now = new Date().toISOString();
  await executeSql(
    `UPDATE mutation_queue
     SET status = 'synced', last_error = NULL, updated_at = ?
     WHERE id = ?`,
    [now, id],
  );

  if (remoteId === null) {
    return;
  }

  await executeSql(
    `UPDATE local_avistamientos
     SET remote_id = ?, sync_status = 'synced', updated_at = ?
     WHERE local_id = ?`,
    [remoteId, now, id],
  );
};

// El UPDATE de local_avistamientos no afecta a ninguna fila cuando la mutación
// es una identificación (no tiene avistamiento local); el estado que importa
// queda en mutation_queue.
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

// Para errores que reintentar no va a arreglar (el servidor rechazó el
// contenido). Queda fuera de listPendingMutations, así que el worker no vuelve
// a tocarlo; el registro se conserva para poder mostrárselo al usuario.
export const markMutationRejected = async (
  id: string,
  errorMessage: string,
): Promise<void> => {
  const now = new Date().toISOString();
  await executeSql(
    `UPDATE mutation_queue
     SET status = 'rejected', attempts = attempts + 1, last_error = ?, updated_at = ?
     WHERE id = ?`,
    [errorMessage, now, id],
  );
  await executeSql(
    `UPDATE local_avistamientos
     SET sync_status = 'rejected', updated_at = ?
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
