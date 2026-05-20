import { CompanyStatus, CompanyType } from '@forethread/shared-types/client';

import { getApiClient } from '../client';

import { COMPANIES_PATHS, STORAGE_PATHS } from './paths';

export interface CreateCompanyDto {
  type: CompanyType;
  legalName: string;
  tradeName?: string;
  abn?: string;
  taxCode?: string;
  legalAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  specialisations?: string[];
  assignedContractorIds?: string[];
}

export interface AssignVendorsDto {
  contractorIds: string[];
}

export interface VendorAssignment extends CompanyResponse {
  assignedAt: string;
}

export interface UpdateCompanyDto {
  legalName?: string;
  tradeName?: string;
  abn?: string;
  taxCode?: string;
  legalAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  status?: CompanyStatus;
  specialisations?: string[];
}

export interface CompanyListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: CompanyType;
  status?: CompanyStatus;
}

export interface CompanyResponse {
  id: string;
  type: string;
  legalName: string;
  tradeName: string | null;
  abn: string | null;
  taxCode: string | null;
  legalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  logoUrl: string | null;
  status: string;
  specialisations: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export interface PaginatedCompaniesResponse {
  items: CompanyResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function getCompanies(
  params?: CompanyListParams,
): Promise<PaginatedCompaniesResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedCompaniesResponse }>(
    COMPANIES_PATHS.ROOT,
    { params },
  );
  return data.data;
}

export async function createCompany(dto: CreateCompanyDto): Promise<CompanyResponse> {
  const { data } = await getApiClient().post<{ data: CompanyResponse }>(COMPANIES_PATHS.ROOT, dto);
  return data.data;
}

export async function getCompany(id: string): Promise<CompanyResponse> {
  const { data } = await getApiClient().get<{ data: CompanyResponse }>(COMPANIES_PATHS.byId(id));
  return data.data;
}

export async function updateCompany(id: string, dto: UpdateCompanyDto): Promise<CompanyResponse> {
  const { data } = await getApiClient().patch<{ data: CompanyResponse }>(
    COMPANIES_PATHS.byId(id),
    dto,
  );
  return data.data;
}

export async function getCompanyVendors(id: string): Promise<VendorAssignment[]> {
  const { data } = await getApiClient().get<{ data: VendorAssignment[] }>(
    COMPANIES_PATHS.vendors(id),
  );
  return data.data;
}

export async function assignVendorsToContractor(
  id: string,
  dto: AssignVendorsDto,
): Promise<VendorAssignment[]> {
  const { data } = await getApiClient().post<{ data: VendorAssignment[] }>(
    COMPANIES_PATHS.vendors(id),
    dto,
  );
  return data.data;
}

export async function removeVendorFromContractor(
  id: string,
  vendorId: string,
): Promise<{ message: string }> {
  const { data } = await getApiClient().delete<{ data: { message: string } }>(
    COMPANIES_PATHS.vendor(id, vendorId),
  );
  return data.data;
}

export async function getCompanyLogoUrl(id: string): Promise<{ url: string | null }> {
  const { data } = await getApiClient().get<{ data: { url: string | null } }>(
    COMPANIES_PATHS.logoUrl(id),
  );
  return data.data;
}

export async function uploadCompanyLogo(id: string, file: File): Promise<CompanyResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: CompanyResponse }>(
    COMPANIES_PATHS.logo(id),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export interface CompanyDocumentResponse {
  id: string;
  companyId: string;
  type: string;
  fileId: string;
  expiresAt: string | null;
  createdAt: string;
  file: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    uploadedBy?: { email: string };
  };
}

export async function getCompanyDocuments(id: string): Promise<CompanyDocumentResponse[]> {
  const { data } = await getApiClient().get<{ data: CompanyDocumentResponse[] }>(
    COMPANIES_PATHS.documents(id),
  );
  return data.data;
}

export async function uploadCompanyDocument(
  id: string,
  file: File,
  type?: string,
  expiresAt?: string,
): Promise<CompanyDocumentResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (type) formData.append('type', type);
  if (expiresAt) formData.append('expiresAt', expiresAt);
  const { data } = await getApiClient().post<{ data: CompanyDocumentResponse }>(
    COMPANIES_PATHS.documents(id),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function deleteCompanyDocument(
  id: string,
  docId: string,
): Promise<{ message: string }> {
  const { data } = await getApiClient().delete<{ data: { message: string } }>(
    COMPANIES_PATHS.document(id, docId),
  );
  return data.data;
}

export async function exportCompanyProfile(id: string): Promise<{ url: string }> {
  const { data } = await getApiClient().get<{ data: { url: string } }>(
    COMPANIES_PATHS.profileExport(id),
  );
  return data.data;
}

export async function exportCompanyDocuments(
  id: string,
  format: 'pdf' | 'csv',
): Promise<{ url: string }> {
  const { data } = await getApiClient().get<{ data: { url: string } }>(
    COMPANIES_PATHS.documentsExport(id, format),
  );
  return data.data;
}

export async function getFileUrl(fileId: string): Promise<{ url: string }> {
  const { data } = await getApiClient().get<{ data: { url: string } }>(
    STORAGE_PATHS.fileUrl(fileId),
  );
  return data.data;
}
