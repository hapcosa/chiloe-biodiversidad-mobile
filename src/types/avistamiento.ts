import type {Reino} from './domain';
import type {GradoIdentificacion} from './identificacion';

export type AvistamientoEstado = 'pendiente' | 'aprobado' | 'rechazado';
// `failed` es un fallo transitorio (sin red, 5xx) y se reintenta; `rejected` es
// definitivo (el servidor rechazó el contenido) y no se reintenta nunca más.
export type MutationStatus =
  | 'pending'
  | 'syncing'
  | 'failed'
  | 'rejected'
  | 'synced';
export type MutationType =
  | 'create_avistamiento'
  | 'create_identificacion'
  | 'retirar_identificacion';

export interface AvistamientoDraft {
  especie_id?: number | null;
  reino: Reino;
  nombre_sugerido?: string | null;
  descripcion?: string | null;
  foto_key?: string | null;
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

// El avistamiento tal como lo devuelve el servidor, con los campos que solo
// existen allá (moderación, grado derivado de las identificaciones).
export interface RemoteAvistamiento {
  id: number;
  especie_id?: number | null;
  reino: Reino;
  nombre_sugerido?: string | null;
  descripcion?: string | null;
  foto_key: string;
  geo_lat: number;
  geo_lng: number;
  precision_metros?: number | null;
  observado_en?: string | null;
  creado_por?: number | null;
  estado: AvistamientoEstado;
  grado_identificacion: GradoIdentificacion;
  moderado_por?: number | null;
  moderado_en?: string | null;
  motivo_rechazo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

