import type {Reino} from './domain';

export type AvistamientoEstado = 'pendiente' | 'aprobado' | 'rechazado';
export type MutationStatus = 'pending' | 'syncing' | 'failed' | 'synced';
export type MutationType = 'create_avistamiento';

export interface AvistamientoDraft {
  especie_id?: number | null;
  reino: Reino;
  nombre_sugerido?: string | null;
  descripcion?: string | null;
  foto_key: string;
  local_photo_path?: string | null;
  geo_lat: number;
  geo_lng: number;
  precision_metros?: number | null;
  observado_en: string;
}

export interface LocalAvistamiento extends AvistamientoDraft {
  local_id: string;
  remote_id?: number | null;
  estado: AvistamientoEstado;
  sync_status: MutationStatus;
  created_at: string;
  updated_at: string;
}

export interface MutationQueueItem<TPayload = unknown> {
  id: string;
  type: MutationType;
  payload: TPayload;
  status: MutationStatus;
  attempts: number;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAvistamientoResponse {
  id: number;
  estado: AvistamientoEstado;
  created_at?: string;
}

