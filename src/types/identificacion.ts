// Espejo del modelo de identificación comunitaria del backend
// (services/especies-api/include/models/identificacion.hpp).

// Lo deriva el servidor de las identificaciones vigentes; el cliente nunca lo
// envía.
export type GradoIdentificacion =
  | 'sin_identificar'
  | 'en_discusion'
  | 'investigacion';

export interface Identificacion {
  id: number;
  avistamiento_id: number;
  usuario_id: number;
  especie_id: number;
  comentario?: string | null;
  // La marcó un curador de la categoría de esa especie: cierra el avistamiento
  // sin esperar quórum.
  decisiva: boolean;
  retirada: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

// Lo que manda el cliente. `avistamiento_id` va en la ruta, pero viaja en el
// payload encolado para poder reconstruir la petición al sincronizar.
export interface IdentificacionDraft {
  avistamiento_id: number;
  especie_id: number;
  comentario?: string | null;
}

// Retirar es una baja lógica sobre una identificación que ya viajó, así que a
// diferencia del alta necesita el id remoto además del avistamiento.
export interface RetiroIdentificacionDraft {
  avistamiento_id: number;
  identificacion_id: number;
}

export interface IdentificacionListResponse {
  success: boolean;
  data: Identificacion[];
}
