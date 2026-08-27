export type InsigniaTipo = 'automatica' | 'rol';
export type InsigniaMetrica =
  | 'encuentros'
  | 'especies_distintas'
  | 'reinos'
  | 'identificado_por_otros';

// Espejo de la tabla `insignias` (migración 0014). El criterio viaja como
// datos —`metrica` + `umbral`— y no como texto interpretado en el cliente.
export interface Insignia {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  criterio: string;
  tipo: InsigniaTipo;
  metrica?: InsigniaMetrica | null;
  umbral?: number | null;
}

// Una insignia ya otorgada. El servidor la manda plana: los campos del
// catálogo junto a los del otorgamiento.
export interface InsigniaOtorgada extends Insignia {
  otorgada_en: string;
  otorgada_por?: number | null;
  motivo?: string | null;
}

export interface InsigniaListResponse<T> {
  success: boolean;
  data: T[];
}
