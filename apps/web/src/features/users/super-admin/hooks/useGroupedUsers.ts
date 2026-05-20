import type { UserResponse } from '@forethread/api-client';
import { useMemo } from 'react';

export interface CompanyGroup {
  companyId: string;
  companyName: string;
  users: UserResponse[];
}

interface CompanyInfo {
  id: string;
  legalName: string;
}

const UNASSIGNED_ID = '__unassigned__';
const UNASSIGNED_NAME = 'Unassigned';

export function useGroupedUsers(
  users: UserResponse[] | undefined,
  allCompanies?: CompanyInfo[],
): CompanyGroup[] {
  return useMemo(() => {
    const map = new Map<string, CompanyGroup>();

    // First, seed the map with all known companies (even those with 0 users)
    if (allCompanies) {
      for (const company of allCompanies) {
        map.set(company.id, {
          companyId: company.id,
          companyName: company.legalName,
          users: [],
        });
      }
    }

    // Then, group users into their companies
    if (users?.length) {
      for (const user of users) {
        const companyId = user.company?.id ?? UNASSIGNED_ID;
        const companyName = user.company?.legalName ?? UNASSIGNED_NAME;

        let group = map.get(companyId);
        if (!group) {
          group = { companyId, companyName, users: [] };
          map.set(companyId, group);
        }
        group.users.push(user);
      }
    }

    if (map.size === 0) return [];

    return Array.from(map.values()).sort((a, b) => {
      if (a.companyId === UNASSIGNED_ID) return 1;
      if (b.companyId === UNASSIGNED_ID) return -1;
      return a.companyName.localeCompare(b.companyName);
    });
  }, [users, allCompanies]);
}
