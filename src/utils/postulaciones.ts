import type {PostulacionCurador} from '../types/postulacion';

/**
 * La postulación vigente de cada categoría. Tras un rechazo se puede volver a
 * postular (índice único parcial de la migración 0005), así que una misma
 * categoría acumula varias y solo la última describe la situación actual.
 * El id sirve de orden porque es un SERIAL: crece con el tiempo aunque dos
 * postulaciones compartan fecha.
 */
export const ultimaPorCategoria = (
  postulaciones: PostulacionCurador[],
): Map<number, PostulacionCurador> => {
  const porCategoria = new Map<number, PostulacionCurador>();
  for (const postulacion of postulaciones) {
    const previa = porCategoria.get(postulacion.categoria_id);
    if (!previa || previa.id < postulacion.id) {
      porCategoria.set(postulacion.categoria_id, postulacion);
    }
  }
  return porCategoria;
};

/**
 * Con una pendiente el servidor devolvería 400 por el índice único, y con una
 * aprobada ya se es curador: en ninguno de los dos casos tiene sentido dejar
 * postular de nuevo.
 */
export const puedePostular = (previa: PostulacionCurador | undefined): boolean =>
  previa === undefined || previa.estado === 'rechazada';
