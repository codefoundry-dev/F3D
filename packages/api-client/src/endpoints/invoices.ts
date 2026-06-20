import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { INVOICES_PATHS } from './paths';
import type { PaginationMeta } from './users';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  projectId?: string;
  vendorId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  amountMin?: number;
  amountMax?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface InvoiceDocument {
  id: string;
  name: string;
  fileId: string;
  uploadedBy: {
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  uploadedAt: string;
}

export interface InvoiceDetail {
  id: string;
  projectName: string;
  projectId: string;
  vendorName: string;
  status: string;
  relatedPo: string | null;
  totalAmount: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  documents: InvoiceDocument[];
}

export interface InvoiceListItem {
  id: string;
  projectName: string;
  projectId: string;
  /** Human-readable project code (PRJ-YYYY-NNN); shown wherever a "Project ID" is labelled. */
  projectCode: string;
  vendorName: string;
  status: string;
  relatedPo: string | null;
  totalAmount: number;
  dueDate: string | null;
}

export interface PaginatedInvoicesResponse {
  items: InvoiceListItem[];
  meta: PaginationMeta;
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getInvoices(
  params?: InvoiceListParams,
  config?: AxiosRequestConfig,
): Promise<PaginatedInvoicesResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedInvoicesResponse }>(
    INVOICES_PATHS.ROOT,
    { params, ...config },
  );
  return data.data;
}

export async function getInvoice(id: string, config?: AxiosRequestConfig): Promise<InvoiceDetail> {
  const { data } = await getApiClient().get<{ data: InvoiceDetail }>(
    INVOICES_PATHS.byId(id),
    config,
  );
  return data.data;
}

export async function approveInvoice(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().patch(INVOICES_PATHS.approve(id), undefined, config);
}

export async function rejectInvoice(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().patch(INVOICES_PATHS.reject(id), undefined, config);
}

export async function bulkApproveInvoices(
  ids: string[],
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().post(INVOICES_PATHS.BULK_APPROVE, { ids }, config);
}

// ── Export ───────────────────────────────────────────────────────────────

export async function exportInvoices(
  format: 'csv' | 'xlsx' | 'pdf',
  params?: InvoiceListParams & { ids?: string },
  config?: AxiosRequestConfig,
): Promise<{ url: string }> {
  const { data } = await getApiClient().get<{ data: { url: string } }>(
    INVOICES_PATHS.export(format),
    { params, ...config },
  );
  return data.data;
}

export async function exportSingleInvoice(
  id: string,
  format: 'csv' | 'xlsx' | 'pdf',
  config?: AxiosRequestConfig,
): Promise<{ url: string }> {
  const { data } = await getApiClient().get<{ data: { url: string } }>(
    INVOICES_PATHS.exportSingle(id, format),
    config,
  );
  return data.data;
}

// ── Document CRUD ────────────────────────────────────────────────────────

export async function uploadInvoiceDocument(
  invoiceId: string,
  file: File,
  config?: AxiosRequestConfig,
): Promise<InvoiceDocument> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: InvoiceDocument }>(
    INVOICES_PATHS.documents(invoiceId),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, ...config },
  );
  return data.data;
}

export async function deleteInvoiceDocument(
  invoiceId: string,
  docId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().delete(INVOICES_PATHS.document(invoiceId, docId), config);
}
