import {
  getVendors,
  inviteVendor,
  createCompany,
  resendInvitation,
  cancelInvitation,
  deactivateUser,
  getVendorProfile,
  updateVendorProfile,
  addWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getCompanyLogoUrl,
  uploadCompanyLogo,
  type VendorListParams,
  type InviteVendorDto,
  type CreateCompanyDto,
  type UpdateVendorProfileInput,
  type CreateWarehouseInput,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const VENDORS_KEY = 'vendors';

export function useVendors(params?: VendorListParams) {
  return useQuery({
    queryKey: [VENDORS_KEY, params],
    queryFn: () => getVendors(params),
  });
}

export function useInviteVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: InviteVendorDto) => inviteVendor(dto, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.refetchQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useCreateVendorCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateCompanyDto) => createCompany(dto),
    onSuccess: () => {
      void queryClient.refetchQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useResendVendorInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => resendInvitation(userId, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useCancelVendorInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => cancelInvitation(userId, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useVendorProfile(companyId: string) {
  return useQuery({
    queryKey: [VENDORS_KEY, 'profile', companyId],
    queryFn: () => getVendorProfile(companyId),
    enabled: !!companyId,
  });
}

export function useUpdateVendorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateVendorProfileInput }) =>
      updateVendorProfile(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useArchiveVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deactivateUser(userId, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useAddWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vendorId, input }: { vendorId: string; input: CreateWarehouseInput }) =>
      addWarehouse(vendorId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      vendorId,
      warehouseId,
      input,
    }: {
      vendorId: string;
      warehouseId: string;
      input: CreateWarehouseInput;
    }) => updateWarehouse(vendorId, warehouseId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vendorId, warehouseId }: { vendorId: string; warehouseId: string }) =>
      deleteWarehouse(vendorId, warehouseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

const LOGO_URL_KEY = 'vendor-logo-url';

export function useVendorLogoUrl(companyId: string) {
  return useQuery({
    queryKey: [LOGO_URL_KEY, companyId],
    queryFn: () => getCompanyLogoUrl(companyId),
    enabled: !!companyId,
    select: (d) => d.url,
  });
}

export function useUploadVendorLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, file }: { companyId: string; file: File }) =>
      uploadCompanyLogo(companyId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [LOGO_URL_KEY] });
    },
  });
}
