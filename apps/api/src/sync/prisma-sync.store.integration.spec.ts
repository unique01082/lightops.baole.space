import { PrismaService } from '../prisma/prisma.service';
import { PrismaSyncStore } from './prisma-sync.store';

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase('PrismaSyncStore integration', () => {
  const prisma = new PrismaService();
  const store = new PrismaSyncStore(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.syncChange.deleteMany();
    await prisma.syncMutation.deleteMany();
    await prisma.toolPreset.deleteMany();
    await prisma.userSetting.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('isolates users, acknowledges retries, applies LWW, and propagates tombstones by cursor', async () => {
    const first = await store.exchange('user-a', {
      deviceId: 'device-a',
      mutations: [
        {
          clientMutationId: 'mutation-1',
          entityType: 'setting',
          entityId: 'language',
          op: 'upsert',
          payload: 'en',
          clientModifiedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(first.appliedMutationIds).toEqual(['mutation-1']);

    const retried = await store.exchange('user-a', {
      deviceId: 'device-a',
      mutations: [
        {
          clientMutationId: 'mutation-1',
          entityType: 'setting',
          entityId: 'language',
          op: 'upsert',
          payload: 'ignored-retry',
          clientModifiedAt: '2030-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(retried.appliedMutationIds).toEqual(['mutation-1']);

    const isolated = await store.exchange('user-b', { deviceId: 'device-b', mutations: [] });
    expect(isolated.changes).toEqual([]);

    await store.exchange('user-a', {
      deviceId: 'device-a',
      mutations: [
        {
          clientMutationId: 'mutation-2',
          entityType: 'setting',
          entityId: 'language',
          op: 'upsert',
          payload: 'vi',
          clientModifiedAt: '2010-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(
      await prisma.userSetting.findUniqueOrThrow({
        where: { userSub_key: { userSub: 'user-a', key: 'language' } },
      }),
    ).toMatchObject({ value: 'vi', deletedAt: null });

    const deleted = await store.exchange('user-a', {
      deviceId: 'device-a',
      cursor: first.nextCursor,
      mutations: [
        {
          clientMutationId: 'mutation-3',
          entityType: 'setting',
          entityId: 'language',
          op: 'delete',
          clientModifiedAt: '2000-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(deleted.changes.some((change) => change.operation === 'delete')).toBe(true);
    expect(
      await prisma.userSetting.findUniqueOrThrow({
        where: { userSub_key: { userSub: 'user-a', key: 'language' } },
      }),
    ).toMatchObject({ deletedAt: expect.any(Date) });
  });

  it('paginates the ordered change cursor without leaking another user', async () => {
    await prisma.syncChange.createMany({
      data: [
        ...Array.from({ length: 501 }, (_, index) => ({
          userSub: 'page-user',
          entityType: 'setting',
          entityId: `setting-${index}`,
          operation: 'upsert',
          payload: { index },
        })),
        {
          userSub: 'other-user',
          entityType: 'setting',
          entityId: 'private-setting',
          operation: 'upsert',
          payload: { secret: true },
        },
      ],
    });

    const first = await store.exchange('page-user', {
      deviceId: 'page-device',
      mutations: [],
    });
    const second = await store.exchange('page-user', {
      deviceId: 'page-device',
      cursor: first.nextCursor,
      mutations: [],
    });

    expect(first.changes).toHaveLength(500);
    expect(second.changes).toHaveLength(1);
    expect(BigInt(second.nextCursor)).toBeGreaterThan(BigInt(first.nextCursor));
    expect([...first.changes, ...second.changes]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: 'private-setting' })]),
    );
  });
});
