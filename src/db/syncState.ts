import {executeSql, querySql} from './connection';

interface SyncStateRow {
  value: string;
}

export const setSyncState = async (key: string, value: string): Promise<void> => {
  await executeSql(
    `INSERT INTO sync_state (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [key, value, new Date().toISOString()],
  );
};

export const getSyncState = async (key: string): Promise<string | null> => {
  const rows = await querySql<SyncStateRow>(
    'SELECT value FROM sync_state WHERE key = ? LIMIT 1',
    [key],
  );
  return rows[0]?.value ?? null;
};

