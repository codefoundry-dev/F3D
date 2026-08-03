export const INVOICE_ROUTES = {
  invoices: '/invoices',
  invoiceDetail: '/invoices/:id',
  // The manual-upload intake page (FOR-290) — "create" an invoice = upload it.
  invoiceCreate: '/invoices/upload',
} as const;
