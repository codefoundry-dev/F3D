/**
 * Human-facing invoice reference derived from the invoice id.
 *
 * Invoices carry no canonical number column, so every surface that shows one to
 * a user — the deliveries list, the rejection email, the payment reminders —
 * derives it the same way. Keep this the single definition: the reference is
 * quoted back to vendors in emails, so two formats would read as two documents.
 */
export function invoiceReference(invoiceId: string): string {
  return `INV-${invoiceId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
