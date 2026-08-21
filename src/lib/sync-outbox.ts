import { invoke } from '@tauri-apps/api/core';
import { exchangeSync, type SyncMutation } from './sync-client';

type OutboxMutation = SyncMutation & { attempts: number };
type SyncResponse = {
  appliedMutationIds: string[];
  changes: Array<{
    entityType: string;
    entityId: string;
    operation: string;
    payload?: unknown;
  }>;
  nextCursor: string;
};

let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

async function flush(activeGeneration: number): Promise<void> {
  if (activeGeneration !== generation) return;
  let mutations: OutboxMutation[] = [];
  try {
    const [deviceId, cursor, queuedMutations] = await Promise.all([
      invoke<string>('get_sync_device_id'),
      invoke<string | null>('get_sync_cursor'),
      invoke<OutboxMutation[]>('list_sync_outbox'),
    ]);
    mutations = queuedMutations;
    const response = (await exchangeSync({
      apiBaseUrl: import.meta.env.VITE_LIGHTOPS_API_URL ?? 'https://lightops.baole.space',
      deviceId,
      cursor: cursor ?? undefined,
      mutations,
    })) as SyncResponse;
    await invoke('apply_sync_response', {
      appliedMutationIds: response.appliedMutationIds,
      changes: response.changes,
      nextCursor: response.nextCursor,
    });
    if (activeGeneration === generation) {
      timer = setTimeout(() => void flush(activeGeneration), mutations.length ? 2_000 : 60_000);
    }
  } catch {
    await invoke('record_sync_failure', {
      mutationIds: mutations.map((mutation) => mutation.clientMutationId),
    }).catch(() => undefined);
    const attempts = Math.max(0, ...mutations.map((mutation) => mutation.attempts + 1));
    const delay = Math.min(300_000, 1_000 * 2 ** Math.min(attempts, 8));
    if (activeGeneration === generation) {
      timer = setTimeout(() => void flush(activeGeneration), delay);
    }
  }
}

export function startSyncOutbox(): Promise<void> {
  stopSyncOutbox();
  const activeGeneration = generation;
  return flush(activeGeneration);
}

export function stopSyncOutbox(): void {
  generation += 1;
  if (timer) clearTimeout(timer);
  timer = undefined;
}
