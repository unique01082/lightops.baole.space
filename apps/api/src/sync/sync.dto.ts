import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SyncMutationDto {
  @ApiProperty({ example: '01J-lightops-device-1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clientMutationId!: string;

  @ApiProperty({ enum: ['preset', 'setting'] })
  @IsIn(['preset', 'setting'])
  entityType!: 'preset' | 'setting';

  @ApiProperty({ example: 'resize-social-1080' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  entityId!: string;

  @ApiProperty({ enum: ['upsert', 'delete'] })
  @IsIn(['upsert', 'delete'])
  op!: 'upsert' | 'delete';

  @ApiPropertyOptional({ description: 'JSON value; omitted for deletes' })
  @IsOptional()
  payload?: unknown;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  clientModifiedAt!: string;
}

export class SyncExchangeDto {
  @ApiProperty({ example: 'desktop-7d17e7ab' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @ApiPropertyOptional({ example: '42' })
  @IsOptional()
  @IsString()
  @IsNumberString({ no_symbols: true })
  cursor?: string;

  @ApiProperty({ type: () => [SyncMutationDto], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncMutationDto)
  mutations!: SyncMutationDto[];
}

export class SyncChangeDto {
  @ApiProperty()
  cursor!: string;

  @ApiProperty({ enum: ['preset', 'setting'] })
  entityType!: 'preset' | 'setting';

  @ApiProperty()
  entityId!: string;

  @ApiProperty({ enum: ['upsert', 'delete'] })
  operation!: 'upsert' | 'delete';

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  payload?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  changedAt!: string;
}

export class SyncExchangeResponseDto {
  @ApiProperty({ type: [String] })
  appliedMutationIds!: string[];

  @ApiProperty({ type: () => [SyncChangeDto] })
  changes!: SyncChangeDto[];

  @ApiProperty()
  nextCursor!: string;

  @ApiProperty({ format: 'date-time' })
  serverTime!: string;
}
