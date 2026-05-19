import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { BasePaginationQueryDto, PaginationMetaDto } from './pagination.dto';

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class InviteVendorDto {
  @ApiProperty({ example: 'Acme Supplies Pty Ltd' })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({ example: 'info@acmesupplies.com' })
  @IsEmail()
  companyEmail!: string;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  userName!: string;

  @ApiProperty({ example: 'john@acmesupplies.com' })
  @IsEmail()
  userEmail!: string;
}

export class VendorListQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['INVITED', 'ACTIVE'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ enum: ['companyName', 'assignedAt', 'status'] })
  @IsString()
  @IsOptional()
  sortBy?: string = 'assignedAt';
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class VendorListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  companyName!: string;

  @ApiPropertyOptional()
  companyEmail!: string | null;

  @ApiPropertyOptional()
  contactName!: string | null;

  @ApiPropertyOptional()
  contactEmail!: string | null;

  @ApiProperty({ enum: ['INVITED', 'ACTIVE'] })
  status!: string;

  @ApiProperty()
  assignedAt!: string;
}

export class PaginatedVendorsResponseDto {
  @ApiProperty({ type: [VendorListItemDto] })
  items!: VendorListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class InviteVendorResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty()
  vendorCompanyId!: string;

  @ApiProperty({ description: 'Whether vendor already existed on the platform' })
  alreadyExisted!: boolean;
}
