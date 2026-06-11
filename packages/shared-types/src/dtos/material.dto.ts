import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

import { MaterialStatus } from '../enums';

import { BasePaginationQueryDto } from './pagination.dto';

// ── Rich attribute shapes (US 4.01) ──────────────────────────────────────────

/** A single measured dimension: a numeric value paired with its unit of measure. */
export interface MaterialDimensionValue {
  value: number | null;
  uom: string | null;
}

/** Packaging sub-shape nested under `dimensions`. */
export interface MaterialPackaging {
  packagingUnit?: string | null;
  unitsPerPackage?: number | null;
  weightPerPackage?: number | null;
}

/**
 * Structured physical dimensions stored on `Material.dimensions` (JSONB). Every
 * field is optional so a material only carries the dimensions relevant to it.
 */
export interface MaterialDimensions {
  length?: MaterialDimensionValue;
  width?: MaterialDimensionValue;
  height?: MaterialDimensionValue;
  diameter?: MaterialDimensionValue;
  thickness?: MaterialDimensionValue;
  volume?: MaterialDimensionValue;
  weightPerUnit?: MaterialDimensionValue;
  packaging?: MaterialPackaging;
}

/**
 * Open-ended, category-specific "Specific data" stored on `Material.properties`
 * (JSONB). Keys vary per material category; values are scalar.
 */
export type MaterialProperties = Record<string, string | number | null>;

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

  // ── Facet filters (US 4.01) ─────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  uom?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  materialType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  countryOfOrigin?: string;

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
 * Partial update of a material (US 4.01). Every field is optional — only the
 * supplied fields are applied; omitted fields are left untouched.
 */
export class UpdateMaterialDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  uom?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  upc?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturerPartNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subCategory?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  materialType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  itemType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  countryOfOrigin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturerSeriesModel?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  gradeClass?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  standardNorm?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  colourFinish?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  size?: string;

  @ApiPropertyOptional({ description: 'Price per unit (numeric or numeric string)' })
  @IsNumber()
  @IsOptional()
  pricePerUnit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ type: Object, description: 'Structured physical dimensions' })
  @IsObject()
  @IsOptional()
  dimensions?: MaterialDimensions;

  @ApiPropertyOptional({ type: Object, description: 'Open-ended category-specific data' })
  @IsObject()
  @IsOptional()
  properties?: MaterialProperties;
}

/** Reason payload for rejecting a pending material (US 4.01). */
export class RejectMaterialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
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
  materialType: string | null;
  countryOfOrigin: string | null;
  pricePerUnit: string | number | null;
  currency: string;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
}

/** Full material detail (US 4.01). */
export interface MaterialDetailDto {
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
  materialType: string | null;
  itemType: string | null;
  countryOfOrigin: string | null;
  manufacturerSeriesModel: string | null;
  gradeClass: string | null;
  standardNorm: string | null;
  colourFinish: string | null;
  size: string | null;
  pricePerUnit: string | null;
  currency: string;
  dimensions: MaterialDimensions | null;
  properties: MaterialProperties | null;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  } | null;
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
