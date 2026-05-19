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

  const form = useForm<InviteVendorUserFormValues>({
    resolver: zodResolver(inviteVendorUserSchema),
  });

  const handleSubmit = form.handleSubmit((data) => {
    inviteMutation.mutate(
      { name: data.name, email: data.email, position: data.position || '' },
      {
        onSuccess: () => {
          onClose();
          openSuccessModal(data.email);
        },
        onError: (error) => {
          const apiError = error as { statusCode?: number };
          if (apiError.statusCode === 409) {
            setShowUserExists(true);
          }
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
  };
}
