import {executeSql, initializeDatabase} from './connection';

// El progreso ("descubiertas", "guardadas") es de la persona, no del catálogo:
// si no se borra al cerrar sesión, la siguiente cuenta que entre en el mismo
// teléfono hereda las marcas de la anterior. La cache de `species` sí se
// conserva a propósito: es contenido público y compartido.
export const clearLocalUserData = async (): Promise<void> => {
  await initializeDatabase();
  await executeSql('DELETE FROM especies_vistas');
  await executeSql('DELETE FROM especies_guardadas');
};
