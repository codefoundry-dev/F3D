import { VendorCategory } from '@forethread/shared-types';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * Filter sentinel for vendors carrying no Vendor Category at all. Category is
 * only mandatory on the create-new path (ADR-0018), so untagged vendors exist
 * by design — they must stay reachable rather than silently dropping out of
 * every category-driven view.
 */
export const UNCATEGORISED = 'UNCATEGORISED';

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

  /**
   * Optional Vendor Categories for the assignment this invite creates
   * (ADR-0018). Optional by design: the invite flow often does not yet know
   * what the vendor supplies, and a guessed category misroutes RFQs more
   * damagingly than an empty one the buyer can see in the Uncategorised bucket.
   */
  @IsOptional()
  @IsArray()
  @IsEnum(VendorCategory, { each: true })
  categories?: VendorCategory[];
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

  /**
   * Legacy free-text filter over `Company.specialisations`. Superseded by
   * `category` (ADR-0018) and kept only so existing saved views keep working.
   */
  @IsOptional()
  @IsString()
  specialisation?: string;

  /**
   * Comma-separated `VendorCategory` keys, optionally including
   * {@link UNCATEGORISED}. Matches a vendor carrying **any** of them.
   */
  @IsOptional()
  @IsString()
  category?: string;

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

  /**
   * One-off vendors (FOR-395) are hidden by default. `true` includes every
   * one-off (the vendor list's "Show one-off vendors" filter).
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeOneOff?: boolean;

  /** Comma-separated project ids whose one-off vendors to include (RFQ/PO wizards). */
  @IsOptional()
  @IsString()
  projectIds?: string;

  /** Only one-off vendors (the project Vendors tab), combined with `projectIds`. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  oneOffOnly?: boolean;
}

/**
 * Adds a one-off vendor from a project's Vendors tab (FOR-395): a light record
 * (name + email, no portal invite) usable on that project only.
 */
export class CreateOneOffVendorDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @IsEmail()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
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

/**
 * Sets the Vendor Categories a contractor applies to one of its vendors
 * (ADR-0018). Replace-semantics: the supplied array becomes the whole set, and
 * an empty array clears it. Scoped to the caller's own `CompanyVendorAssignment`
 * — one contractor's categorisation is invisible to every other.
 */
export class UpdateVendorCategoriesDto {
  @IsArray()
  @IsEnum(VendorCategory, { each: true })
  categories!: VendorCategory[];
}

/**
 * Resolves "add every vendor in this category" to concrete ids (ADR-0018).
 * Deliberately not paginated: the whole point is completeness, and the browser
 * must not be the thing that decides who is sendable.
 */
export class ResolveVendorSelectionDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /** Projects of the RFQ being built: their one-off vendors are included (FOR-395). */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  projectIds?: string[];
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
  // Optional to match the invite forms, where position is an optional field
  // (FOR-289 — a required check here silently 400'd invites sent without one).
  @IsOptional() @IsString() position?: string;
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
