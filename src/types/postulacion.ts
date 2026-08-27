// Espejo del modelo de postulación a curador del backend
// (services/especies-api/include/models/postulacion_curador.hpp).

export type PostulacionEstado = 'pendiente' | 'aprobada' | 'rechazada';

// Lo impone la restricción de la tabla (migración 0005): el texto es la única
// evidencia que el admin tiene para decidir.
export const TEXTO_MAX = 4000;

export interface PostulacionCurador {
  id: number;
  usuario_id: number;
  categoria_id: number;
  texto: string;
  estado: PostulacionEstado;
  revisado_por?: number | null;
  revisado_en?: string | null;
  // Solo viene con las rechazadas: es lo que hay que corregir para reintentar.
  motivo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// `usuario_id` no viaja: el backend lo toma de la identidad verificada y
// descarta lo que mande el cliente.
export interface PostulacionDraft {
  categoria_id: number;
  texto: string;
}

export interface PostulacionListResponse {
  success: boolean;
  data: PostulacionCurador[];
}
