export const EMAIL_TEMPLATES = {
  INVITATION: 'invitation',
  OTP: 'otp',
  PASSWORD_RESET: 'password-reset',
  DEACTIVATION: 'deactivation',
  INVITATION_EXPIRED_NOTIFICATION: 'invitation-expired-notification',
  REACTIVATION: 'reactivation',
  VENDOR_INVITATION: 'vendor-invitation',
  VENDOR_COMPANY_INVITATION: 'vendor-company-invitation',
  RFQ_RECEIVED: 'rfq-received',
  PO_ISSUED: 'po-issued',
  CHANGE_REQUEST_PROPOSED: 'change-request-proposed',
  CHANGE_REQUEST_APPROVED: 'change-request-approved',
  CHANGE_REQUEST_REJECTED: 'change-request-rejected',
  BULK_ORDER_CANCELLED: 'bulk-order-cancelled',
  QUOTE_UPDATED: 'quote-updated',
  QUOTE_SUBMITTED: 'quote-submitted',
  PO_DECLINED_BY_VENDOR: 'po-declined-by-vendor',
  PO_PENDING_APPROVAL: 'po-pending-approval',
} as const;

export type EmailTemplateName = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES];
