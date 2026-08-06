import type { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { VENDORS_PATHS } from './paths';

export interface InviteVendorDto {
  companyName: string;
  companyEmail: string;
  userName: string;
  userEmail: string;
  /** Optional Vendor Categories for the assignment this invite creates. */
  categories?: string[];
}

export interface InviteVendorResponse {
  message: string;
  vendorCompanyId: string;
  alreadyExisted: boolean;
}

export interface VendorRepresentativeItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  /** `INACTIVE` reps are unsendable — they must never be offered as, or swept
   *  into, an RFQ recipient selection (CONTEXT.md → Sales Rep). */
  status: VendorRepresentativeStatus;
  createdAt: string;
}

export interface VendorListItem {
  id: string;
  userId: string | null;
  companyId: string;
  companyName: string;
  companyEmail: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: 'INVITED' | 'ACTIVE';
  assignedAt: string;
  specialisations: string[];
  categories: string[];
  representatives: VendorRepresentativeItem[];
}

export interface VendorListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  /** @deprecated Legacy free-text filter over the vendor's self-declared
   *  specialisations. Use `category` — see ADR-0018. */
  specialisation?: string;
  /** Comma-separated VendorCategory keys, optionally including
   *  {@link UNCATEGORISED}. Matches a vendor carrying any of them. */
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Filter sentinel for vendors carrying no Vendor Category at all (ADR-0018). */
export const UNCATEGORISED = 'UNCATEGORISED';

export interface PaginatedVendorsResponse {
  items: VendorListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function inviteVendor(
  dto: InviteVendorDto,
  config?: AxiosRequestConfig,
): Promise<InviteVendorResponse> {
  const { data } = await getApiClient().post<{ data: InviteVendorResponse }>(
    VENDORS_PATHS.INVITE,
    dto,
    config,
  );
  return data.data;
}

export async function getVendors(params?: VendorListParams): Promise<PaginatedVendorsResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedVendorsResponse }>(
    VENDORS_PATHS.ROOT,
    { params },
  );
  return data.data;
}

// ── Vendor Categories (ADR-0018) ─────────────────────────────────────────────

/**
 * Sets the Vendor Categories the calling contractor applies to a vendor.
 * Replace-semantics — the array becomes the whole set, and `[]` clears it.
 * Scoped to the caller's own assignment; other contractors are unaffected.
 */
export async function updateVendorCategories(
  vendorId: string,
  categories: string[],
): Promise<{ vendorId: string; categories: string[] }> {
  const { data } = await getApiClient().patch<{
    data: { vendorId: string; categories: string[] };
  }>(VENDORS_PATHS.categories(vendorId), { categories });
  return data.data;
}

export interface ResolveVendorSelectionInput {
  category?: string;
  search?: string;
}

/** A vendor matched by {@link resolveVendorSelection}, carrying enough to render
 *  it in the picker even though it may lie beyond the loaded page. `repIds` are
 *  the *sendable* reps only — deactivated ones are already excluded. */
export interface ResolvedVendor {
  companyId: string;
  companyName: string;
  companyEmail: string | null;
  categories: string[];
  specialisations: string[];
  repIds: string[];
}

export interface ResolvedVendorSelection {
  vendors: ResolvedVendor[];
}

/**
 * Resolves a category filter to every matching vendor id plus their sendable
 * rep ids — the backing call for the RFQ wizard's "Add All".
 *
 * Unpaginated on purpose: the browser only ever holds a page of vendors, so
 * resolving this client-side would silently cap the selection. Deactivated reps
 * are excluded server-side, so the result is safe to select wholesale.
 */
export async function resolveVendorSelection(
  input: ResolveVendorSelectionInput,
): Promise<ResolvedVendorSelection> {
  const { data } = await getApiClient().post<{ data: ResolvedVendorSelection }>(
    VENDORS_PATHS.RESOLVE_SELECTION,
    input,
  );
  return data.data;
}

// ── Vendor Profile ───────────────────────────────────────────────────────────

export interface VendorProfile {
  id: string;
  legalName: string;
  tradeName: string | null;
  abn: string | null;
  taxCode: string | null;
  legalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  logoUrl: string | null;
  /** The vendor's own descriptive claim — drives nothing (ADR-0018). */
  specialisations: string[];
  /** The *viewing contractor's* classification of this vendor. Empty for a
   *  vendor viewing itself, and never another contractor's categories. */
  categories: string[];
  warehouseLocations: WarehouseLocation[];
  representatives: VendorRepresentative[];
}

export interface WarehouseLocation {
  id: string;
  name: string;
  city: string;
  postcode: string;
  address: string;
}

export type VendorRepresentativeStatus = 'INVITED' | 'ACTIVE' | 'INACTIVE';

export interface VendorRepresentative {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  department: string | null;
  status?: VendorRepresentativeStatus;
  createdAt?: string;
  /** True when an activation invitation has been sent and not yet accepted */
  invitePending?: boolean;
}

export interface VendorRepresentativeDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  department: string | null;
  avatarUrl: string | null;
  role: string;
  status: VendorRepresentativeStatus;
  createdAt: string;
  invitePending: boolean;
  invitedByName: string | null;
  companyId: string;
  companyName: string;
}

export interface UpdateVendorProfileInput {
  legalName?: string;
  tradeName?: string;
  abn?: string;
  taxCode?: string;
  legalAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  specialisations?: string[];
}

export interface CreateWarehouseInput {
  name: string;
  city: string;
  postcode: string;
  address: string;
}

interface VendorProfileRaw extends Omit<VendorProfile, 'representatives'> {
  users?: VendorRepresentative[];
  representatives?: VendorRepresentative[];
}

export async function getVendorProfile(id: string): Promise<VendorProfile> {
  const { data } = await getApiClient().get<{ data: VendorProfileRaw }>(VENDORS_PATHS.profile(id));
  const raw = data.data;
  return {
    ...raw,
    representatives: raw.representatives ?? raw.users ?? [],
  };
}

export async function updateVendorProfile(
  id: string,
  input: UpdateVendorProfileInput,
): Promise<VendorProfile> {
  const { data } = await getApiClient().patch<{ data: VendorProfile }>(
    VENDORS_PATHS.profile(id),
    input,
  );
  return data.data;
}

export async function addWarehouse(
  vendorId: string,
  input: CreateWarehouseInput,
): Promise<WarehouseLocation> {
  const { data } = await getApiClient().post<{ data: WarehouseLocation }>(
    VENDORS_PATHS.warehouses(vendorId),
    input,
  );
  return data.data;
}

export async function updateWarehouse(
  vendorId: string,
  warehouseId: string,
  input: CreateWarehouseInput,
): Promise<WarehouseLocation> {
  const { data } = await getApiClient().patch<{ data: WarehouseLocation }>(
    VENDORS_PATHS.warehouse(vendorId, warehouseId),
    input,
  );
  return data.data;
}

export async function deleteWarehouse(vendorId: string, warehouseId: string): Promise<void> {
  await getApiClient().delete(VENDORS_PATHS.warehouse(vendorId, warehouseId));
}

// ── Representatives ──────────────────────────────────────────────────────────

export async function getRepresentatives(vendorId: string): Promise<VendorRepresentative[]> {
  const { data } = await getApiClient().get<{ data: VendorRepresentative[] }>(
    VENDORS_PATHS.representatives(vendorId),
  );
  return data.data;
}

export interface CreateVendorRepresentativeInput {
  name: string;
  email: string;
  phone?: string;
  position?: string;
}

/**
 * Adds a representative to a vendor company WITHOUT sending an invitation email
 * (FOR-272). Email uniqueness is enforced server-side (409 on duplicate).
 */
export async function addVendorRepresentative(
  vendorId: string,
  input: CreateVendorRepresentativeInput,
  config?: AxiosRequestConfig,
): Promise<{
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
}> {
  const { data } = await getApiClient().post<{
    data: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      position: string;
      status: string;
    };
  }>(VENDORS_PATHS.representatives(vendorId), input, config);
  return data.data;
}

// ── Vendor User Invitation ───────────────────────────────────────────────────

export interface InviteVendorUserInput {
  name: string;
  email: string;
  position?: string;
}

export async function inviteVendorUser(
  companyId: string,
  input: InviteVendorUserInput,
  config?: AxiosRequestConfig,
): Promise<{ id: string; name: string; email: string }> {
  const { data } = await getApiClient().post<{
    data: { id: string; name: string; email: string };
  }>(VENDORS_PATHS.inviteUser(companyId), input, config);
  return data.data;
}

/**
 * Sends (first invite) or re-sends the activation invitation to an existing
 * representative. Buyer- and vendor-accessible (ADR-0016).
 */
export async function resendVendorUserInvitation(
  companyId: string,
  userId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().post(
    VENDORS_PATHS.resendUserInvitation(companyId, userId),
    undefined,
    config,
  );
}

/**
 * Revokes a pending invitation; the representative reverts to a contact-only
 * record (it is NOT deleted — use removeVendorRepresentative for that).
 */
export async function cancelVendorUserInvitation(
  companyId: string,
  userId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().delete(VENDORS_PATHS.cancelUserInvitation(companyId, userId), config);
}

export async function getVendorRepresentative(
  vendorId: string,
  userId: string,
): Promise<VendorRepresentativeDetail> {
  const { data } = await getApiClient().get<{ data: VendorRepresentativeDetail }>(
    VENDORS_PATHS.representative(vendorId, userId),
  );
  return data.data;
}

/**
 * Deletes a never-activated representative. 409 when the rep is ACTIVE or is
 * a selected contact on any RFQ (ADR-0016).
 */
export async function removeVendorRepresentative(vendorId: string, userId: string): Promise<void> {
  await getApiClient().delete(VENDORS_PATHS.representative(vendorId, userId));
}
