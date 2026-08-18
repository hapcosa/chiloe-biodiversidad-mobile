// Textos de los avisos de observación responsable. Viven todos aquí para que
// curaduría los pueda revisar y corregir sin recorrer las pantallas.
import type {Reino} from '../types/domain';

export const AVISO_FAUNA_FICHA = {
  titulo: 'Observa sin molestar',
  puntos: [
    'No te acerques ni persigas al animal para fotografiarlo.',
    'No lo alimentes: cambia su conducta y su dieta.',
    'No uses reclamos ni grabaciones para atraerlo.',
    'Mantén distancia y a tus perros con correa.',
    'Si el animal cambia de conducta por tu presencia, ya estás demasiado cerca.',
  ],
} as const;

export const AVISO_FAUNA_ENCUENTRO =
  'Antes de guardar: si para conseguir esta observación te acercaste, ' +
  'perseguiste o llamaste al animal, la próxima vez basta con mirar desde lejos.';

export const BIENVENIDA = {
  titulo: 'Una guía de campo para mirar, no para cazar',
  parrafos: [
    'Esta app es para reconocer la biodiversidad de Chiloé mientras recorres ' +
      'parques, senderos y miradores habilitados, donde el paso humano ya está ' +
      'definido y el daño al hábitat es menor.',
    'No la uses como excusa para salir a batir bosque, pisar nidos o buscar ' +
      'madrigueras. Lo que no se encuentra en el sendero también cuenta como ' +
      'un buen día de campo.',
    'Tus encuentros son privados por defecto. Compartirlos con la comunidad ' +
      'es siempre una decisión tuya.',
  ],
  boton: 'Entendido, a observar',
} as const;

/**
 * El aviso de fauna es para los animales: son los únicos que huyen, se
 * estresan o abandonan una nidada porque alguien se acercó demasiado.
 */
export const requiereAvisoFauna = (reino: Reino): boolean => reino === 'animalia';
