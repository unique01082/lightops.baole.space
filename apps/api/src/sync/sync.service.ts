import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { SyncExchangeInput, SyncExchangeOutput } from './sync.types';

export const SYNC_STORE = Symbol('SYNC_STORE');

export type SyncStore = {
  exchange(userSub: string, input: SyncExchangeInput): Promise<SyncExchangeOutput>;
};

@Injectable()
export class SyncService {
  constructor(@Inject(SYNC_STORE) private readonly store: SyncStore) {}

  async exchange(userSub: string, input: SyncExchangeInput): Promise<SyncExchangeOutput> {
    if (input.mutations.length > 100) {
      throw new BadRequestException('At most 100 mutations are allowed per exchange');
    }
    for (const mutation of input.mutations) {
      if (!mutation.clientMutationId || !mutation.entityId) {
        throw new BadRequestException('Mutation identifiers are required');
      }
      const payloadBytes = Buffer.byteLength(JSON.stringify(mutation.payload ?? null));
      const limit = mutation.entityType === 'preset' ? 64 * 1024 : 16 * 1024;
      if (payloadBytes > limit) {
        throw new BadRequestException(`${mutation.entityType} payload exceeds ${limit} bytes`);
      }
    }
    const result = await this.store.exchange(userSub, input);
    return { ...result, serverTime: new Date().toISOString() };
  }
}
