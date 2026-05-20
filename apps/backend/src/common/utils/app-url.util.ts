import { ConfigService } from '@nestjs/config';

/** Resolve the frontend app URL for a given user role */
export function getAppUrlForRole(config: ConfigService, _role: string): string {
  return config.get<string>('WEB_APP_URL') ?? config.get<string>('APP_URL', 'http://localhost:5179');
}
