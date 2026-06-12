import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { MaterialChangeRequestStatus, MaterialStatus } from '../enums';

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

  // Optional: the catalogue create wizard always supplies it, but the BOM
  // "create private material" quick-add has no category field — those rows fall
  // back to the shared "Uncategorised" bucket server-side.
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

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

  // ── Rich catalogue attributes (US 4.01 Phase 2) ──────────────────────────
  // Mirrors UpdateMaterialDto so the "Add new material item" wizard can submit
  // the full Core-identification + Additional-properties payload in one create.
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

// ── Duplicate detection (US 4.01 Phase 3) ─────────────────────────────────────

/**
 * One candidate row to check against the existing catalogue. Only the natural
 * identity fields are needed — name (always), plus the SKU / UPC codes when the
 * upload carries them.
 */
export class DuplicateCandidateDto {
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upc?: string | null;
}

/**
 * Bulk duplicate check for the upload/import wizard. The candidates keep their
 * submitted order so the response can refer back to each by index.
 */
export class DetectMaterialDuplicatesDto {
  @ApiProperty({ type: [DuplicateCandidateDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DuplicateCandidateDto)
  candidates!: DuplicateCandidateDto[];
}

// ── Material change requests (US 4.01 Phase 3) ────────────────────────────────

/** Resolve (reject) a pending material change request with an optional reason. */
export class ResolveMaterialChangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
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

// ── Duplicate detection responses (US 4.01 Phase 3) ───────────────────────────

/** Which identity field(s) a candidate matched on. */
export type DuplicateMatchField = 'name' | 'sku' | 'upc';

/** An existing catalogue material that a candidate row collides with. */
export interface MaterialDuplicateMatchDto {
  id: string;
  name: string;
  /** Human-facing code shown in the wizard (SKU when present, else a short id). */
  code: string;
  status: MaterialStatus;
  matchedOn: DuplicateMatchField[];
}

/** Matches for a single candidate row, keyed back to its submitted index. */
export interface MaterialDuplicateResultDto {
  index: number;
  matches: MaterialDuplicateMatchDto[];
}

export interface DetectMaterialDuplicatesResponseDto {
  results: MaterialDuplicateResultDto[];
}

// ── Material change-request responses (US 4.01 Phase 3) ───────────────────────

/** A single field's before/after in a proposed material edit. */
export interface MaterialFieldChange {
  from: string | number | null;
  to: string | number | null;
}

/**
 * A proposed edit to a PUBLIC catalogue material awaiting Super-Admin review.
 * `changes` is the per-field before/after diff the Pending tab renders as an
 * edit-diff card.
 */
export interface MaterialChangeRequestDto {
  id: string;
  materialId: string;
  materialName: string;
  status: MaterialChangeRequestStatus;
  changes: Record<string, MaterialFieldChange>;
  reason: string | null;
  requestedBy: { id: string; name: string } | null;
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  createdAt: string;
}
