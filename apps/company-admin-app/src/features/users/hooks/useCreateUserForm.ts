import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useAuthStore } from '@/features/auth/state/auth.store';

import { createUserFormSchema, type CreateUserFormValues } from '../schemas/user-form.schema';
import { useCreateUser } from '../services/users.service';
import { useUsersStore } from '../state/users.store';

export function useCreateUserForm(onClose: () => void) {
  const companyId = useAuthStore((s) => s.currentUser?.companyId);
  const openSuccessModal = useUsersStore((s) => s.openSuccessModal);
  const createMutation = useCreateUser();
  const [showUserExists, setShowUserExists] = useState(false);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
  });

  const handleSubmit = form.handleSubmit((data) => {
    if (!companyId) return;
    createMutation.mutate(
      { ...data, companyId },
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

  const errorMessage = (createMutation.error as { message?: string })?.message ?? null;
  const isEmailInUseError = errorMessage?.toLowerCase().includes('email') ?? false;

  return {
    form,
    handleSubmit,
    createMutation,
    isEmailInUseError,
    showUserExists,
    closeUserExists: () => setShowUserExists(false),
  };
}
