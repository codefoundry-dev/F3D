import { describe, expect, it } from 'vitest';

import { groupCatalogByDomain } from './usePermissionGroups';

describe('groupCatalogByDomain', () => {
  it('groups entries by the prefix of the permission key', () => {
    const result = groupCatalogByDomain([
      { key: 'rfq.create', description: '' },
      { key: 'rfq.read', description: '' },
      { key: 'po.approve', description: '' },
      { key: 'user.list', description: '' },
    ]);

    expect(result.map((g) => g.domain)).toEqual(['rfq', 'po', 'user']);
    expect(result.find((g) => g.domain === 'rfq')!.entries.map((e) => e.key)).toEqual([
      'rfq.create',
      'rfq.read',
    ]);
  });

  it('lumps unknown prefixes into the "other" bucket', () => {
    const result = groupCatalogByDomain([
      { key: 'unknownDomain.action', description: '' },
      { key: 'rfq.read', description: '' },
    ]);

    const buckets = result.map((g) => g.domain);
    expect(buckets).toContain('other');
    expect(buckets).toContain('rfq');
  });

  it('returns groups in canonical domain order, not insertion order', () => {
    const result = groupCatalogByDomain([
      { key: 'user.list', description: '' },
      { key: 'dashboard.viewPoCa', description: '' },
      { key: 'rfq.read', description: '' },
    ]);

    expect(result.map((g) => g.domain)).toEqual(['dashboard', 'rfq', 'user']);
  });
});
