import type {Insignia, InsigniaOtorgada} from '../types/insignia';

// El ícono es cosa del cliente: el servidor manda códigos estables y acá se
// decide cómo se ven. Un código desconocido —una insignia añadida al catálogo
// después de publicar esta versión— cae en el genérico y se muestra igual.
const emojiPorCodigo: Record<string, string> = {
  'primer-encuentro': '🌱',
  observador: '👀',
  constante: '🧭',
  curioso: '🔎',
  coleccionista: '📚',
  'tres-reinos': '🌗',
  'cinco-reinos': '🌈',
  'en-comunidad': '🤝',
  moderador: '🛡️',
  curador: '🔬',
  administrador: '⚙️',
};

export const insigniaEmoji = (codigo: string): string =>
  emojiPorCodigo[codigo] ?? '🏅';

// Las que faltan por ganar, en el orden en que vino el catálogo. Se muestran
// apagadas con su criterio: sin esto una insignia solo se descubre al
// obtenerla, y el criterio es justamente lo que orienta.
export const insigniasPendientes = (
  catalogo: Insignia[],
  ganadas: InsigniaOtorgada[],
): Insignia[] => {
  const obtenidas = new Set(ganadas.map(insignia => insignia.codigo));
  return catalogo.filter(
    insignia =>
      !obtenidas.has(insignia.codigo) &&
      // Las de rol no se "ganan": las otorga un admin. Listarlas como
      // pendientes sugeriría que hay algo que hacer para conseguirlas.
      insignia.tipo === 'automatica',
  );
};
