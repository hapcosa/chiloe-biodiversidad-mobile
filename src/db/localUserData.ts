import {executeSql, initializeDatabase} from './connection';
import {getSyncState, setSyncState} from './syncState';

const OWNER_KEY = 'local.ownerUserId';

// Todo lo que es de la persona y no del catálogo. `species` y `sync_state` no
// entran a propósito: son contenido público compartido entre cuentas.
const TABLAS_PERSONALES = [
  'especies_vistas',
  'especies_guardadas',
  // Los encuentros propios, con la ruta de la foto capturada. Sin esto, la
  // siguiente cuenta que entre en el mismo teléfono ve las fotos de la
  // anterior en su perfil.
  'local_avistamientos',
  // La cola arrastra payloads con datos del usuario anterior y, peor, se
  // enviarían con el token del nuevo.
  'mutation_queue',
];

// El progreso ("descubiertas", "guardadas"), los encuentros y la cola offline
// son de la persona: si no se borran al cerrar sesión, la siguiente cuenta que
// entre en el mismo teléfono los hereda.
export const clearLocalUserData = async (): Promise<void> => {
  await initializeDatabase();
  for (const tabla of TABLAS_PERSONALES) {
    await executeSql(`DELETE FROM ${tabla}`);
  }
  await setSyncState(OWNER_KEY, '');
};

// Cinturón además de tirantes: `clearLocalUserData` corre en el logout, pero un
// cierre forzado, un crash o una reinstalación que conserve la base dejarían los
// datos ahí. Al abrir sesión comparamos de quién son los datos locales y, si no
// coinciden con quien entra, se borran antes de mostrar nada.
export const ensureLocalDataOwner = async (userId: number): Promise<void> => {
  await initializeDatabase();

  const owner = await getSyncState(OWNER_KEY);
  if (owner === String(userId)) {
    return;
  }

  // Se borra también cuando no hay dueño anotado: en una app que ya venía
  // instalada eso significa datos de procedencia desconocida, y ante la duda
  // no se los mostramos a quien entra. Solo pasa una vez, al actualizar.
  for (const tabla of TABLAS_PERSONALES) {
    await executeSql(`DELETE FROM ${tabla}`);
  }

  await setSyncState(OWNER_KEY, String(userId));
};
