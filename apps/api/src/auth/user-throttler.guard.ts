import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from './jwt.strategy';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: { user?: AuthUser; ip?: string }): Promise<string> {
    return request.user?.sub ?? request.ip ?? 'unknown-client';
  }
}
