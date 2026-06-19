import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// ── Request DTOs (US 5.01 — create a project BOM) ───────────────────────────
// Backend-only (decorated) classes. Response shapes live in
// @forethread/api-client like the other procurement endpoints.

export class CreateBomItemDto {
  @ApiProperty({ description: 'Material name shown on the BOM line.' })
  @IsString()
  @MaxLength(500)
  materialName!: string;

  @ApiProperty({ description: 'Catalogue material this line was matched to.' })
  @IsUUID()
  matchedMaterialId!: string;

  @ApiPropertyOptional({ description: 'Original line description from the uploaded document.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  materialType?: string;

  @ApiPropertyOptional({
    description:
      'Similarity score (0–1) of the auto-match. Omitted when the user picked the match manually.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  matchConfidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateBomDto {
  @ApiProperty({ description: 'Project the BOM is linked to.' })
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({
    description: 'Source doc-intelligence extraction job the BOM was reviewed from.',
  })
  @IsOptional()
  @IsUUID()
  extractionId?: string;

  @ApiProperty({ type: [CreateBomItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBomItemDto)
  items!: CreateBomItemDto[];
}

export class UpdateBomDto {
  @ApiProperty({
    type: [CreateBomItemDto],
    description:
      'Replacement line items for the BOM. The full set is replaced in place ' +
      '(existing lines deleted, these recreated) — this does NOT create a new ' +
      'BOM version. An empty array clears all lines.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBomItemDto)
  items!: CreateBomItemDto[];
}

export class BomListQueryDto {
  @ApiPropertyOptional({ description: 'Filter BOMs to one project.' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
