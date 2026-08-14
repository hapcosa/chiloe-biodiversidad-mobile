import NetInfo from '@react-native-community/netinfo';
import {avistamientosApi, identificacionesApi} from '../../api';
import {ApiError} from '../../api/errors';
import {
  listPendingMutations,
  markMutationFailed,
  markMutationRejected,
  markMutationSynced,
} from '../../db/mutationQueue';
import {syncPendingMutations} from '../mutationSync';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

jest.mock('../../api', () => ({
  avistamientosApi: {create: jest.fn()},
  identificacionesApi: {create: jest.fn(), retirar: jest.fn()},
}));

jest.mock('../../db/mutationQueue', () => ({
  listPendingMutations: jest.fn(),
  markMutationFailed: jest.fn().mockResolvedValue(undefined),
  markMutationRejected: jest.fn().mockResolvedValue(undefined),
  markMutationSynced: jest.fn().mockResolvedValue(undefined),
  markMutationSyncing: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../native/photoUpload', () => ({
  uploadLocalPhoto: jest.fn(),
}));

const mockNetInfoFetch = NetInfo.fetch as jest.MockedFunction<typeof NetInfo.fetch>;
const mockCreate = avistamientosApi.create as jest.Mock;
const mockCreateIdentificacion = identificacionesApi.create as jest.Mock;
const mockRetirar = identificacionesApi.retirar as jest.Mock;
const mockList = listPendingMutations as jest.Mock;

const pendingMutation = {
  id: 'local-1',
  type: 'create_avistamiento' as const,
  payload: {
    local_id: 'local-1',
    especie_id: 8,
    reino: 'fungi' as const,
    geo_lat: -42.48,
    geo_lng: -73.76,
    observado_en: '2026-07-16T12:00:00.000Z',
  },
  status: 'failed' as const,
  attempts: 17,
  last_error: 'HTTP 422',
  created_at: '2026-07-16T12:00:00.000Z',
  updated_at: '2026-07-16T12:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNetInfoFetch.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  } as Awaited<ReturnType<typeof NetInfo.fetch>>);
  mockList.mockResolvedValue([pendingMutation]);
});

describe('syncPendingMutations', () => {
  it('marca como sincronizada la mutación aceptada', async () => {
    mockCreate.mockResolvedValueOnce({id: 42, estado: 'pendiente'});

    await expect(syncPendingMutations()).resolves.toBe(1);
    expect(markMutationSynced).toHaveBeenCalledWith('local-1', 42);
  });

  it.each([400, 404, 409, 422])(
    'deja de reintentar tras un %i del servidor',
    async status => {
      mockCreate.mockRejectedValueOnce(new ApiError('rechazado', status, null));

      await expect(syncPendingMutations()).resolves.toBe(0);
      expect(markMutationRejected).toHaveBeenCalledWith('local-1', 'rechazado');
      expect(markMutationFailed).not.toHaveBeenCalled();
    },
  );

  it.each([401, 408, 429, 500, 503])(
    'sigue reintentando tras un %i',
    async status => {
      mockCreate.mockRejectedValueOnce(new ApiError('transitorio', status, null));

      await expect(syncPendingMutations()).resolves.toBe(0);
      expect(markMutationFailed).toHaveBeenCalledWith('local-1', 'transitorio');
      expect(markMutationRejected).not.toHaveBeenCalled();
    },
  );

  it('trata un fallo de red como transitorio', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(syncPendingMutations()).resolves.toBe(0);
    expect(markMutationFailed).toHaveBeenCalledWith(
      'local-1',
      'Network request failed',
    );
    expect(markMutationRejected).not.toHaveBeenCalled();
  });

  it('reenvía las identificaciones encoladas sin remote_id que enlazar', async () => {
    mockList.mockResolvedValue([
      {
        id: 'local-9',
        type: 'create_identificacion' as const,
        payload: {avistamiento_id: 12, especie_id: 42, comentario: null},
        status: 'pending' as const,
        attempts: 0,
        last_error: null,
        created_at: '2026-07-16T12:00:00.000Z',
        updated_at: '2026-07-16T12:00:00.000Z',
      },
    ]);
    mockCreateIdentificacion.mockResolvedValueOnce({id: 5});

    await expect(syncPendingMutations()).resolves.toBe(1);
    expect(mockCreateIdentificacion).toHaveBeenCalledWith({
      avistamiento_id: 12,
      especie_id: 42,
      comentario: null,
    });
    expect(markMutationSynced).toHaveBeenCalledWith('local-9', null);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('descarta la identificación duplicada (409) en vez de reintentarla', async () => {
    mockList.mockResolvedValue([
      {
        id: 'local-9',
        type: 'create_identificacion' as const,
        payload: {avistamiento_id: 12, especie_id: 42, comentario: null},
        status: 'pending' as const,
        attempts: 0,
        last_error: null,
        created_at: '2026-07-16T12:00:00.000Z',
        updated_at: '2026-07-16T12:00:00.000Z',
      },
    ]);
    mockCreateIdentificacion.mockRejectedValueOnce(
      new ApiError('ya identificaste este avistamiento', 409, null),
    );

    await expect(syncPendingMutations()).resolves.toBe(0);
    expect(markMutationRejected).toHaveBeenCalledWith(
      'local-9',
      'ya identificaste este avistamiento',
    );
  });

  describe('retiros encolados', () => {
    const retiro = {
      id: 'retiro-identificacion-99',
      type: 'retirar_identificacion' as const,
      payload: {avistamiento_id: 12, identificacion_id: 99},
      status: 'pending' as const,
      attempts: 0,
      last_error: null,
      created_at: '2026-07-16T12:00:00.000Z',
      updated_at: '2026-07-16T12:00:00.000Z',
    };

    beforeEach(() => {
      mockList.mockResolvedValue([retiro]);
    });

    it('manda el DELETE con el avistamiento y la identificación del payload', async () => {
      mockRetirar.mockResolvedValueOnce({id: 99, retirada: true});

      await expect(syncPendingMutations()).resolves.toBe(1);
      expect(mockRetirar).toHaveBeenCalledWith(12, 99);
      expect(markMutationSynced).toHaveBeenCalledWith('retiro-identificacion-99', null);
    });

    // Retirar es idempotente para el usuario: si ya estaba retirada o ya no
    // existe, el estado pedido es el actual y no hay error que mostrar.
    it.each([404, 409])('da por cumplido el retiro ante un %i', async status => {
      mockRetirar.mockRejectedValueOnce(new ApiError('ya retirada', status, null));

      await syncPendingMutations();
      expect(markMutationSynced).toHaveBeenCalledWith('retiro-identificacion-99', null);
      expect(markMutationRejected).not.toHaveBeenCalled();
      expect(markMutationFailed).not.toHaveBeenCalled();
    });

    it('deja de reintentar si el servidor dice que no es tuya (403)', async () => {
      mockRetirar.mockRejectedValueOnce(new ApiError('no es tuya', 403, null));

      await syncPendingMutations();
      expect(markMutationRejected).toHaveBeenCalledWith(
        'retiro-identificacion-99',
        'no es tuya',
      );
    });

    it('reintenta el retiro cuando falla la red', async () => {
      mockRetirar.mockRejectedValueOnce(new Error('Network request failed'));

      await syncPendingMutations();
      expect(markMutationFailed).toHaveBeenCalledWith(
        'retiro-identificacion-99',
        'Network request failed',
      );
    });
  });

  it('no intenta nada sin conexión', async () => {
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    await expect(syncPendingMutations()).resolves.toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
