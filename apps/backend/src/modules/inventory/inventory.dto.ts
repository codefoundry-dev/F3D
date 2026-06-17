import { StockMovementSource } from '@forethread/shared-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Filters for the on-hand balances list (`GET /inventory/balances`). All
 * optional and composable: `projectId` narrows to one project's locations,
 * `locationId` to a single location, `materialId` to a single material. The
 * result is company-scoped server-side regardless of the filters.
 */
export class ListStockBalanceQueryDto {
  @ApiPropertyOptional({ description: 'Filter to the locations of a single project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter to a single project location' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Filter to a single catalogue material' })
  @IsOptional()
  @IsUUID()
  materialId?: string;
}

/**
 * Filters for the movement ledger (`GET /inventory/movements`). Newest-first,
 * company-scoped. `sourceType` filters by originating document type
 * (e.g. 'PURCHASE_ORDER' | 'MATERIAL_REQUEST'); `source` filters by the movement
 * source enum. `limit` caps the page size (default 100, max 500).
 */
export class ListStockMovementQueryDto {
  @ApiPropertyOptional({ description: 'Filter to the locations of a single project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter to a single project location' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Filter to a single catalogue material' })
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiPropertyOptional({ enum: StockMovementSource, description: 'Filter by movement source' })
  @IsOptional()
  @IsEnum(StockMovementSource)
  source?: StockMovementSource;

  @ApiPropertyOptional({ description: "Originating document type, e.g. 'PURCHASE_ORDER'" })
  @IsOptional()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Max rows to return (default 100, max 500)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
