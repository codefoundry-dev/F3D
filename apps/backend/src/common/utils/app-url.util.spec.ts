import { ConfigService } from '@nestjs/config';

import { getAppUrlForRole } from './app-url.util';

describe('getAppUrlForRole', () => {
  const mockConfig = {
    get: jest.fn(),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns WEB_APP_URL for every role', () => {
    (mockConfig.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'WEB_APP_URL') return 'http://localhost:5179';
      return undefined;
    });

    expect(getAppUrlForRole(mockConfig, 'SUPER_ADMIN')).toBe('http://localhost:5179');
    expect(getAppUrlForRole(mockConfig, 'COMPANY_ADMIN')).toBe('http://localhost:5179');
    expect(getAppUrlForRole(mockConfig, 'VENDOR')).toBe('http://localhost:5179');
    expect(getAppUrlForRole(mockConfig, 'FOREMAN')).toBe('http://localhost:5179');
  });

  it('falls back to APP_URL when WEB_APP_URL is not set', () => {
    (mockConfig.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
      if (key === 'APP_URL') return 'http://localhost:3000';
      return defaultVal;
    });

    expect(getAppUrlForRole(mockConfig, 'COMPANY_ADMIN')).toBe('http://localhost:3000');
  });

  it('falls back to default localhost:5179 when no env vars set', () => {
    (mockConfig.get as jest.Mock).mockImplementation((_key: string, defaultVal?: string) => {
      return defaultVal;
    });

    expect(getAppUrlForRole(mockConfig, 'UnknownRole')).toBe('http://localhost:5179');
  });
});
