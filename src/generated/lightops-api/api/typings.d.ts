declare namespace LightOpsSyncAPI {
  type SyncChangeDto = {
    cursor: string;
    entityType: 'preset' | 'setting';
    entityId: string;
    operation: 'upsert' | 'delete';
    payload?: Record;
    changedAt: string;
  };

  type SyncExchangeDto = {
    deviceId: string;
    cursor?: string;
    mutations: SyncMutationDto[];
  };

  type SyncExchangeResponseDto = {
    appliedMutationIds: string[];
    changes: SyncChangeDto[];
    nextCursor: string;
    serverTime: string;
  };

  type SyncMutationDto = {
    clientMutationId: string;
    entityType: 'preset' | 'setting';
    entityId: string;
    op: 'upsert' | 'delete';
    /** JSON value; omitted for deletes */
    payload?: Record;
    clientModifiedAt: string;
  };
}
