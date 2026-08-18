import {initializeDatabase} from './connection';
import {getSyncState, setSyncState} from './syncState';

// Va en `sync_state` y no en las tablas personales a propósito: el aviso es de
// la instalación, no de la cuenta. Cerrar sesión no debe volver a mostrarlo.
const CLAVE = 'bienvenida_vista';

export const haVistoBienvenida = async (): Promise<boolean> => {
  await initializeDatabase();
  return (await getSyncState(CLAVE)) === 'true';
};

export const marcarBienvenidaVista = async (): Promise<void> => {
  await initializeDatabase();
  await setSyncState(CLAVE, 'true');
};
