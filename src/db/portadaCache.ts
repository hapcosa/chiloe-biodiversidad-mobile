import {getSyncState, setSyncState} from './syncState';
import type {Portada} from '../types/portada';

const CLAVE = 'portada';

// La portada se guarda entera como un blob en `sync_state` y no en tablas
// propias: es solo lectura, se reemplaza completa en cada carga y nadie la
// consulta por partes. Tres tablas nuevas para eso serían tres migraciones que
// mantener sin ganar nada.
//
// Ojo con las `foto_url`: son URLs firmadas y caducan. Al abrir sin red las
// tarjetas guardadas se ven con su texto pero las imágenes pueden no cargar.
// Es un fallback deliberado, no una biblioteca offline: esa es `speciesCache`.
export const saveCachedPortada = async (portada: Portada): Promise<void> => {
  await setSyncState(CLAVE, JSON.stringify(portada));
};

export const getCachedPortada = async (): Promise<Portada | null> => {
  const raw = await getSyncState(CLAVE);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Portada>;
    // Una versión vieja de la app pudo guardar otra forma; se descarta en vez
    // de dejar que reviente al pintar.
    if (
      !Array.isArray(parsed.ultimas_publicadas) ||
      !Array.isArray(parsed.ultimas_ediciones) ||
      !Array.isArray(parsed.ultimos_encuentros)
    ) {
      return null;
    }
    return parsed as Portada;
  } catch {
    return null;
  }
};
