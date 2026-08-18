import type {AvistamientoDraft} from '../../types/avistamiento';
import {
  countEncuentros,
  enqueueAvistamiento,
  enqueueIdentificacion,
  enqueueRetiroIdentificacion,
  listPendingIdentificaciones,
  listPendingMutations,
  listPendingRetiros,
  markMutationFailed,
  markMutationRejected,
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
  precision_declarada: 'exacto',
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
    const [mutation] = mutations;
    expect(mutation?.type).toBe('create_avistamiento');
    if (mutation?.type !== 'create_avistamiento') {
      throw new Error('se esperaba una mutación de avistamiento');
    }
    expect(mutation.payload.local_id).toBe('local-1');
    expect(mutation.payload.reino).toBe('fungi');
  });

  it('distingue las identificaciones por el type de la fila', async () => {
    mockQuerySql.mockResolvedValueOnce([
      {
        id: 'local-2',
        type: 'create_identificacion',
        payload: JSON.stringify({
          avistamiento_id: 12,
          especie_id: 42,
          comentario: null,
        }),
        status: 'pending',
        attempts: 0,
        last_error: null,
        created_at: '2026-07-16T12:00:00.000Z',
        updated_at: '2026-07-16T12:00:00.000Z',
      },
    ]);

    const [mutation] = await listPendingMutations();

    expect(mutation?.type).toBe('create_identificacion');
    if (mutation?.type !== 'create_identificacion') {
      throw new Error('se esperaba una mutación de identificación');
    }
    expect(mutation.payload.avistamiento_id).toBe(12);
  });

  it('distingue los retiros por el type de la fila', async () => {
    mockQuerySql.mockResolvedValueOnce([
      {
        id: 'retiro-identificacion-99',
        type: 'retirar_identificacion',
        payload: JSON.stringify({avistamiento_id: 12, identificacion_id: 99}),
        status: 'pending',
        attempts: 0,
        last_error: null,
        created_at: '2026-07-16T12:00:00.000Z',
        updated_at: '2026-07-16T12:00:00.000Z',
      },
    ]);

    const [mutation] = await listPendingMutations();

    expect(mutation?.type).toBe('retirar_identificacion');
    if (mutation?.type !== 'retirar_identificacion') {
      throw new Error('se esperaba una mutación de retiro');
    }
    expect(mutation.payload.identificacion_id).toBe(99);
  });
});

describe('enqueueIdentificacion', () => {
  it('encola sin tocar local_avistamientos', async () => {
    const mutation = await enqueueIdentificacion({
      avistamiento_id: 12,
      especie_id: 42,
      comentario: '  ',
    });

    expect(mutation.type).toBe('create_identificacion');
    expect(mutation.status).toBe('pending');

    // Un único INSERT: la identificación no tiene tabla local propia.
    expect(mockExecuteSql).toHaveBeenCalledTimes(1);
    const [sql, params] = mockExecuteSql.mock.calls[0] ?? [];
    expect(sql).toContain('INSERT INTO mutation_queue');
    expect(params?.[1]).toBe('create_identificacion');
    expect(JSON.parse(params?.[2] as string)).toEqual({
      avistamiento_id: 12,
      especie_id: 42,
      comentario: '  ',
    });
  });

  it('markMutationSynced sin remote_id no toca el avistamiento local', async () => {
    await markMutationSynced('local-2', null);

    expect(mockExecuteSql).toHaveBeenCalledTimes(1);
    expect(mockExecuteSql.mock.calls[0]?.[0]).toContain("status = 'synced'");
  });
});

describe('listPendingIdentificaciones', () => {
  const fila = (id: string, avistamientoId: number) => ({
    id,
    type: 'create_identificacion' as const,
    payload: JSON.stringify({
      avistamiento_id: avistamientoId,
      especie_id: 42,
      comentario: null,
    }),
    status: 'pending' as const,
    attempts: 0,
    last_error: null,
    created_at: '2026-07-16T12:00:00.000Z',
    updated_at: '2026-07-16T12:00:00.000Z',
  });

  it('devuelve solo las del avistamiento pedido', async () => {
    mockQuerySql.mockResolvedValueOnce([fila('local-2', 12), fila('local-3', 120)]);

    const pendientes = await listPendingIdentificaciones(12);

    expect(pendientes.map(item => item.id)).toEqual(['local-2']);
  });

  it('incluye las rechazadas para poder mostrárselas al usuario', async () => {
    await listPendingIdentificaciones(12);

    const [sql] = mockQuerySql.mock.calls[0] ?? [];
    expect(sql).toContain("status != 'synced'");
  });
});

describe('enqueueRetiroIdentificacion', () => {
  it('encola el retiro con el id remoto en el payload', async () => {
    const mutation = await enqueueRetiroIdentificacion({
      avistamiento_id: 12,
      identificacion_id: 99,
    });

    expect(mutation.type).toBe('retirar_identificacion');
    expect(mutation.status).toBe('pending');

    expect(mockExecuteSql).toHaveBeenCalledTimes(1);
    const [sql, params] = mockExecuteSql.mock.calls[0] ?? [];
    expect(sql).toContain('INSERT INTO mutation_queue');
    expect(params?.[1]).toBe('retirar_identificacion');
    expect(JSON.parse(params?.[2] as string)).toEqual({
      avistamiento_id: 12,
      identificacion_id: 99,
    });
  });

  // Pulsar dos veces "retirar" (o volver a intentarlo tras un fallo) no puede
  // dejar dos DELETE encolados para la misma identificación.
  it('usa el id remoto como clave y reencola sobre la misma fila', async () => {
    const primera = await enqueueRetiroIdentificacion({
      avistamiento_id: 12,
      identificacion_id: 99,
    });
    const segunda = await enqueueRetiroIdentificacion({
      avistamiento_id: 12,
      identificacion_id: 99,
    });

    expect(segunda.id).toBe(primera.id);
    const [sql] = mockExecuteSql.mock.calls[0] ?? [];
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(sql).toContain("status = 'pending'");
  });
});

describe('listPendingRetiros', () => {
  const fila = (id: string, avistamientoId: number, identificacionId: number) => ({
    id,
    type: 'retirar_identificacion' as const,
    payload: JSON.stringify({
      avistamiento_id: avistamientoId,
      identificacion_id: identificacionId,
    }),
    status: 'pending' as const,
    attempts: 0,
    last_error: null,
    created_at: '2026-07-16T12:00:00.000Z',
    updated_at: '2026-07-16T12:00:00.000Z',
  });

  it('devuelve solo los del avistamiento pedido', async () => {
    mockQuerySql.mockResolvedValueOnce([
      fila('retiro-identificacion-99', 12, 99),
      fila('retiro-identificacion-7', 120, 7),
    ]);

    const retiros = await listPendingRetiros(12);

    expect(retiros.map(item => item.payload.identificacion_id)).toEqual([99]);
  });

  it('excluye los ya enviados: esos vienen retirados del servidor', async () => {
    await listPendingRetiros(12);

    const [sql] = mockQuerySql.mock.calls[0] ?? [];
    expect(sql).toContain("type = 'retirar_identificacion'");
    expect(sql).toContain("status != 'synced'");
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

  it('markMutationRejected deja la mutación en un estado terminal', async () => {
    await markMutationRejected('local-1', 'HTTP 422');

    const calls = mockExecuteSql.mock.calls;
    expect(calls[0]?.[0]).toContain("status = 'rejected'");
    expect(calls[0]?.[1]?.[0]).toBe('HTTP 422');
    expect(calls[1]?.[0]).toContain("sync_status = 'rejected'");
  });

  it('listPendingMutations no vuelve a tomar las mutaciones rechazadas', async () => {
    await listPendingMutations();

    const [sql] = mockQuerySql.mock.calls[0] ?? [];
    expect(sql).not.toContain('rejected');
  });
});

describe('countEncuentros', () => {
  it('cuenta encuentros y especies distintas, y deja fuera los rechazados', async () => {
    mockQuerySql.mockResolvedValueOnce([{total: 5, especies: 3}]);

    await expect(countEncuentros()).resolves.toEqual({
      total: 5,
      especiesDistintas: 3,
    });

    const [sql] = mockQuerySql.mock.calls[0] ?? [];
    expect(sql).toContain('FROM local_avistamientos');
    expect(sql).toContain('COUNT(DISTINCT especie_id)');
    expect(sql).toContain("sync_status <> 'rejected'");
  });

  it('devuelve ceros si la tabla está vacía', async () => {
    mockQuerySql.mockResolvedValueOnce([]);

    await expect(countEncuentros()).resolves.toEqual({
      total: 0,
      especiesDistintas: 0,
    });
  });
});
