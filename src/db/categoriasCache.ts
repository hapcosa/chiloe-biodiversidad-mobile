import {getSyncState, setSyncState} from './syncState';
import type {Categoria} from '../types/domain';

const CLAVE = 'categorias';

// Mismo criterio que `portadaCache`: la lista de subgrupos es de solo lectura,
// se reemplaza entera y nadie la consulta por partes, así que va como un blob
// en `sync_state` en vez de una tabla propia.
//
// Cachearla no es un lujo: sin ella, abrir la app sin señal deja la biblioteca
// con el filtro por reino pero sin subgrupos, que es peor que no tenerlos —
// aparecen y desaparecen según la red.
export const saveCachedCategorias = async (
  categorias: Categoria[],
): Promise<void> => {
  await setSyncState(CLAVE, JSON.stringify(categorias));
};

export const getCachedCategorias = async (): Promise<Categoria[]> => {
  const raw = await getSyncState(CLAVE);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Una versión vieja pudo guardar otra forma; se descarta lo que no sirva en
    // vez de dejar que reviente al pintar los chips.
    return parsed.filter(
      (item): item is Categoria =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Categoria).id === 'number' &&
        typeof (item as Categoria).nombre === 'string' &&
        typeof (item as Categoria).reino === 'string',
    );
  } catch {
    return [];
  }
};
