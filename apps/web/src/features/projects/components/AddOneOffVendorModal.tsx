import {
  createOneOffVendor,
  type CreateOneOffVendorInput,
  type OneOffVendorResult,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, FormField, GridModal, Input } from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import VendorsIcon from '@forethread/ui-components/assets/icons/vendors.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  legalName: z.string().trim().min(1, 'Vendor name is required'),
  contactEmail: z.string().trim().email('Invalid email address'),
  contactPhone: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddOneOffVendorModalProps {
  projectId: string;
  onClose: () => void;
  onAdded: (result: OneOffVendorResult) => void;
}

/**
 * Short form for a one-off vendor (FOR-395): name + email (+ phone), no portal
 * invite or categories. The vendor can be sent an RFQ or PO for this project
 * straight away. A conflict (it is already a one-off on another project)
 * surfaces through the global API error toast.
 */
export function AddOneOffVendorModal({ projectId, onClose, onAdded }: AddOneOffVendorModalProps) {
  const { t } = useTranslation(['projects', 'common']);
  const create = useMutation({
    mutationFn: (input: CreateOneOffVendorInput) => createOneOffVendor(input),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit((values) =>
    create.mutate(
      {
        projectId,
        legalName: values.legalName,
        contactEmail: values.contactEmail,
        // The backend stores an empty phone as none.
        contactPhone: values.contactPhone,
      },
      { onSuccess: onAdded },
    ),
  );

  return (
    <GridModal
      onClose={onClose}
      maxWidth="max-w-[520px]"
      icon={<VendorsIcon className="size-6 text-gray-700" />}
      title={t('detail.vendorsTab.oneOff.modalTitle')}
      description={t('detail.vendorsTab.oneOff.modalSubtitle')}
      onSubmit={(e) => void onSubmit(e)}
      actions={
        <>
          <Button type="submit" size="lg" isLoading={create.isPending} className="w-full">
            {t('detail.vendorsTab.oneOff.submit')}
          </Button>
          <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
            {t('common:cancel')}
          </Button>
        </>
      }
    >
      <FormField label={t('detail.vendorsTab.oneOff.name')} error={errors.legalName?.message}>
        <Input
          type="text"
          placeholder={t('detail.vendorsTab.oneOff.namePlaceholder')}
          data-testid="one-off-vendor-name"
          {...register('legalName')}
        />
      </FormField>
      <FormField label={t('detail.vendorsTab.oneOff.email')} error={errors.contactEmail?.message}>
        <Input
          type="email"
          placeholder={t('detail.vendorsTab.oneOff.emailPlaceholder')}
          leftIcon={<EnvelopeIcon className="w-5 h-5" />}
          data-testid="one-off-vendor-email"
          {...register('contactEmail')}
        />
      </FormField>
      <FormField label={t('detail.vendorsTab.oneOff.phone')} error={errors.contactPhone?.message}>
        <Input type="tel" data-testid="one-off-vendor-phone" {...register('contactPhone')} />
      </FormField>
    </GridModal>
  );
}
