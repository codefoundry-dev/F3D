import { getApiClient } from '../client';

import { AUDIT_PATHS } from './paths';
import type { PaginationMeta } from './users';

export interface AuditLogParams {
  page?: number;
  limit?: number;
  action?: string;
  targetType?: string;
  performedById?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditLogResponse {
  id: string;
  action: string;
  performedById: string;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  performedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PaginatedAuditLogsResponse {
  items: AuditLogResponse[];
  meta: PaginationMeta;
}

export async function getAuditLogs(params?: AuditLogParams): Promise<PaginatedAuditLogsResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedAuditLogsResponse }>(
    AUDIT_PATHS.ROOT,
    { params },
  );
  return data.data;
}
