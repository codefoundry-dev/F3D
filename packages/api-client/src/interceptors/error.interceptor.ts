import axios, { AxiosError, AxiosInstance } from 'axios';

// Augment Axios config so any request can opt out of the global error toast
declare module 'axios' {
  interface AxiosRequestConfig {
    skipErrorHandler?: boolean;
  }
}

export const HTTP_STATUS = {
  FORBIDDEN: 403,
  LOCKED: 423,
} as const;

export interface ApiError {
  message: string;
  statusCode: number;
  details?: unknown;
  correlationId?: string;
}

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly details: unknown;
  readonly correlationId?: string;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiRequestError';
    this.statusCode = apiError.statusCode;
    this.details = apiError.details;
    this.correlationId = apiError.correlationId;
  }

  /** Check if this error matches a specific status code and optional message */
  is(statusCode: number, message?: string): boolean {
    return this.statusCode === statusCode && (message === undefined || this.message === message);
  }
}

/** Type-safe check: is the error an ApiRequestError with given status (and optional message)? */
export function isApiError(error: unknown, statusCode: number, message?: string): boolean {
  return error instanceof ApiRequestError && error.is(statusCode, message);
}

// Debounce network-error toasts so transient outages (e.g. backend restart) don't spam the user
let _lastNetworkToastAt = 0;
const NETWORK_TOAST_DEBOUNCE_MS = 5_000;

export function applyErrorInterceptor(
  client: AxiosInstance,
  onError?: (message: string) => void,
): void {
  client.interceptors.response.use(
    (response) => response,
    (rawError: unknown) => {
      // Silently swallow cancelled/aborted requests (e.g. React StrictMode double-mount)
      if (axios.isCancel(rawError)) {
        return Promise.reject(new ApiRequestError({ message: 'Request cancelled', statusCode: 0 }));
      }

      const error = rawError as AxiosError<{
        error?: string;
        message?: string;
        statusCode?: number;
        correlationId?: string;
      }>;

      if (error.code === 'ERR_CANCELED') {
        return Promise.reject(new ApiRequestError({ message: 'Request cancelled', statusCode: 0 }));
      }

      const skip = error.config?.skipErrorHandler === true;

      if (error.response) {
        const { data, status } = error.response;
        const apiError: ApiError = {
          message:
            data?.error ?? data?.message ?? String(error.message ?? 'An unexpected error occurred'),
          statusCode: data?.statusCode ?? status,
          correlationId: data?.correlationId,
        };
        // Never toast 401s — they are handled by the auth interceptor (refresh / redirect)
        if (!skip && onError && status !== 401) onError(apiError.message);
        return Promise.reject(new ApiRequestError(apiError));
      }

      if (error.request) {
        const networkMsg = 'Network error — please check your connection';
        const now = Date.now();
        if (!skip && onError && now - _lastNetworkToastAt > NETWORK_TOAST_DEBOUNCE_MS) {
          _lastNetworkToastAt = now;
          onError(networkMsg);
        }
        return Promise.reject(
          new ApiRequestError({
            message: networkMsg,
            statusCode: 0,
          }),
        );
      }

      const configMsg = String(error.message ?? 'Request configuration error');
      if (!skip && onError) onError(configMsg);
      return Promise.reject(
        new ApiRequestError({
          message: configMsg,
          statusCode: 0,
        }),
      );
    },
  );
}
