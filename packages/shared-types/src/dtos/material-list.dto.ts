import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

import { MaterialStatus } from '../enums';

// ── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * Query for the company's saved material lists (US 5.05). Material lists are
 * small, named collections of catalogue materials used to pre-fill RFQ line
 * items, so the listing is unpaginated and supports only a name search.
 */
export class MaterialListsQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive name/description search' })
  @IsString()
  @IsOptional()
  search?: string;
}

/** Create a new company-scoped material list (US 4.03). */
export class CreateMaterialListDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

/** Partial update of a material list's name/description (US 4.03). */
export class UpdateMaterialListDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

/** Add one or more catalogue materials to a material list (US 4.03). */
export class AddMaterialListItemsDto {
  @ApiProperty({ type: [String], description: 'Catalogue material ids to add' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  materialIds!: string[];
}

// ── Response interfaces ──────────────────────────────────────────────────────

/** Row in GET /v1/material-lists. */
export interface MaterialListSummaryDto {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  updatedAt: string;
}

/** The catalogue material carried by a material-list item. */
export interface MaterialListMaterialDto {
  id: string;
  name: string;
  uom: string;
  manufacturer: string | null;
  description: string | null;
  // Catalogue columns surfaced for the US 4.03 single-list table.
  status: MaterialStatus;
  materialType: string | null;
  upc: string | null;
  pricePerUnit: string | null;
  currency: string;
  imageUrl: string | null;
  updatedAt: string;
  category: { id: string; name: string };
}

/** One material + quantity entry of a material list. */
export interface MaterialListEntryDto {
  id: string;
  quantity: number;
  material: MaterialListMaterialDto;
}

/** Detail returned by GET /v1/material-lists/:id. */
export interface MaterialListDetailDto {
  id: string;
  name: string;
  description: string | null;
  items: MaterialListEntryDto[];
}
