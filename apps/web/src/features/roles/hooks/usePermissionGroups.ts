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
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(entry);
  }

  const order: PermissionDomain[] = [...KNOWN_DOMAINS, 'other'];
  return order
    .filter((d) => byDomain.has(d))
    .map((d) => ({ domain: d, entries: byDomain.get(d)!.sort((a, b) => a.key.localeCompare(b.key)) }));
}
