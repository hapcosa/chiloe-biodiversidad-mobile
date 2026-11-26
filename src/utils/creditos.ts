import type {CreditoFoto} from '../types/domain';

// Las únicas licencias que acepta el backend (ADR #28). iNaturalist usa la 4.0.
const LICENCIAS: {[codigo: string]: {nombre: string; url: string}} = {
  cc0: {nombre: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/'},
  'cc-by': {nombre: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/'},
  'cc-by-sa': {nombre: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/'},
};

// Una licencia desconocida se muestra tal cual y sin enlace: mejor que
// atribuirle una que nadie verificó.
export const licenciaDe = (codigo: string): {nombre: string; url: string | null} =>
  LICENCIAS[codigo] ?? {nombre: codigo, url: null};

export const enlaceSeguro = (url: string | null | undefined): string | null =>
  url && url.startsWith('https://') ? url : null;

// La app recibe URLs resueltas y los créditos vienen indexados por key; la URL
// pública siempre termina en `/<key>`.
export const creditoDeUrl = (
  url: string,
  creditos: {[key: string]: CreditoFoto} | undefined,
): CreditoFoto | undefined =>
  Object.entries(creditos ?? {}).find(([key]) => url.endsWith(`/${key}`))?.[1];
