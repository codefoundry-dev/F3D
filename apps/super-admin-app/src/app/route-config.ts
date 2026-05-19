export const ROUTES = {
  home: '/',
  login: '/login',
  verifyOtp: '/verify-otp',
  activate: '/activate',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  users: '/settings/users',
  userDetail: '/settings/users/:id',
  companyDetail: '/companies/:id',
  adminPanel: '/admin-panel',
  settings: '/settings',
} as const;
