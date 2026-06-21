import {
  searchAddresses,
  updateCompany,
  type CompanyResponse,
  type UpdateCompanyDto,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalIconHeader,
  Button,
  Input,
  AddressInput,
  FormField,
  Alert,
  onPhoneOnly,
} from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

interface EditCompanyDetailsModalProps {
  company: CompanyResponse;
  onClose: () => void;
}

/**
 * "Edit Company Details" modal (US 1.09). Mirrors the Figma modal: icon-chip
 * header, full-width Company Name, then Legal Information (Legal Name + Trade
 * Name, ABN + Tax Code, Legal Address) and Contact Information (Contact Email +
 * Phone Number, Website), with a stacked full-width "Submit changes" / "Cancel"
 * footer. ABN + Tax Code are read-only (the platform doesn't allow editing them
 * here). Shared by the buyer Company Profile page and the super-admin Company
 * details page, so it refreshes both query caches on success.
 */
export function EditCompanyDetailsModal({ company, onClose }: EditCompanyDetailsModalProps) {
  const { t } = useTranslation(['company', 'common']);
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string>>({
    legalName: company.legalName || '',
    tradeName: company.tradeName ?? '',
    abn: company.abn ?? '',
    taxCode: company.taxCode ?? '',
    legalAddress: company.legalAddress ?? '',
    contactEmail: company.contactEmail ?? '',
    contactPhone: company.contactPhone ?? '',
    website: company.website ?? '',
  });

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateCompanyDto) => updateCompany(company.id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      onClose();
    },
  });

  const updateField = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleAddressSearch = useCallback((input: string) => searchAddresses(input), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emptyToUndefined = (v: string | undefined) =>
      v === '' || v === null || v === undefined ? undefined : v;
    updateMutation.mutate({
      legalName: formData.legalName,
      tradeName: emptyToUndefined(formData.tradeName),
      legalAddress: emptyToUndefined(formData.legalAddress),
      contactEmail: emptyToUndefined(formData.contactEmail),
      contactPhone: emptyToUndefined(formData.contactPhone),
      website: emptyToUndefined(formData.website),
    });
  };

  return (
    <Modal onClose={onClose}>
      <ModalBody>
        <ModalIconHeader
          icon={<EditIcon className="w-6 h-6 text-foreground" />}
          title={t('editModal.title')}
          subtitle={t('editModal.subtitle')}
          onClose={onClose}
          className="mb-6"
        />

        <form onSubmit={handleSubmit} className="space-y-6 text-left" noValidate>
          {updateMutation.isError && (
            <Alert variant="destructive">{t('editModal.updateError')}</Alert>
          )}

          {/* Company Name (full width) */}
          <FormField label={t('companyName')}>
            <Input
              value={formData.legalName}
              onChange={(e) => updateField('legalName', e.target.value)}
            />
          </FormField>

          {/* Legal Information */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">{t('legalInfo')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('legalName')}>
                <Input
                  value={formData.legalName}
                  onChange={(e) => updateField('legalName', e.target.value)}
                />
              </FormField>
              <FormField label={t('tradeName')}>
                <Input
                  value={formData.tradeName}
                  onChange={(e) => updateField('tradeName', e.target.value)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('abn')}>
                <Input value={formData.abn} readOnly />
              </FormField>
              <FormField label={t('taxCode')}>
                <Input value={formData.taxCode} readOnly />
              </FormField>
            </div>
            <FormField label={t('legalAddress')}>
              <AddressInput
                value={formData.legalAddress}
                placeholder={t('legalAddress')}
                searchFn={handleAddressSearch}
                onChange={(val) => updateField('legalAddress', val)}
              />
            </FormField>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">{t('contactInfo')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('contactEmail')}>
                <Input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                />
              </FormField>
              <FormField label={t('phoneNumber')}>
                <Input
                  type="tel"
                  inputMode="tel"
                  onKeyDown={onPhoneOnly}
                  value={formData.contactPhone}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                />
              </FormField>
            </div>
            <FormField label={t('website')}>
              <Input
                value={formData.website}
                onChange={(e) => updateField('website', e.target.value)}
              />
            </FormField>
          </div>

          {/* Footer: stacked full-width primary + outline */}
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
