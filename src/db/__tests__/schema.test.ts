// El orden de la inicialización no es cosmético: es la diferencia entre una
// instalación limpia y una actualización. `CREATE TABLE IF NOT EXISTS` no toca
// la tabla que ya existe en el teléfono, así que un índice sobre una columna
// recién añadida solo se puede crear después del ALTER que la añade.
import {alterStatements, indexStatements, tableStatements} from '../schema';

const columnasAgregadas = (sentencia: string): string | null =>
  /ADD COLUMN (\w+)/.exec(sentencia)?.[1] ?? null;

const columnasDeIndice = (sentencia: string): string[] =>
  (/\(([^)]*)\)\s*$/.exec(sentencia)?.[1] ?? '')
    .split(',')
    .map(c => c.trim())
    .filter(c => c !== '');

describe('schema', () => {
  it('no crea índices junto a las tablas', () => {
    expect(tableStatements.some(s => s.includes('CREATE INDEX'))).toBe(false);
  });

  it('todo índice sobre una columna añadida por ALTER va en indexStatements', () => {
    const añadidas = alterStatements
      .map(columnasAgregadas)
      .filter((c): c is string => c !== null);

    const enTablas = tableStatements
      .flatMap(columnasDeIndice)
      .filter(c => añadidas.includes(c));

    expect(enTablas).toEqual([]);
    expect(indexStatements.some(s => s.includes('categoria_id'))).toBe(true);
  });
});
