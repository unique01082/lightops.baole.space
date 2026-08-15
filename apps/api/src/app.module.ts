import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { PermissionsGuard } from './auth/permissions.guard';
import { UserThrottlerGuard } from './auth/user-throttler.guard';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { PrismaSyncStore } from './sync/prisma-sync.store';
import { SyncController } from './sync/sync.controller';
import { SYNC_STORE, SyncService } from './sync/sync.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [HealthController, SyncController],
  providers: [
    PrismaService,
    JwtStrategy,
    SyncService,
    PrismaSyncStore,
    { provide: SYNC_STORE, useExisting: PrismaSyncStore },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
