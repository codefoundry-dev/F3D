import { useTranslation } from '@forethread/i18n';
import { notificationService } from '@forethread/ui-components';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { editUserFormSchema, type EditUserFormValues } from '../schemas/user-form.schema';
import { useUser, useUpdateUser } from '../services/users.service';
import { useUsersStore } from '../state/users.store';

export function useEditUserForm(onClose: () => void) {
  const { t } = useTranslation('users');
  const editUserId = useUsersStore((s) => s.editUserId);
  const { data: user, isLoading: isLoadingUser } = useUser(editUserId ?? '');
  const updateMutation = useUpdateUser();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
  });

  const { reset } = form;

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        role: user.role,
        position: user.position ?? '',
        department: '',
      });
    }
  }, [user, reset]);

  const handleSubmit = form.handleSubmit((data) => {
    if (!editUserId) return;
    updateMutation.mutate(
      {
        id: editUserId,
        dto: {
          name: data.name,
          role: data.role,
          position: data.position || undefined,
          phone: data.phone || undefined,
        },
      },
      {
        onSuccess: () => {
          notificationService.success(t('editModal.updateSuccess'));
          onClose();
        },
      },
    );
  });

  return {
    form,
    handleSubmit,
    updateMutation,
    isLoadingUser,
  };
}
