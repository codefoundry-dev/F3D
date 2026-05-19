import { ConfigService } from '@nestjs/config';

/** Maps UserRole → env variable for the corresponding frontend app URL */
const ROLE_APP_URL_MAP: Record<string, string> = {
  SUPER_ADMIN: 'SUPER_ADMIN_APP_URL',
  COMPANY_ADMIN: 'COMPANY_ADMIN_APP_URL',
  PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER_APP_URL',
  FINANCIAL_OFFICER: 'FINANCIAL_OFFICER_APP_URL',
  WAREHOUSE_OFFICER: 'WAREHOUSE_OFFICER_APP_URL',
  FOREMAN: 'COMPANY_ADMIN_APP_URL',
  VENDOR: 'VENDOR_APP_URL',
};

/** Resolve the frontend app URL for a given user role */
export function getAppUrlForRole(config: ConfigService, role: string): string {
  const envKey = ROLE_APP_URL_MAP[role];
  if (envKey) {
    const url = config.get<string>(envKey);
    if (url) return url;
  }
  return config.get<string>('APP_URL', 'http://localhost:3001');
}
