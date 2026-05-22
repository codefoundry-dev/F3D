import type { PermissionCatalogEntry } from '@forethread/api-client';

export type PermissionDomain =
  | 'dashboard'
  | 'project'
  | 'company'
  | 'invoice'
  | 'material'
  | 'bulkOrder'
  | 'message'
  | 'vendor'
  | 'rfq'
  | 'po'
  | 'role'
  | 'user'
  | 'other';

const KNOWN_DOMAINS: readonly PermissionDomain[] = [
  'dashboard',
  'project',
  'company',
  'invoice',
  'material',
  'bulkOrder',
  'message',
  'vendor',
  'rfq',
  'po',
  'role',
  'user',
];

export interface PermissionGroup {
  domain: PermissionDomain;
  entries: PermissionCatalogEntry[];
}

export function groupCatalogByDomain(catalog: PermissionCatalogEntry[]): PermissionGroup[] {
  const byDomain = new Map<PermissionDomain, PermissionCatalogEntry[]>();

  for (const entry of catalog) {
    const prefix = entry.key.split('.')[0] as PermissionDomain;
    const domain: PermissionDomain = (KNOWN_DOMAINS as readonly string[]).includes(prefix)
      ? prefix
      : 'other';
    const existing = byDomain.get(domain) ?? [];
    existing.push(entry);
    byDomain.set(domain, existing);
  }

  const order: PermissionDomain[] = [...KNOWN_DOMAINS, 'other'];
  return order.flatMap((d) => {
    const entries = byDomain.get(d);
    if (!entries) return [];
    return [{ domain: d, entries: entries.sort((a, b) => a.key.localeCompare(b.key)) }];
  });
}
