import {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  type CompanyListParams,
  type CreateCompanyDto,
  type UpdateCompanyDto,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const COMPANIES_KEY = 'companies';

export function useCompanies(params?: CompanyListParams) {
  return useQuery({
    queryKey: [COMPANIES_KEY, params],
    queryFn: () => getCompanies(params),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: [COMPANIES_KEY, id],
    queryFn: () => getCompany(id),
    enabled: Boolean(id),
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateCompanyDto) => createCompany(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [COMPANIES_KEY] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCompanyDto }) => updateCompany(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [COMPANIES_KEY] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
