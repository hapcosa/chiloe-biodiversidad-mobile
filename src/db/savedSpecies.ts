import {executeSql, querySql} from './connection';

interface SavedRow {
  especie_id: number;
}

export const saveSpecies = async (especieId: number): Promise<void> => {
  await executeSql(
    'INSERT OR REPLACE INTO especies_guardadas (especie_id, guardado_en) VALUES (?, ?)',
    [especieId, new Date().toISOString()],
  );
};

export const unsaveSpecies = async (especieId: number): Promise<void> => {
  await executeSql('DELETE FROM especies_guardadas WHERE especie_id = ?', [especieId]);
};

export const listSavedSpeciesIds = async (): Promise<Set<number>> => {
  const rows = await querySql<SavedRow>('SELECT especie_id FROM especies_guardadas');
  return new Set(rows.map(row => row.especie_id));
};
