// Client setup
export { createApiClient, initApiClient, getApiClient } from './client';

// Interceptors
export { applyAuthInterceptor, configureAuthInterceptor } from './interceptors/auth.interceptor';
export {
  applyErrorInterceptor,
  ApiRequestError,
  isApiError,
  HTTP_STATUS,
} from './interceptors/error.interceptor';
export type { ApiError } from './interceptors/error.interceptor';

// Endpoint functions
export * from './endpoints/auth';
export * from './endpoints/users';
export * from './endpoints/companies';
export * from './endpoints/projects';
export * from './endpoints/audit';
export * from './endpoints/google';
export * from './endpoints/rfqs';
export * from './endpoints/purchase-orders';
export * from './endpoints/materials';
export * from './endpoints/bulk-orders';
export * from './endpoints/invoices';
export * from './endpoints/dashboard';
export * from './endpoints/vendors';
export * from './endpoints/messages';
export * from './endpoints/views';
export * from './endpoints/roles';
export * from './endpoints/doc-extractions';
export * from './endpoints/boms';
export * from './endpoints/material-lists';

// Query key factory
export { queryKeys } from './queryKeys';

// Utilities
export { openFileInNewTab, downloadFile } from './utils/file-download';
