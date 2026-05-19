import {
  getProjects,
  getCompanies,
  type ProjectListParams,
  type CompanyListParams,
} from '@forethread/api-client';
import type { FilterDropdownOption } from '@forethread/ui-components';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export function useProjectFilterOptions() {
  const { data } = useQuery({
    queryKey: ['projects-filter'],
    queryFn: () => getProjects({ limit: 200 } as ProjectListParams, { skipErrorHandler: true }),
  });

  const options: FilterDropdownOption[] = useMemo(
    () =>
      (data?.items ?? []).map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [data],
  );

  return options;
}

export function useVendorFilterOptions() {
  const { data } = useQuery({
    queryKey: ['companies-filter', 'VENDOR'],
    queryFn: () => getCompanies({ limit: 200, type: 'VENDOR' } as CompanyListParams),
  });

  const options: FilterDropdownOption[] = useMemo(
    () =>
      (data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.legalName,
      })),
    [data],
  );

  return options;
}

export function useContractorFilterOptions() {
  const { data } = useQuery({
    queryKey: ['companies-filter', 'CONTRACTOR'],
    queryFn: () => getCompanies({ limit: 200, type: 'CONTRACTOR' } as CompanyListParams),
  });

  const options: FilterDropdownOption[] = useMemo(
    () =>
      (data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.legalName,
      })),
    [data],
  );

  return options;
}
