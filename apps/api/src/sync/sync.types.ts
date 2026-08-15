export type SyncMutationInput = {
  clientMutationId: string;
  entityType: 'preset' | 'setting';
  entityId: string;
  op: 'upsert' | 'delete';
  payload?: unknown;
  clientModifiedAt: string;
};

export type SyncExchangeInput = {
  deviceId: string;
  cursor?: string;
  mutations: SyncMutationInput[];
};

export type SyncChange = {
  cursor: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload?: unknown;
  changedAt?: string;
};

export type SyncExchangeOutput = {
  appliedMutationIds: string[];
  changes: SyncChange[];
  nextCursor: string;
  serverTime?: string;
};
