import {
  updateCompany,
  searchAddresses,
  type CompanyResponse,
  type UpdateCompanyDto,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  AddressInput,
  FormField,
  Button,
  Alert,
  IconBadge,
  onPhoneOnly,
} from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { editCompanySchema, type EditCompanyFormData } from '../schemas/company-form.schema';

interface EditCompanyModalProps {
  company: CompanyResponse;
  onClose: () => void;
}

export function EditCompanyModal({ company, onClose }: EditCompanyModalProps) {
  const { t } = useTranslation(['company', 'common']);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditCompanyFormData>({
    resolver: zodResolver(editCompanySchema),
    defaultValues: {
      legalName: company.legalName,
      tradeName: company.tradeName ?? '',
      abn: company.abn ?? '',
      taxCode: company.taxCode ?? '',
      legalAddress: company.legalAddress ?? '',
      contactEmail: company.contactEmail ?? '',
      contactPhone: company.contactPhone ?? '',
      website: company.website ?? '',
    },
  });

  useEffect(() => {
    reset({
      legalName: company.legalName,
      tradeName: company.tradeName ?? '',
      abn: company.abn ?? '',
      taxCode: company.taxCode ?? '',
      legalAddress: company.legalAddress ?? '',
      contactEmail: company.contactEmail ?? '',
      contactPhone: company.contactPhone ?? '',
      website: company.website ?? '',
    });
  }, [company, reset]);

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateCompanyDto) => updateCompany(company.id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      onClose();
    },
  });

  const handleAddressSearch = useCallback((input: string) => searchAddresses(input), []);

  const onSubmit = (data: EditCompanyFormData) => {
    const emptyToUndefined = (v: string | undefined) =>
      v === '' || v === null || v === undefined ? undefined : v;
    updateMutation.mutate({
      legalName: data.legalName,
      tradeName: emptyToUndefined(data.tradeName),
      abn: emptyToUndefined(data.abn),
      taxCode: emptyToUndefined(data.taxCode),
      legalAddress: emptyToUndefined(data.legalAddress),
      contactEmail: emptyToUndefined(data.contactEmail),
      contactPhone: emptyToUndefined(data.contactPhone),
      website: emptyToUndefined(data.website),
    });
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-5" noValidate>
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-2">
            <div className="w-full flex justify-between items-start">
              <div className="flex-1" />
              <IconBadge icon={<EditIcon className="w-6 h-6 text-foreground" />} />
              <div className="flex-1 flex justify-end">
                <ModalCloseButton onClose={onClose} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mt-4">{t('editModal.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('editModal.subtitle')}</p>
          </div>

          {/* Company Name */}
          <FormField label={t('companyName')} error={errors.legalName?.message} required>
            <Input placeholder={t('companyName')} {...register('legalName')} />
          </FormField>

          {/* Legal Information */}
          <h3 className="text-sm font-bold text-foreground pt-1">{t('legalInfo')}</h3>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('legalName')}>
              <Input placeholder={t('legalName')} {...register('legalName')} />
            </FormField>
            <FormField label={t('tradeName')}>
              <Input placeholder={t('tradeName')} {...register('tradeName')} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('abn')} error={errors.abn?.message}>
              <Input placeholder={t('abn')} {...register('abn')} />
            </FormField>
            <FormField label={t('taxCode')} error={errors.taxCode?.message}>
              <Input placeholder={t('taxCode')} {...register('taxCode')} />
            </FormField>
          </div>

          <FormField label={t('legalAddress')}>
            <AddressInput
              value={watch('legalAddress')}
              placeholder={t('legalAddress')}
              searchFn={handleAddressSearch}
              onChange={(val) => setValue('legalAddress', val, { shouldDirty: true })}
            />
          </FormField>

          {/* Contact Information */}
          <h3 className="text-sm font-bold text-foreground pt-1">{t('contactInfo')}</h3>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('contactEmail')} error={errors.contactEmail?.message}>
              <Input type="email" placeholder={t('contactEmail')} {...register('contactEmail')} />
            </FormField>
            <FormField label={t('contactPhone')}>
              <Input
                type="tel"
                inputMode="tel"
                onKeyDown={onPhoneOnly}
                placeholder={t('contactPhone')}
                {...register('contactPhone')}
              />
            </FormField>
          </div>

          <FormField label={t('website')}>
            <Input placeholder={t('website')} {...register('website')} />
          </FormField>

          {/* Error */}
          {updateMutation.isError && (
            <Alert variant="destructive">{t('editModal.updateError')}</Alert>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" isLoading={updateMutation.isPending} className="w-full">
              {updateMutation.isPending ? t('editModal.submitting') : t('editModal.submit')}
            </Button>
            <Button variant="outline" type="button" onClick={onClose} className="w-full">
              {t('common:cancel')}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
