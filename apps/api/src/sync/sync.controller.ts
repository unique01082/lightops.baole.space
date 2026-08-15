import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/jwt.strategy';
import { SyncExchangeDto, SyncExchangeResponseDto } from './sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('exchange')
  @RequirePermissions('app:lightops:sync')
  @ApiOkResponse({ type: SyncExchangeResponseDto })
  exchange(@Req() request: Request & { user: AuthUser }, @Body() body: SyncExchangeDto) {
    return this.sync.exchange(request.user.sub, body);
  }
}
