import { useTranslation } from '@forethread/i18n';
import { notificationService } from '@forethread/ui-components';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import {
  editVendorUserFormSchema,
  type EditVendorUserFormValues,
} from '../schemas/edit-form.schema';
import { useVendorUser, useUpdateVendorUser } from '../services/vendor-users.service';
import { useVendorUsersStore } from '../state/vendor-users.store';

export function useEditVendorUserForm(onClose: () => void) {
  const { t } = useTranslation('vendorUsers');
  const editUserId = useVendorUsersStore((s) => s.editUserId);
  const { data: user, isLoading: isLoadingUser } = useVendorUser(editUserId ?? '');
  const updateMutation = useUpdateVendorUser();

  const form = useForm<EditVendorUserFormValues>({
    resolver: zodResolver(editVendorUserFormSchema),
  });

  const { reset } = form;

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        position: user.position ?? '',
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
