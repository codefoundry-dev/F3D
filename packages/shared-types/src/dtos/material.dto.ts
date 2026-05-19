import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { MaterialStatus } from '../enums';

import { BasePaginationQueryDto } from './pagination.dto';

// ── Request DTOs ─────────────────────────────────────────────────────────────

export class MaterialListQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: MaterialStatus })
  @IsEnum(MaterialStatus)
  @IsOptional()
  status?: MaterialStatus;

  @ApiPropertyOptional({ enum: ['name', 'createdAt'] })
  @IsString()
  @IsOptional()
  sortBy?: string = 'name';
}

export class CreateMaterialDto {
  @IsString()
  name!: string;

  @IsUUID()
  categoryId!: string;

  @IsString()
  uom!: string;

  @IsString()
  @IsOptional()
  upc?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface MaterialListItemDto {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  uom: string;
  upc: string | null;
  manufacturer: string | null;
  description: string | null;
  status: MaterialStatus;
  createdAt: string;
}

export interface MaterialCategoryDto {
  id: string;
  name: string;
}
