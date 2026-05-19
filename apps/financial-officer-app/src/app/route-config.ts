export const ROUTES = {
  home: '/',
  login: '/login',
  verifyOtp: '/verify-otp',
  activate: '/activate',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  invoices: '/invoices',
  invoiceDetail: '/invoices/:id',
  settings: '/settings',
  me: '/me',
} as const;

export function invoiceDetailPath(id: string) {
  return `/invoices/${id}`;
}
