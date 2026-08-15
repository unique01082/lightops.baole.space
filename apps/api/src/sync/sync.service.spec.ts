import { SyncService, type SyncStore } from './sync.service';

describe('SyncService', () => {
  it('deduplicates mutations and returns a monotonically increasing cursor', async () => {
    const store: SyncStore = {
      exchange: jest.fn().mockResolvedValue({
        appliedMutationIds: ['mutation-1'],
        changes: [{ cursor: '1', entityId: 'preset-1' }],
        nextCursor: '1',
      }),
    };
    const service = new SyncService(store);

    const result = await service.exchange('user-1', {
      deviceId: 'device-1',
      mutations: [
        {
          clientMutationId: 'mutation-1',
          entityType: 'preset',
          entityId: 'preset-1',
          op: 'upsert',
          payload: { name: 'Web delivery' },
          clientModifiedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
    });

    expect(result.appliedMutationIds).toEqual(['mutation-1']);
    expect(result.nextCursor).toBe('1');
    expect(store.exchange).toHaveBeenCalledWith('user-1', expect.any(Object));
  });

  it('rejects more than 100 mutations before touching storage', async () => {
    const store: SyncStore = { exchange: jest.fn() };
    const service = new SyncService(store);
    const mutations = Array.from({ length: 101 }, (_, index) => ({
      clientMutationId: `mutation-${index}`,
      entityType: 'setting' as const,
      entityId: `setting-${index}`,
      op: 'delete' as const,
      clientModifiedAt: '2026-08-15T00:00:00.000Z',
    }));

    await expect(service.exchange('user-1', { deviceId: 'device-1', mutations })).rejects.toThrow(
      'At most 100 mutations',
    );
    expect(store.exchange).not.toHaveBeenCalled();
  });

  it('enforces payload limits before touching storage', async () => {
    const store: SyncStore = { exchange: jest.fn() };
    const service = new SyncService(store);

    await expect(
      service.exchange('user-1', {
        deviceId: 'device-1',
        mutations: [
          {
            clientMutationId: 'too-large',
            entityType: 'setting',
            entityId: 'large-setting',
            op: 'upsert',
            payload: 'x'.repeat(16 * 1024),
            clientModifiedAt: '2026-08-15T00:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow('setting payload exceeds');
    expect(store.exchange).not.toHaveBeenCalled();
  });

  it.each([
    ['preset' as const, 64 * 1024],
    ['setting' as const, 16 * 1024],
  ])('accepts a %s payload at the exact byte limit', async (entityType, limit) => {
    const store: SyncStore = {
      exchange: jest.fn().mockResolvedValue({
        appliedMutationIds: ['boundary'],
        changes: [],
        nextCursor: '0',
      }),
    };
    const service = new SyncService(store);

    await expect(
      service.exchange('user-1', {
        deviceId: 'device-1',
        mutations: [
          {
            clientMutationId: 'boundary',
            entityType,
            entityId: 'boundary',
            op: 'upsert',
            payload: 'x'.repeat(limit - 2),
            clientModifiedAt: '2026-08-15T00:00:00.000Z',
          },
        ],
      }),
    ).resolves.toMatchObject({ appliedMutationIds: ['boundary'] });
  });
});
