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

/** How an invoice entered the system (FOR-290). */
export type InvoiceSource = 'MANUAL' | 'EMAIL';

export interface InvoiceDocument {
  id: string;
  name: string;
  fileId: string;
  /** Null for documents that arrived on the intake email inbox (FOR-290). */
  uploadedBy: {
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  uploadedAt: string;
}

/** One line item extracted from the invoice document (FOR-291), mirroring shared-types. */
export interface InvoiceExtractionLine {
  lineId: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

/** The Gemini extraction result for an invoice (FOR-291), mirroring shared-types. */
export interface InvoiceExtractionResult {
  vendorName: string | null;
  invoiceNumber: string | null;
  poReferences: string[];
  issuedDate: string | null;
  dueDate: string | null;
  paymentTerms: string | null;
  currency: string | null;
  subTotal: number | null;
  taxLabel: string | null;
  taxRate: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  items: InvoiceExtractionLine[];
  notes: string | null;
}

/** The latest extraction job for an invoice; result is null until COMPLETED. */
export interface InvoiceExtractionInfo {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CONFIRMED' | 'FAILED';
  errorCode: string | null;
  completedAt: string | null;
  result: InvoiceExtractionResult | null;
}

/** A billed line as saved at review (FOR-291). */
export interface InvoiceLine {
  id: string;
  lineId: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

// project/vendor/totalAmount are null on intake-created invoices that haven't
// been reviewed yet (FOR-290).
export interface InvoiceDetail {
  id: string;
  projectName: string | null;
  projectId: string | null;
  vendorName: string | null;
  status: string;
  source: InvoiceSource;
  /** The address an email-intake invoice came from; null for manual uploads. */
  senderEmail: string | null;
  relatedPo: string | null;
  totalAmount: number | null;
  dueDate: string | null;
  /** The vendor's own invoice number, set at review (FOR-291). */
  invoiceNumber: string | null;
  issuedDate: string | null;
  /** When a human confirmed/corrected the extracted fields; null until reviewed. */
  reviewedAt: string | null;
  lines: InvoiceLine[];
  extraction: InvoiceExtractionInfo | null;
  createdAt: string;
  updatedAt: string;
  documents: InvoiceDocument[];
}

/** The reviewer's confirmed/corrected fields (FOR-291). Replace semantics. */
export interface ReviewInvoicePayload {
  vendorId?: string | null;
  projectId?: string | null;
  invoiceNumber?: string | null;
  issuedDate?: string | null;
  dueDate?: string | null;
  totalAmount?: number | null;
  lines: {
    lineId?: string | null;
    description: string;
    quantity?: number | null;
    unit?: string | null;
    unitPrice?: number | null;
    lineTotal?: number | null;
  }[];
}

export interface InvoiceListItem {
  id: string;
  projectName: string | null;
  projectId: string | null;
  /** Human-readable project code (PRJ-YYYY-NNN); shown wherever a "Project ID" is labelled. */
  projectCode: string | null;
  vendorName: string | null;
  status: string;
  source: InvoiceSource;
  relatedPo: string | null;
  totalAmount: number | null;
  dueDate: string | null;
  /** The vendor's own invoice number, set at review (FOR-291). */
  invoiceNumber: string | null;
}

/** Result of POST /invoices/upload — the invoice created from the file (FOR-290). */
export interface UploadedInvoice {
  id: string;
  status: string;
  source: InvoiceSource;
  createdAt: string;
  documents: { id: string; name: string; fileId: string }[];
}

/** The company's invoice-intake inbox; email is null when not configured. */
export interface InvoiceIntakeAddress {
  email: string | null;
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

/**
 * Persist the reviewer's confirmed/corrected fields and line items (FOR-291).
 * Replace semantics: every save writes the full set of reviewed fields.
 */
export async function reviewInvoice(
  id: string,
  payload: ReviewInvoicePayload,
  config?: AxiosRequestConfig,
): Promise<InvoiceDetail> {
  const { data } = await getApiClient().patch<{ data: InvoiceDetail }>(
    INVOICES_PATHS.review(id),
    payload,
    config,
  );
  return data.data;
}

export async function approveInvoice(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().patch(INVOICES_PATHS.approve(id), undefined, config);
}

/**
 * Reject an invoice / raise a discrepancy. The optional reason is persisted on
 * the invoice and quoted back to the vendor in the rejection email.
 */
export async function rejectInvoice(
  id: string,
  reason?: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().patch(INVOICES_PATHS.reject(id), reason ? { reason } : {}, config);
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

// ── Intake (FOR-290) ─────────────────────────────────────────────────────

/** Upload an invoice file, creating a new Pending invoice with it attached. */
export async function uploadInvoice(
  file: File,
  config?: AxiosRequestConfig,
): Promise<UploadedInvoice> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: UploadedInvoice }>(
    INVOICES_PATHS.UPLOAD,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, ...config },
  );
  return data.data;
}

/** The company's invoice-intake email address (null when not configured). */
export async function getInvoiceIntakeAddress(
  config?: AxiosRequestConfig,
): Promise<InvoiceIntakeAddress> {
  const { data } = await getApiClient().get<{ data: InvoiceIntakeAddress }>(
    INVOICES_PATHS.INTAKE_ADDRESS,
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
