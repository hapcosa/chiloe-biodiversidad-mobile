import {executeSql, querySql} from './connection';

interface ViewedRow {
  especie_id: number;
}

export const markSpeciesViewed = async (especieId: number): Promise<void> => {
  await executeSql(
    'INSERT OR REPLACE INTO especies_vistas (especie_id, visto_en) VALUES (?, ?)',
    [especieId, new Date().toISOString()],
  );
};

export const listViewedSpeciesIds = async (): Promise<Set<number>> => {
  const rows = await querySql<ViewedRow>('SELECT especie_id FROM especies_vistas');
  return new Set(rows.map(row => row.especie_id));
};