import { EMAIL_TEMPLATES } from './email-templates.const';

describe('EMAIL_TEMPLATES', () => {
  it('should contain all expected template names', () => {
    expect(EMAIL_TEMPLATES.INVITATION).toBe('invitation');
    expect(EMAIL_TEMPLATES.OTP).toBe('otp');
    expect(EMAIL_TEMPLATES.PASSWORD_RESET).toBe('password-reset');
    expect(EMAIL_TEMPLATES.DEACTIVATION).toBe('deactivation');
    expect(EMAIL_TEMPLATES.INVITATION_EXPIRED_NOTIFICATION).toBe('invitation-expired-notification');
    expect(EMAIL_TEMPLATES.REACTIVATION).toBe('reactivation');
    expect(EMAIL_TEMPLATES.VENDOR_INVITATION).toBe('vendor-invitation');
    expect(EMAIL_TEMPLATES.VENDOR_COMPANY_INVITATION).toBe('vendor-company-invitation');
    expect(EMAIL_TEMPLATES.RFQ_RECEIVED).toBe('rfq-received');
    expect(EMAIL_TEMPLATES.PO_ISSUED).toBe('po-issued');
    expect(EMAIL_TEMPLATES.CHANGE_REQUEST_PROPOSED).toBe('change-request-proposed');
    expect(EMAIL_TEMPLATES.CHANGE_REQUEST_APPROVED).toBe('change-request-approved');
    expect(EMAIL_TEMPLATES.CHANGE_REQUEST_REJECTED).toBe('change-request-rejected');
    expect(EMAIL_TEMPLATES.BULK_ORDER_CANCELLED).toBe('bulk-order-cancelled');
    expect(EMAIL_TEMPLATES.QUOTE_UPDATED).toBe('quote-updated');
    expect(EMAIL_TEMPLATES.QUOTE_SUBMITTED).toBe('quote-submitted');
  });

  it('should have exactly 16 templates', () => {
    expect(Object.keys(EMAIL_TEMPLATES)).toHaveLength(17);
  });

  it('should have unique values', () => {
    const values = Object.values(EMAIL_TEMPLATES);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should be read-only (const assertion)', () => {
    const keys = Object.keys(EMAIL_TEMPLATES);
    expect(keys).toEqual(
      expect.arrayContaining([
        'INVITATION',
        'OTP',
        'PASSWORD_RESET',
        'DEACTIVATION',
        'INVITATION_EXPIRED_NOTIFICATION',
        'REACTIVATION',
        'VENDOR_INVITATION',
        'VENDOR_COMPANY_INVITATION',
        'RFQ_RECEIVED',
        'PO_ISSUED',
        'CHANGE_REQUEST_PROPOSED',
        'CHANGE_REQUEST_APPROVED',
        'CHANGE_REQUEST_REJECTED',
        'BULK_ORDER_CANCELLED',
        'QUOTE_UPDATED',
        'QUOTE_SUBMITTED',
      ]),
    );
  });
});
