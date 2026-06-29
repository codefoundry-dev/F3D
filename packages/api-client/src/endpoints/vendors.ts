import type { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { VENDORS_PATHS } from './paths';

export interface InviteVendorDto {
  companyName: string;
  companyEmail: string;
  userName: string;
  userEmail: string;
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
  status: 'ACTIVE' | 'INVITED';
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
  specialisation?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

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
  specialisations: string[];
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

export interface VendorRepresentative {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  department: string | null;
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
  position: string;
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

export async function resendVendorUserInvitation(companyId: string, userId: string): Promise<void> {
  await getApiClient().post(VENDORS_PATHS.resendUserInvitation(companyId, userId));
}

export async function cancelVendorUserInvitation(companyId: string, userId: string): Promise<void> {
  await getApiClient().delete(VENDORS_PATHS.cancelUserInvitation(companyId, userId));
}
