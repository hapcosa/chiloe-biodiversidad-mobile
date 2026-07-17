export type Reino = 'animalia' | 'plantae' | 'fungi' | 'protista' | 'monera';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {[key: string]: JsonValue};

export interface Species {
  id: number;
  reino: Reino;
  genero_id: number;
  nombre_cientifico: string;
  nombre_comun: string;
  autor_cientifico?: string;
  descripcion: string;
  habitat: string;
  distribucion_chiloe: string;
  endemica: boolean;
  estado_conservacion: string;
  fuentes: JsonValue[];
  geo_lat?: number | null;
  geo_lng?: number | null;
  atributos_especificos: {[key: string]: JsonValue};
  foto_portada_key?: string | null;
  fotos_keys: string[];
  creado_por?: number | null;
  revisado_por?: number | null;
  fecha_revision?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  imagenes_urls: string[];
  genero_nombre?: string;
}

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export interface SpeciesListResponse {
  success: boolean;
  data: Species[];
  pagination: Pagination;
  message?: string;
}

export interface SpeciesFilters {
  reino?: Reino;
  genero_id?: number;
  familia_id?: number;
  conservacion?: string;
  endemica?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
  orderby?: string;
  orderdir?: 'asc' | 'desc';
}

export type UserRole = 'admin' | 'moderator' | 'researcher' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface UserPublic {
  id: number;
  email: string;
  name: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  provider: string;
  email_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: UserPublic;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface StoredSession {
  user: UserPublic;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
