import type {AvistamientoDraft} from '../../types/avistamiento';
import {
  enqueueAvistamiento,
  listPendingMutations,
  markMutationFailed,
  markMutationSynced,
} from '../mutationQueue';
import {executeSql, initializeDatabase, querySql} from '../connection';

jest.mock('../connection', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  executeSql: jest.fn().mockResolvedValue(undefined),
  querySql: jest.fn().mockResolvedValue([]),
}));

const mockExecuteSql = executeSql as jest.MockedFunction<typeof executeSql>;
const mockQuerySql = querySql as jest.MockedFunction<typeof querySql>;

const draft: AvistamientoDraft = {
  especie_id: 7,
  reino: 'fungi',
  nombre_sugerido: 'Digüeñe',
  descripcion: 'En tronco de coihue',
  foto_key: 'avistamientos-fotos/abc.jpg',
  local_photo_path: '/data/fotos/abc.jpg',
  geo_lat: -42.48,
  geo_lng: -73.76,
  precision_metros: 12,
  observado_en: '2026-07-16T12:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('enqueueAvistamiento', () => {
  it('crea el avistamiento local pendiente y encola la mutación', async () => {
    const local = await enqueueAvistamiento(draft);

    expect(initializeDatabase).toHaveBeenCalled();
    expect(local.local_id).toMatch(/^local-/);
    expect(local.remote_id).toBeNull();
    expect(local.estado).toBe('pendiente');
    expect(local.sync_status).toBe('pending');

    // Dos inserts: local_avistamientos + mutation_queue
    expect(mockExecuteSql).toHaveBeenCalledTimes(2);
    const [avistamientoSql, avistamientoParams] =
      mockExecuteSql.mock.calls[0] ?? [];
    expect(avistamientoSql).toContain('INSERT INTO local_avistamientos');
    expect(avistamientoParams).toContain(local.local_id);

    const [queueSql, queueParams] = mockExecuteSql.mock.calls[1] ?? [];
    expect(queueSql).toContain('INSERT INTO mutation_queue');
    expect(queueParams?.[0]).toBe(local.local_id);
    expect(queueParams?.[1]).toBe('create_avistamiento');
    // El payload serializado conserva el draft y el local_id para el replay
    expect(JSON.parse(queueParams?.[2] as string)).toMatchObject({
      ...draft,
      local_id: local.local_id,
    });
  });
});

describe('listPendingMutations', () => {
  it('deserializa el payload JSON de cada fila', async () => {
    mockQuerySql.mockResolvedValueOnce([
      {
        id: 'local-1',
        type: 'create_avistamiento',
        payload: JSON.stringify({...draft, local_id: 'local-1'}),
        status: 'pending',
        attempts: 0,
        last_error: null,
        created_at: '2026-07-16T12:00:00.000Z',
        updated_at: '2026-07-16T12:00:00.000Z',
      },
    ]);

    const mutations = await listPendingMutations();

    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.payload.local_id).toBe('local-1');
    expect(mutations[0]?.payload.reino).toBe('fungi');
  });
});

describe('transiciones de estado', () => {
  it('markMutationSynced guarda el remote_id y marca synced', async () => {
    await markMutationSynced('local-1', 42);

    const calls = mockExecuteSql.mock.calls;
    expect(calls[0]?.[0]).toContain("status = 'synced'");
    expect(calls[1]?.[0]).toContain("sync_status = 'synced'");
    expect(calls[1]?.[1]?.[0]).toBe(42);
  });

  it('markMutationFailed incrementa attempts y registra el error', async () => {
    await markMutationFailed('local-1', 'timeout');

    const calls = mockExecuteSql.mock.calls;
    expect(calls[0]?.[0]).toContain('attempts = attempts + 1');
    expect(calls[0]?.[1]?.[0]).toBe('timeout');
    expect(calls[1]?.[0]).toContain("sync_status = 'failed'");
  });
});
