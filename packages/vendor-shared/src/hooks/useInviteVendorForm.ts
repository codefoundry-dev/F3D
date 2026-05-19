import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useInviteVendor, useVendors } from '../services/vendors.service';

const inviteVendorSchema = z.object({
  companyId: z.string().min(1, 'Company is required'),
  userName: z.string().min(1, 'Representative name is required'),
  userEmail: z.string().email('Invalid email address'),
  position: z.string().optional(),
});

export type InviteVendorFormValues = z.infer<typeof inviteVendorSchema>;

/** Maps API error messages to i18n-friendly error keys */
const ERROR_MAP: Array<{ pattern: string; key: string }> = [
  { pattern: 'already in your vendor list', key: 'alreadyAssigned' },
  { pattern: 'email already exists', key: 'emailInUse' },
];

function mapErrorToKey(message: string): string {
  const lower = message.toLowerCase();
  const match = ERROR_MAP.find((entry) => lower.includes(entry.pattern));
  return match?.key ?? 'inviteError';
}

interface UseInviteVendorFormParams {
  onClose: () => void;
  onSuccess: (email: string, alreadyExisted: boolean) => void;
}

export function useInviteVendorForm({ onClose, onSuccess }: UseInviteVendorFormParams) {
  const inviteMutation = useInviteVendor();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [showUserExists, setShowUserExists] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  // Store newly created company details so they're available before query refetch
  const [createdCompany, setCreatedCompany] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const { data: vendorsData } = useVendors({ limit: 1000 });

  const companyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    if (vendorsData?.items) {
      for (const vendor of vendorsData.items) {
        if (!seen.has(vendor.companyId)) {
          seen.set(vendor.companyId, vendor.companyName);
        }
      }
    }
    // Include newly created company even if query hasn't refetched yet
    if (createdCompany && !seen.has(createdCompany.id)) {
      seen.set(createdCompany.id, createdCompany.name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [vendorsData, createdCompany]);

  const form = useForm<InviteVendorFormValues>({
    resolver: zodResolver(inviteVendorSchema),
  });

  const selectedCompanyId = form.watch('companyId');

  const selectedCompanyName = useMemo(() => {
    return companyOptions.find((o) => o.value === selectedCompanyId)?.label ?? '';
  }, [companyOptions, selectedCompanyId]);

  const selectedCompanyEmail = useMemo(() => {
    if (!selectedCompanyId) return '';
    // Check created company first (available before query refetch)
    if (createdCompany && createdCompany.id === selectedCompanyId) {
      return createdCompany.email;
    }
    const vendor = vendorsData?.items?.find((v) => v.companyId === selectedCompanyId);
    return vendor?.companyEmail ?? '';
  }, [vendorsData, selectedCompanyId, createdCompany]);

  const onSubmit = form.handleSubmit((data) => {
    setErrorKey(null);
    inviteMutation.mutate(
      {
        companyName: selectedCompanyName,
        companyEmail: selectedCompanyEmail,
        userName: data.userName,
        userEmail: data.userEmail,
      },
      {
        onSuccess: (response) => {
          onClose();
          onSuccess(data.userEmail, response.alreadyExisted);
        },
        onError: (error) => {
          const apiError = error as { statusCode?: number; message?: string };
          if (apiError.statusCode === 409) {
            setShowUserExists(true);
            return;
          }
          const message = apiError.message ?? '';
          setErrorKey(mapErrorToKey(message));
        },
      },
    );
  });

  const handleCreateCompanySuccess = (
    companyId: string,
    companyName: string,
    companyEmail: string,
  ) => {
    setCreatedCompany({ id: companyId, name: companyName, email: companyEmail });
    setIsCreateCompanyOpen(false);
    form.setValue('companyId', companyId);
  };

  return {
    form,
    errorKey,
    companyOptions,
    isCreateCompanyOpen,
    setIsCreateCompanyOpen,
    onSubmit,
    handleCreateCompanySuccess,
    isPending: inviteMutation.isPending,
    showUserExists,
    closeUserExists: () => setShowUserExists(false),
  };
}
