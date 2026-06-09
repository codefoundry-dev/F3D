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

  // The catalogue reads as an alphabetical reference list, so it defaults to
  // ascending (A->Z) — overriding BasePaginationQueryDto's `desc` default, which
  // suits newest-first lists (RFQs/POs) but would sort the catalogue Z->A.
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsString()
  @IsOptional()
  override sortDir?: 'asc' | 'desc' = 'asc';
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

/**
 * Bulk-import materials from a confirmed CATALOGUE extraction (FOR-228). The
 * extraction's `editedResult` is parsed as a CatalogueExtractionResult and
 * upserted into the materials table (SKU-keyed).
 */
export class CatalogueImportRequestDto {
  @IsUUID()
  extractionId!: string;
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
  sku: string | null;
  brand: string | null;
  manufacturerPartNumber: string | null;
  subCategory: string | null;
  imageUrl: string | null;
  status: MaterialStatus;
  createdAt: string;
}

export interface MaterialCategoryDto {
  id: string;
  name: string;
}

/** Summary returned by the catalogue bulk-import endpoint (FOR-228). */
export interface CatalogueImportSummaryDto {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  categoriesCreated: number;
}
