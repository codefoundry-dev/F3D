import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

import { CompanyStatus, CompanyType } from '../enums';

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateCompanyDto {
  @ApiProperty({ enum: CompanyType })
  @IsEnum(CompanyType)
  type!: CompanyType;

  @ApiProperty({ example: 'Acme Constructions Pty Ltd' })
  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @ApiPropertyOptional({ example: 'Acme Constructions' })
  @IsString()
  @IsOptional()
  tradeName?: string;

  @ApiPropertyOptional({ example: '51 824 753 556', description: 'Australian Business Number' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{9,11}$/, { message: 'ABN must be 9–11 digits' })
  abn?: string;

  @ApiPropertyOptional({ example: '123 Pitt Street, Sydney NSW 2000' })
  @IsString()
  @IsOptional()
  legalAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  website?: string;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  legalName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tradeName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  legalAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  website?: string;
}

export class CompanyListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  limit?: number = 25;

  @ApiPropertyOptional({ enum: CompanyType })
  @IsEnum(CompanyType)
  @IsOptional()
  type?: CompanyType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['name', 'createdAt'] })
  @IsOptional()
  sortBy?: 'name' | 'createdAt' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  sortDir?: 'asc' | 'desc' = 'desc';
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class CompanyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: CompanyType })
  type!: CompanyType;

  @ApiProperty()
  legalName!: string;

  @ApiPropertyOptional()
  tradeName?: string;

  @ApiProperty()
  abn!: string;

  @ApiProperty()
  legalAddress!: string;

  @ApiPropertyOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  contactPhone?: string;

  @ApiPropertyOptional()
  website?: string;

  @ApiPropertyOptional()
  logoUrl?: string;

  @ApiProperty({ enum: CompanyStatus })
  status!: CompanyStatus;

  @ApiProperty()
  userCount!: number;

  @ApiProperty()
  createdAt!: string;
}
