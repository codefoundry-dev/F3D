import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

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
