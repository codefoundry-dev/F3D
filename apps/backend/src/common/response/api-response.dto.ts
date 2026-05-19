import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  limit!: number;

  @ApiProperty({ example: 142 })
  total!: number;

  @ApiProperty({ example: 6 })
  totalPages!: number;

  @ApiPropertyOptional({ example: 5 })
  unreadCount?: number;
}

export class ApiResponseDto<T> {
  @ApiProperty({ example: true })
  success!: boolean;

  data!: T;

  @ApiPropertyOptional()
  meta?: PaginationMeta | Record<string, unknown>;

  @ApiPropertyOptional()
  error?: string;
}

export class PaginatedResponseDto<T> extends ApiResponseDto<T[]> {
  declare meta: PaginationMeta;
}

/** Helper to create a successful paginated response */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResponseDto<T> {
  const dto = new PaginatedResponseDto<T>();
  dto.success = true;
  dto.data = data;
  dto.meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
  return dto;
}
