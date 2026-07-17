import type {Reino, Species, SpeciesFilters} from '../types/domain';
import {executeSql, querySql} from './connection';

interface SpeciesRow {
  id: number;
  reino: Reino;
  genero_id: number;
  nombre_cientifico: string;
  nombre_comun: string;
  autor_cientifico: string | null;
  descripcion: string;
  habitat: string;
  distribucion_chiloe: string;
  endemica: number;
  estado_conservacion: string;
  fuentes: string;
  geo_lat: number | null;
  geo_lng: number | null;
  atributos_especificos: string;
  foto_portada_key: string | null;
  fotos_keys: string;
  creado_por: number | null;
  revisado_por: number | null;
  fecha_revision: string | null;
  created_at: string | null;
  updated_at: string | null;
  imagenes_urls: string;
  genero_nombre: string | null;
}

const stringify = (value: unknown): string => JSON.stringify(value ?? null);

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const rowToSpecies = (row: SpeciesRow): Species => ({
  id: row.id,
  reino: row.reino,
  genero_id: row.genero_id,
  nombre_cientifico: row.nombre_cientifico,
  nombre_comun: row.nombre_comun,
  autor_cientifico: row.autor_cientifico ?? undefined,
  descripcion: row.descripcion,
  habitat: row.habitat,
  distribucion_chiloe: row.distribucion_chiloe,
  endemica: row.endemica === 1,
  estado_conservacion: row.estado_conservacion,
  fuentes: parseJson(row.fuentes, []),
  geo_lat: row.geo_lat,
  geo_lng: row.geo_lng,
  atributos_especificos: parseJson(row.atributos_especificos, {}),
  foto_portada_key: row.foto_portada_key,
  fotos_keys: parseJson(row.fotos_keys, []),
  creado_por: row.creado_por,
  revisado_por: row.revisado_por,
  fecha_revision: row.fecha_revision,
  created_at: row.created_at,
  updated_at: row.updated_at,
  imagenes_urls: parseJson(row.imagenes_urls, []),
  genero_nombre: row.genero_nombre ?? undefined,
});

export const upsertSpecies = async (speciesList: Species[]): Promise<void> => {
  for (const species of speciesList) {
    await executeSql(
      `INSERT INTO species (
        id, reino, genero_id, nombre_cientifico, nombre_comun, autor_cientifico,
        descripcion, habitat, distribucion_chiloe, endemica, estado_conservacion,
        fuentes, geo_lat, geo_lng, atributos_especificos, foto_portada_key,
        fotos_keys, creado_por, revisado_por, fecha_revision, created_at,
        updated_at, imagenes_urls, genero_nombre
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        reino = excluded.reino,
        genero_id = excluded.genero_id,
        nombre_cientifico = excluded.nombre_cientifico,
        nombre_comun = excluded.nombre_comun,
        autor_cientifico = excluded.autor_cientifico,
        descripcion = excluded.descripcion,
        habitat = excluded.habitat,
        distribucion_chiloe = excluded.distribucion_chiloe,
        endemica = excluded.endemica,
        estado_conservacion = excluded.estado_conservacion,
        fuentes = excluded.fuentes,
        geo_lat = excluded.geo_lat,
        geo_lng = excluded.geo_lng,
        atributos_especificos = excluded.atributos_especificos,
        foto_portada_key = excluded.foto_portada_key,
        fotos_keys = excluded.fotos_keys,
        creado_por = excluded.creado_por,
        revisado_por = excluded.revisado_por,
        fecha_revision = excluded.fecha_revision,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        imagenes_urls = excluded.imagenes_urls,
        genero_nombre = excluded.genero_nombre`,
      [
        species.id,
        species.reino,
        species.genero_id,
        species.nombre_cientifico,
        species.nombre_comun,
        species.autor_cientifico ?? null,
        species.descripcion,
        species.habitat,
        species.distribucion_chiloe,
        species.endemica ? 1 : 0,
        species.estado_conservacion,
        stringify(species.fuentes),
        species.geo_lat ?? null,
        species.geo_lng ?? null,
        stringify(species.atributos_especificos),
        species.foto_portada_key ?? null,
        stringify(species.fotos_keys),
        species.creado_por ?? null,
        species.revisado_por ?? null,
        species.fecha_revision ?? null,
        species.created_at ?? null,
        species.updated_at ?? null,
        stringify(species.imagenes_urls),
        species.genero_nombre ?? null,
      ],
    );
  }
};

export const listCachedSpecies = async (
  filters: Pick<SpeciesFilters, 'reino' | 'q' | 'limit' | 'offset'> = {},
): Promise<Species[]> => {
  const where: string[] = [];
  const params: (string | number | null)[] = [];

  if (filters.reino) {
    where.push('reino = ?');
    params.push(filters.reino);
  }

  if (filters.q && filters.q.trim() !== '') {
    where.push('(nombre_comun LIKE ? OR nombre_cientifico LIKE ?)');
    const query = `%${filters.q.trim()}%`;
    params.push(query, query);
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  const rows = await querySql<SpeciesRow>(
    `SELECT * FROM species
     ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY nombre_comun COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
    params,
  );

  return rows.map(rowToSpecies);
};

export const getCachedSpecies = async (id: number): Promise<Species | null> => {
  const rows = await querySql<SpeciesRow>('SELECT * FROM species WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? rowToSpecies(rows[0]) : null;
};

