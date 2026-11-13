import {
  getVendors,
  inviteVendor,
  createCompany,
  inviteVendorUser,
  resendVendorUserInvitation,
  cancelVendorUserInvitation,
  deactivateUser,
  getVendorProfile,
  updateVendorProfile,
  updateVendorCategories,
  addWarehouse,
  updateWarehouse,
  deleteWarehouse,
  addVendorRepresentative,
  getCompanyLogoUrl,
  uploadVendorLogo,
  type VendorListParams,
  type InviteVendorDto,
  type CreateCompanyDto,
  type InviteVendorUserInput,
  type UpdateVendorProfileInput,
  type CreateWarehouseInput,
  type CreateVendorRepresentativeInput,
  promoteOneOffVendor,
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

/**
 * Invitation lifecycle uses the company-scoped vendor endpoints (ADR-0016,
 * FOR-289): resend re-mints the activation token, cancel only revokes it — the
 * rep stays as a contact. The /users/:id equivalents are buyer-company
 * internal (and cancel there deletes the user), so they must not be used for
 * vendor reps.
 */
export function useResendVendorInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, userId }: { companyId: string; userId: string }) =>
      resendVendorUserInvitation(companyId, userId, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

export function useCancelVendorInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, userId }: { companyId: string; userId: string }) =>
      cancelVendorUserInvitation(companyId, userId, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}

/**
 * Invites a user to a specific vendor company (POST /vendors/:id/users/invite).
 * Works for the vendor's own admins AND buyers with vendor.user.invite —
 * unlike the invite-vendor-company flow, which is buyer-only (FOR-289).
 */
export function useInviteVendorUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vendorId, input }: { vendorId: string; input: InviteVendorUserInput }) =>
      inviteVendorUser(vendorId, input, { skipErrorHandler: true }),
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

/**
 * Sets the Vendor Categories this contractor applies to a vendor (ADR-0018).
 * Separate from useUpdateVendorProfile because it writes the *assignment*, not
 * the company — a distinction the two endpoints exist to keep visible.
 */
export function useUpdateVendorCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, categories }: { id: string; categories: string[] }) =>
      updateVendorCategories(id, categories),
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

/**
 * Adds a vendor representative without sending an invitation email (FOR-272).
 * Uses `skipErrorHandler` so the caller can surface duplicate-email (409)
 * errors on the offending draft row instead of a generic global toast.
 */
export function useAddVendorRepresentative() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      vendorId,
      input,
    }: {
      vendorId: string;
      input: CreateVendorRepresentativeInput;
    }) => addVendorRepresentative(vendorId, input, { skipErrorHandler: true }),
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
      uploadVendorLogo(companyId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [LOGO_URL_KEY] });
    },
  });
}

/** Make a one-off vendor (FOR-395) a full vendor of the company. */
export function usePromoteOneOffVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vendorId: string) => promoteOneOffVendor(vendorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] });
    },
  });
}
