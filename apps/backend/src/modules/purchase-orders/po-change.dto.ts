import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePoChangeRequestDto {
  @ApiProperty({ enum: ['COMMERCIAL', 'INTERNAL'] })
  @IsEnum(['COMMERCIAL', 'INTERNAL'])
  changeType!: string;

  @ApiProperty({ description: 'JSON object describing the proposed changes' })
  @IsObject()
  @IsNotEmpty()
  changedFields!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

export class RejectPoChangeRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
