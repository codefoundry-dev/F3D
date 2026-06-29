import { Transform } from 'class-transformer';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InviteVendorDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsEmail()
  companyEmail!: string;

  @IsString()
  @IsNotEmpty()
  userName!: string;

  @IsEmail()
  userEmail!: string;
}

export class VendorListQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  limit?: number = 25;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  specialisation?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'assignedAt';

  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc' = 'desc';
}

export interface AuthUser {
  id: string;
  role: string;
  companyId: string | null;
}

export class UpdateVendorProfileDto {
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() tradeName?: string;
  @IsOptional() @IsString() abn?: string;
  @IsOptional() @IsString() taxCode?: string;
  @IsOptional() @IsString() legalAddress?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) specialisations?: string[];
}

export class CreateWarehouseDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() city!: string;
  @IsString() @IsNotEmpty() postcode!: string;
  @IsString() @IsNotEmpty() address!: string;
}

export class UpdateWarehouseDto extends CreateWarehouseDto {}

export class InviteVendorUserDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() position!: string;
}

/**
 * Adds a vendor representative WITHOUT sending an invitation email (FOR-272).
 * Phone and position are optional; name and email are required and email
 * uniqueness is enforced server-side (same duplicate check as the invite flow).
 */
export class CreateVendorRepresentativeDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() position?: string;
}
