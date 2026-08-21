export type SyncMutation = {
  clientMutationId: string;
  entityType: 'preset' | 'setting';
  entityId: string;
  op: 'upsert' | 'delete';
  payload?: unknown;
  clientModifiedAt: string;
};

const PRIVATE_KEYS = new Set([
  'path',
  'paths',
  'sourcePath',
  'outputPath',
  'manifestPath',
  'images',
  'thumbnail',
  'jobHistory',
  'recentJobs',
]);

function assertSyncSafe(value: unknown, trail = 'payload'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSyncSafe(item, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (PRIVATE_KEYS.has(key)) throw new Error(`Sync payload cannot contain ${trail}.${key}`);
    assertSyncSafe(child, `${trail}.${key}`);
  }
}

export function createSyncMutation(
  entityType: 'preset' | 'setting',
  entityId: string,
  op: 'upsert' | 'delete',
  payload?: unknown,
): SyncMutation {
  assertSyncSafe(payload);
  return {
    clientMutationId: crypto.randomUUID(),
    entityType,
    entityId,
    op,
    payload,
    clientModifiedAt: new Date().toISOString(),
  };
}

export async function exchangeSync(options: {
  apiBaseUrl: string;
  deviceId: string;
  cursor?: string;
  mutations: SyncMutation[];
}) {
  options.mutations.forEach((mutation) => assertSyncSafe(mutation.payload));
  return syncControllerExchange(
    {
      deviceId: options.deviceId,
      cursor: options.cursor,
      mutations: options.mutations as LightOpsSyncAPI.SyncMutationDto[],
    },
    { apiBaseUrl: options.apiBaseUrl },
  );
}
import { syncControllerExchange } from '../generated/lightops-api/api/sync';
