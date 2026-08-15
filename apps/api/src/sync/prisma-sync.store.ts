import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncStore } from './sync.service';
import type { SyncExchangeInput, SyncExchangeOutput, SyncMutationInput } from './sync.types';

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

@Injectable()
export class PrismaSyncStore implements SyncStore {
  constructor(private readonly prisma: PrismaService) {}

  async exchange(userSub: string, input: SyncExchangeInput): Promise<SyncExchangeOutput> {
    const appliedMutationIds: string[] = [];
    await this.prisma.$transaction(async (transaction) => {
      for (const mutation of input.mutations) {
        const accepted = await transaction.syncMutation
          .create({
            data: {
              userSub,
              deviceId: input.deviceId,
              clientMutationId: mutation.clientMutationId,
            },
          })
          .then(() => true)
          .catch((error: unknown) => {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              return false;
            }
            throw error;
          });
        if (!accepted) {
          // A retried mutation was already committed. Acknowledge it again so
          // the desktop can remove the durable outbox entry.
          appliedMutationIds.push(mutation.clientMutationId);
          continue;
        }

        await this.applyMutation(transaction, userSub, mutation);
        await transaction.syncChange.create({
          data: {
            userSub,
            entityType: mutation.entityType,
            entityId: mutation.entityId,
            operation: mutation.op,
            payload: mutation.op === 'delete' ? Prisma.JsonNull : jsonValue(mutation.payload),
          },
        });
        appliedMutationIds.push(mutation.clientMutationId);
      }
    });

    const cursor = BigInt(input.cursor ?? '0');
    const changes = await this.prisma.syncChange.findMany({
      where: { userSub, cursor: { gt: cursor } },
      orderBy: { cursor: 'asc' },
      take: 500,
    });
    const nextCursor = changes.at(-1)?.cursor ?? cursor;
    return {
      appliedMutationIds,
      changes: changes.map((change) => ({
        cursor: change.cursor.toString(),
        entityType: change.entityType,
        entityId: change.entityId,
        operation: change.operation,
        payload: change.payload,
        changedAt: change.changedAt.toISOString(),
      })),
      nextCursor: nextCursor.toString(),
    };
  }

  private async applyMutation(
    transaction: Prisma.TransactionClient,
    userSub: string,
    mutation: SyncMutationInput,
  ) {
    const deletedAt = mutation.op === 'delete' ? new Date() : null;
    if (mutation.entityType === 'setting') {
      await transaction.userSetting.upsert({
        where: { userSub_key: { userSub, key: mutation.entityId } },
        create: {
          userSub,
          key: mutation.entityId,
          value: jsonValue(mutation.payload),
          deletedAt,
        },
        update: { value: jsonValue(mutation.payload), deletedAt },
      });
      return;
    }

    const payload = (mutation.payload ?? {}) as Record<string, unknown>;
    await transaction.toolPreset.upsert({
      where: { userSub_id: { userSub, id: mutation.entityId } },
      create: {
        userSub,
        id: mutation.entityId,
        toolId: String(payload.toolId ?? 'unknown'),
        name: String(payload.name ?? mutation.entityId),
        payload: jsonValue(payload),
        deletedAt,
      },
      update: {
        toolId: String(payload.toolId ?? 'unknown'),
        name: String(payload.name ?? mutation.entityId),
        payload: jsonValue(payload),
        deletedAt,
      },
    });
  }
}
