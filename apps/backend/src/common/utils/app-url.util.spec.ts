import { ConfigService } from '@nestjs/config';

import { getAppUrlForRole } from './app-url.util';

describe('getAppUrlForRole', () => {
  const mockConfig = {
    get: jest.fn(),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the correct URL for SUPER_ADMIN role', () => {
    (mockConfig.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'SUPER_ADMIN_APP_URL') return 'http://localhost:3001';
      return undefined;
    });

    expect(getAppUrlForRole(mockConfig, 'SUPER_ADMIN')).toBe('http://localhost:3001');
  });

  it('returns the correct URL for COMPANY_ADMIN role', () => {
    (mockConfig.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'COMPANY_ADMIN_APP_URL') return 'http://localhost:3002';
      return undefined;
    });

    expect(getAppUrlForRole(mockConfig, 'COMPANY_ADMIN')).toBe('http://localhost:3002');
  });

  it('returns the correct URL for VENDOR role', () => {
    (mockConfig.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'VENDOR_APP_URL') return 'http://localhost:3003';
      return undefined;
    });

    expect(getAppUrlForRole(mockConfig, 'VENDOR')).toBe('http://localhost:3003');
  });

  it('maps Foreman to CompanyAdmin app URL', () => {
    (mockConfig.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'COMPANY_ADMIN_APP_URL') return 'http://localhost:3002';
      return undefined;
    });

    expect(getAppUrlForRole(mockConfig, 'FOREMAN')).toBe('http://localhost:3002');
  });

  it('falls back to APP_URL for unknown roles', () => {
    (mockConfig.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
      if (key === 'APP_URL') return 'http://localhost:3001';
      return defaultVal;
    });

    expect(getAppUrlForRole(mockConfig, 'UnknownRole')).toBe('http://localhost:3001');
  });

  it('falls back to default localhost:3001 when no env vars set', () => {
    (mockConfig.get as jest.Mock).mockImplementation((_key: string, defaultVal?: string) => {
      return defaultVal;
    });

    expect(getAppUrlForRole(mockConfig, 'UnknownRole')).toBe('http://localhost:3001');
  });
});
