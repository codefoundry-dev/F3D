import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
} from 'class-validator';

import { ProjectStatus, LocationType } from '../enums';

import { BasePaginationQueryDto, PaginationMetaDto } from './pagination.dto';

// ── Nested DTOs ──────────────────────────────────────────────────────────────

export class ProjectLocationDto {
  @ApiProperty({ enum: LocationType })
  @IsEnum(LocationType)
  type!: LocationType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty()
  @IsBoolean()
  isDefault!: boolean;
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

export class CreateProjectDto {
  @ApiProperty({ example: 'Alpha Construction' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.PLANNED })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiProperty({ type: [ProjectLocationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectLocationDto)
  @ArrayMinSize(1)
  locations!: ProjectLocationDto[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  assignedUserIds!: string[];

  @ApiPropertyOptional({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  plannedBudget?: number;

  @ApiPropertyOptional({ default: 'AUD' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  pointOfContactId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expectedEndDate?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional({ type: [ProjectLocationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectLocationDto)
  @IsOptional()
  locations?: ProjectLocationDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  assignedUserIds?: string[];

  @ApiPropertyOptional({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  plannedBudget?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  pointOfContactId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expectedEndDate?: string;
}

export class AddProjectMembersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  userIds!: string[];
}

export class ProjectListQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by project type (free-text, e.g. Residential)' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    enum: ['code', 'name', 'createdAt', 'status', 'type', 'startDate', 'expectedEndDate'],
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class ProjectLocationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: LocationType })
  type!: LocationType;

  @ApiProperty()
  address!: string;

  @ApiPropertyOptional()
  label!: string | null;

  @ApiProperty()
  isDefault!: boolean;
}

export class ProjectMemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  workStatus!: string | null;

  @ApiProperty()
  assignedAt!: string;

  @ApiPropertyOptional()
  assignedBy?: { id: string; name: string };
}

export class ProjectMemberAvatarDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;
}

export class UserRefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ProjectListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'PRJ-2025-001' })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: ProjectStatus })
  status!: ProjectStatus;

  @ApiPropertyOptional()
  type!: string | null;

  @ApiProperty()
  defaultDeliveryLocation!: string;

  @ApiProperty()
  defaultStorageLocation!: string;

  @ApiProperty()
  memberCount!: number;

  @ApiProperty({ type: [ProjectMemberAvatarDto] })
  memberAvatars!: ProjectMemberAvatarDto[];

  @ApiPropertyOptional()
  startDate!: string | null;

  @ApiPropertyOptional()
  expectedEndDate!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class PaginatedProjectsResponseDto {
  @ApiProperty({ type: [ProjectListItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ProjectListItemDto)
  items!: ProjectListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  @ValidateNested()
  @Type(() => PaginationMetaDto)
  meta!: PaginationMetaDto;
}

export class ProjectResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'PRJ-2025-001' })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: ProjectStatus })
  status!: ProjectStatus;

  @ApiPropertyOptional()
  type!: string | null;

  @ApiProperty({ type: [ProjectLocationResponseDto] })
  locations!: ProjectLocationResponseDto[];

  @ApiProperty({ type: [ProjectMemberResponseDto] })
  assignedUsers!: ProjectMemberResponseDto[];

  @ApiPropertyOptional()
  plannedBudget!: number | null;

  @ApiProperty()
  usedBudget!: number;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional()
  startDate!: string | null;

  @ApiPropertyOptional()
  expectedEndDate!: string | null;

  @ApiPropertyOptional()
  pointOfContact!: UserRefDto | null;

  @ApiProperty()
  createdBy!: UserRefDto;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  activeBom!: null;

  @ApiProperty()
  rfqCount!: number;

  @ApiProperty()
  poCount!: number;

  @ApiProperty()
  invoiceCount!: number;

  @ApiProperty()
  vendorCount!: number;
}
