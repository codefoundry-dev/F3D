import { updateCompany, type CompanyResponse, type UpdateCompanyDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  FormField,
  Button,
  Alert,
  IconBadge,
} from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import UserIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

interface EditCompanyModalProps {
  company: CompanyResponse;
  onClose: () => void;
}

export function EditCompanyModal({ company, onClose }: EditCompanyModalProps) {
  const { t } = useTranslation(['company', 'common', 'validation']);
  const queryClient = useQueryClient();

  const schema = z.object({
    legalName: z.string().min(1, t('validation:nameRequired')),
  });

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalName: company.legalName,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateCompanyDto) => updateCompany(company.id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      onClose();
    },
  });

  const onSubmit = (data: FormData) => {
    updateMutation.mutate({ legalName: data.legalName });
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
            <Input
              placeholder={t('companyNamePlaceholder')}
              leftIcon={<UserIcon className="w-5 h-5" />}
              {...register('legalName')}
            />
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
