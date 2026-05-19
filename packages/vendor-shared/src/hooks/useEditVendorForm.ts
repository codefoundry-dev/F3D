import { getUser, updateUser, type UpdateUserDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { notificationService } from '@forethread/ui-components';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useVendorsStore } from '../state/vendors.store';

const editVendorUserSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  email: z.string().email(),
  phone: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
});

export type EditVendorUserFormValues = z.infer<typeof editVendorUserSchema>;

export function useEditVendorForm(onClose: () => void) {
  const { t } = useTranslation('vendors');
  const editVendorUserId = useVendorsStore((s) => s.editVendorUserId);
  const queryClient = useQueryClient();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['users', editVendorUserId],
    queryFn: () => getUser(editVendorUserId!),
    enabled: !!editVendorUserId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => updateUser(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const form = useForm<EditVendorUserFormValues>({
    resolver: zodResolver(editVendorUserSchema),
  });

  const { reset } = form;

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        position: user.position ?? '',
        department: user.department ?? '',
      });
    }
  }, [user, reset]);

  const handleSubmit = form.handleSubmit((data) => {
    if (!editVendorUserId) return;
    updateMutation.mutate(
      {
        id: editVendorUserId,
        dto: {
          name: data.name,
          position: data.position || undefined,
          phone: data.phone || undefined,
        },
      },
      {
        onSuccess: () => {
          notificationService.success(t('editVendorModal.updateSuccess'));
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
