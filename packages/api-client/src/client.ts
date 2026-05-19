import axios, { AxiosInstance } from 'axios';

export function createApiClient(baseURL: string, appId?: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      ...(appId ? { 'X-App-Id': appId } : {}),
    },
    withCredentials: true,
  });

  return instance;
}

// Singleton instance — configured once at app startup
let _client: AxiosInstance | null = null;

export function initApiClient(baseURL: string, appId?: string): AxiosInstance {
  _client = createApiClient(baseURL, appId);
  return _client;
}

export function getApiClient(): AxiosInstance {
  _client ??= createApiClient('/v1');
  return _client;
}
