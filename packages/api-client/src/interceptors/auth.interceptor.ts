import { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  retry: () => unknown;
}

/**
 * Encapsulated auth interceptor state per client instance.
 * Avoids global mutable state that leaks between tests and client instances.
 */
class AuthInterceptorState {
  onUnauthorized: (() => void) | null = null;
  isRefreshing = false;
  pendingRequests: PendingRequest[] = [];

  reset(): void {
    this.isRefreshing = false;
    this.pendingRequests = [];
  }
}

/** WeakMap ensures state is garbage-collected when the client is */
const stateByClient = new WeakMap<AxiosInstance, AuthInterceptorState>();

function getState(client: AxiosInstance): AuthInterceptorState {
  let state = stateByClient.get(client);
  if (!state) {
    state = new AuthInterceptorState();
    stateByClient.set(client, state);
  }
  return state;
}

/** Provide an onUnauthorized callback for a specific client instance */
export function configureAuthInterceptor(client: AxiosInstance, onUnauthorized: () => void): void {
  getState(client).onUnauthorized = onUnauthorized;
}

export function applyAuthInterceptor(client: AxiosInstance): void {
  const state = getState(client);

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      const url = originalRequest.url ?? '';

      // Public pre-auth endpoints: a 401 here means bad credentials or a bad/
      // expired/superseded OTP — NOT an expired session. Never attempt a token
      // refresh (it would fire a spurious /auth/refresh round-trip on every wrong
      // password or wrong OTP) and never clear auth.
      if (url.includes('/auth/login') || url.includes('/auth/verify-otp')) {
        return Promise.reject(error);
      }

      // A 401 from refresh/logout means the session is truly gone.
      if (url.includes('/auth/refresh') || url.includes('/auth/logout')) {
        state.onUnauthorized?.();
        return Promise.reject(error);
      }

      if (state.isRefreshing) {
        // Queue this request until refresh completes
        return new Promise<unknown>((resolve, reject) => {
          state.pendingRequests.push({
            resolve,
            reject,
            retry: () => client(originalRequest),
          });
        });
      }

      state.isRefreshing = true;
      originalRequest._retry = true;

      try {
        // Call refresh — cookies are sent automatically via withCredentials.
        // Body must be an object (not null), otherwise axios serializes `null` to the
        // literal string "null" and Express's strict JSON parser rejects it.
        await client.post('/auth/refresh', {}, { skipErrorHandler: true });

        // Replay queued requests
        state.pendingRequests.forEach((req) => req.resolve(req.retry()));
        state.pendingRequests = [];

        return await client(originalRequest);
      } catch {
        // Reject all queued requests so their promises settle
        state.pendingRequests.forEach((req) => req.reject(error));
        state.pendingRequests = [];
        state.onUnauthorized?.();
        return Promise.reject(error);
      } finally {
        state.isRefreshing = false;
      }
    },
  );
}
