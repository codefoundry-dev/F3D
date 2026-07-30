import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  inviteVendorUserSchema,
  type InviteVendorUserFormValues,
} from '../schemas/invite-form.schema';
import { useInviteVendorUser } from '../services/vendor-users.service';
import { useVendorUsersStore } from '../state/vendor-users.store';

export function useInviteVendorUserForm(onClose: () => void) {
  const inviteMutation = useInviteVendorUser();
  const openSuccessModal = useVendorUsersStore((s) => s.openSuccessModal);
  const [showUserExists, setShowUserExists] = useState(false);
  const [showError, setShowError] = useState(false);

  const form = useForm<InviteVendorUserFormValues>({
    resolver: zodResolver(inviteVendorUserSchema),
  });

  const handleSubmit = form.handleSubmit((data) => {
    setShowError(false);
    inviteMutation.mutate(
      {
        name: data.name,
        email: data.email,
        // The DTO rejects an empty string — omit the field when blank (FOR-289)
        position: data.position?.trim() ? data.position.trim() : undefined,
      },
      {
        onSuccess: () => {
          onClose();
          openSuccessModal(data.email);
        },
        onError: (error) => {
          const apiError = error as { statusCode?: number };
          if (apiError.statusCode === 409) setShowUserExists(true);
          else setShowError(true);
        },
      },
    );
  });

  return {
    form,
    handleSubmit,
    inviteMutation,
    showUserExists,
    closeUserExists: () => setShowUserExists(false),
    showError,
  };
}
