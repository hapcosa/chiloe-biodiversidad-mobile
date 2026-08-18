import {open} from 'react-native-quick-sqlite';
import {alterStatements, schemaStatements} from './schema';

type SqlValue = string | number | null;

interface QueryResult {
  rows?: {
    _array?: unknown[];
    length?: number;
    item?: (index: number) => unknown;
  };
}

const database = open({name: 'chiloe-biodiversidad.db'});

const rowsToArray = <T>(rows: QueryResult['rows']): T[] => {
  if (!rows) {
    return [];
  }

  if (Array.isArray(rows._array)) {
    return rows._array as T[];
  }

  if (typeof rows.length === 'number' && typeof rows.item === 'function') {
    return Array.from({length: rows.length}, (_, index) => rows.item!(index) as T);
  }

  return [];
};

export const executeSql = async (
  sql: string,
  params: SqlValue[] = [],
): Promise<QueryResult> => Promise.resolve(database.execute(sql, params) as QueryResult);

export const querySql = async <T>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> => {
  const result = await executeSql(sql, params);
  return rowsToArray<T>(result.rows);
};

export const initializeDatabase = async (): Promise<void> => {
  for (const statement of schemaStatements) {
    await executeSql(statement);
  }
  for (const statement of alterStatements) {
    try {
      await executeSql(statement);
    } catch {
      // Ya aplicada: SQLite no sabe decir "ADD COLUMN IF NOT EXISTS" y falla
      // con "duplicate column name". Ver alterStatements en schema.ts.
    }
  }
};

