import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

// ── Query DTO ───────────────────────────────────────────────────────────────

export class BasePaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc' = 'desc';

  /** Computed skip for Prisma `findMany({ skip })` */
  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 25);
  }

  /** Alias for `limit` — for Prisma `findMany({ take })`, capped at 100 */
  get take(): number {
    return Math.min(this.limit ?? 25, 100);
  }
}

// ── Response Meta ───────────────────────────────────────────────────────────

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  page!: number;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(1)
  limit!: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  total!: number;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @Min(0)
  totalPages!: number;
}

/** Helper to build pagination meta from query + total count */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMetaDto {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
