import type {PostulacionCurador, PostulacionEstado} from '../../types/postulacion';
import {puedePostular, ultimaPorCategoria} from '../postulaciones';

const postulacion = (
  id: number,
  categoriaId: number,
  estado: PostulacionEstado,
): PostulacionCurador => ({
  id,
  usuario_id: 1,
  categoria_id: categoriaId,
  texto: 'texto',
  estado,
});

describe('ultimaPorCategoria', () => {
  it('se queda con la más reciente cuando hay varias de la misma categoría', () => {
    const mapa = ultimaPorCategoria([
      postulacion(1, 5, 'rechazada'),
      postulacion(4, 5, 'pendiente'),
    ]);

    expect(mapa.get(5)?.id).toBe(4);
  });

  it('no depende del orden en que venga el listado', () => {
    const mapa = ultimaPorCategoria([
      postulacion(4, 5, 'pendiente'),
      postulacion(1, 5, 'rechazada'),
    ]);

    expect(mapa.get(5)?.id).toBe(4);
  });

  it('mantiene separadas las categorías distintas', () => {
    const mapa = ultimaPorCategoria([
      postulacion(1, 5, 'aprobada'),
      postulacion(2, 6, 'pendiente'),
    ]);

    expect(mapa.get(5)?.estado).toBe('aprobada');
    expect(mapa.get(6)?.estado).toBe('pendiente');
  });
});

describe('puedePostular', () => {
  it('deja postular a quien nunca lo hizo', () => {
    expect(puedePostular(undefined)).toBe(true);
  });

  it('deja reintentar tras un rechazo', () => {
    expect(puedePostular(postulacion(1, 5, 'rechazada'))).toBe(true);
  });

  it('no deja duplicar una pendiente', () => {
    expect(puedePostular(postulacion(1, 5, 'pendiente'))).toBe(false);
  });

  it('no deja postular a lo que ya se cura', () => {
    expect(puedePostular(postulacion(1, 5, 'aprobada'))).toBe(false);
  });
});
