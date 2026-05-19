import {
  getCompany,
  getCompanyDocuments,
  getFileUrl,
  updateCompany,
  searchAddresses,
  type UpdateCompanyDto,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Spinner,
  Input,
  AddressInput,
  FormField,
  Alert,
  onPhoneOnly,
} from '@forethread/ui-components';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import LegalNameIcon from '@forethread/ui-components/assets/icons/legal-name.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import MyAbnIcon from '@forethread/ui-components/assets/icons/my-abn.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import TaxIcon from '@forethread/ui-components/assets/icons/tax.svg?react';
import TradeNameIcon from '@forethread/ui-components/assets/icons/trade-name.svg?react';
import WebIcon from '@forethread/ui-components/assets/icons/web.svg?react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useAuthStore } from '@/features/auth/state/auth.store';

import { useCompanyLogo } from '../hooks/useCompanyLogo';

const COMPANY_KEY = 'company-profile';
const DOCS_KEY = 'company-documents';

function useCompanyProfile() {
  const companyId = useAuthStore((s) => s.currentUser?.companyId);

  return useQuery({
    queryKey: [COMPANY_KEY, companyId],
    queryFn: () => getCompany(companyId as string),
    enabled: Boolean(companyId),
  });
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-2 text-sm text-foreground">
        <span className="text-foreground shrink-0">{icon}</span>
        <span>{value ?? '—'}</span>
      </div>
    </div>
  );
}

export default function CompanyProfilePage() {
  const { t } = useTranslation(['company', 'common']);
  const companyId = useAuthStore((s) => s.currentUser?.companyId);
  const { data: company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const { logoUrl, inputRef, isPending, handleLogoChange, openFilePicker } = useCompanyLogo(
    companyId ?? undefined,
  );

  const { data: documents } = useQuery({
    queryKey: [DOCS_KEY, companyId],
    queryFn: () => getCompanyDocuments(companyId as string),
    enabled: Boolean(companyId),
  });

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateCompanyDto) => {
      if (!company) throw new Error('Company not loaded');
      return updateCompany(company.id, dto);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [COMPANY_KEY] });
      setIsEditing(false);
    },
  });

  const handleEdit = () => {
    if (!company) return;
    setFormData({
      legalName: company.legalName || '',
      tradeName: company.tradeName ?? '',
      abn: company.abn ?? '',
      taxCode: company.taxCode ?? '',
      legalAddress: company.legalAddress ?? '',
      contactEmail: company.contactEmail ?? '',
      contactPhone: company.contactPhone ?? '',
      website: company.website ?? '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    updateMutation.reset();
  };

  const handleSubmit = () => {
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

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddressSearch = useCallback((input: string) => searchAddresses(input), []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="md" />
      </div>
    );
  }

  if (!company) return null;

  const initials = company.legalName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const handleView = async (fileId: string) => {
    const newTab = window.open('', '_blank');
    const { url } = await getFileUrl(fileId);
    if (newTab) {
      newTab.location.href = url;
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    const { url } = await getFileUrl(fileId);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6">
      <div className="rounded-xl border border-border bg-card p-8">
        {/* ── Company card header ── */}
        <div className="flex items-center gap-5 mb-8">
          {/* Avatar with edit overlay */}
          <div className="relative">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={company.legalName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted text-foreground flex items-center justify-center font-semibold text-lg">
                {initials}
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.svg"
              className="hidden"
              onChange={handleLogoChange}
            />
            <button
              type="button"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Change avatar"
              onClick={openFilePicker}
              disabled={isPending}
            >
              {isPending ? <Spinner size="sm" /> : <EditIcon className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-foreground">{company.legalName}</h2>
            {company.contactEmail && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <EnvelopeIcon className="w-4 h-4" />
                <span>{company.contactEmail}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  isLoading={updateMutation.isPending}
                >
                  {t('editModal.submit')}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  {t('common:cancel')}
                </Button>
              </>
            ) : (
              <Button variant="outline" className="gap-2" onClick={handleEdit}>
                <EditIcon className="w-4 h-4" />
                {t('editProfile')}
              </Button>
            )}
          </div>
        </div>

        {/* ── Error alert ── */}
        {updateMutation.isError && (
          <div className="mb-6">
            <Alert variant="destructive">{t('editModal.updateError')}</Alert>
          </div>
        )}

        {/* ── Legal Information ── */}
        <section className="mb-8">
          <h3 className="text-base font-bold text-foreground mb-4">{t('legalInfo')}</h3>
          {isEditing ? (
            <>
              <div className="grid grid-cols-4 gap-6 mb-4">
                <FormField label={t('legalName')}>
                  <Input
                    leftIcon={<LegalNameIcon className="w-5 h-5" />}
                    value={formData.legalName}
                    onChange={(e) => updateField('legalName', e.target.value)}
                  />
                </FormField>
                <FormField label={t('tradeName')}>
                  <Input
                    leftIcon={<TradeNameIcon className="w-5 h-5" />}
                    value={formData.tradeName}
                    onChange={(e) => updateField('tradeName', e.target.value)}
                  />
                </FormField>
                <FormField label={t('abn')}>
                  <Input
                    leftIcon={<MyAbnIcon className="w-5 h-5" />}
                    value={formData.abn}
                    readOnly
                  />
                </FormField>
                <FormField label={t('taxCode')}>
                  <Input
                    leftIcon={<TaxIcon className="w-5 h-5" />}
                    value={formData.taxCode}
                    readOnly
                  />
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
            </>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-6 mb-4">
                <InfoItem
                  icon={<LegalNameIcon className="w-4 h-4" />}
                  label={t('legalName')}
                  value={company.legalName}
                />
                <InfoItem
                  icon={<TradeNameIcon className="w-4 h-4" />}
                  label={t('tradeName')}
                  value={company.tradeName}
                />
                <InfoItem
                  icon={<MyAbnIcon className="w-4 h-4" />}
                  label={t('abn')}
                  value={company.abn}
                />
                <InfoItem
                  icon={<TaxIcon className="w-4 h-4" />}
                  label={t('taxCode')}
                  value={company.taxCode}
                />
              </div>
              <InfoItem
                icon={<LocationIcon className="w-4 h-4" />}
                label={t('legalAddress')}
                value={company.legalAddress}
              />
            </>
          )}
          <hr className="border-border mt-6" />
        </section>

        {/* ── Contact Information ── */}
        <section className="mb-8">
          <h3 className="text-base font-bold text-foreground mb-4">{t('contactInfo')}</h3>
          {isEditing ? (
            <div className="grid grid-cols-3 gap-6">
              <FormField label={t('contactEmail')}>
                <Input
                  type="email"
                  leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                  value={formData.contactEmail}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                />
              </FormField>
              <FormField label={t('phoneNumber')}>
                <Input
                  type="tel"
                  inputMode="tel"
                  onKeyDown={onPhoneOnly}
                  leftIcon={<PhoneIcon className="w-5 h-5" />}
                  value={formData.contactPhone}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                />
              </FormField>
              <FormField label={t('website')}>
                <Input
                  leftIcon={<WebIcon className="w-5 h-5" />}
                  value={formData.website}
                  onChange={(e) => updateField('website', e.target.value)}
                />
              </FormField>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              <InfoItem
                icon={<EnvelopeIcon className="w-4 h-4" />}
                label={t('contactEmail')}
                value={company.contactEmail}
              />
              <InfoItem
                icon={<PhoneIcon className="w-4 h-4" />}
                label={t('phoneNumber')}
                value={company.contactPhone}
              />
              <InfoItem
                icon={<WebIcon className="w-4 h-4" />}
                label={t('website')}
                value={company.website}
              />
            </div>
          )}
          <hr className="border-border mt-6" />
        </section>

        {/* ── Specialisations ── */}
        {company.specialisations.length > 0 && (
          <section className="mb-8">
            <h3 className="text-base font-bold text-foreground mb-4">{t('specialisations')}</h3>
            <div className="flex flex-wrap gap-2">
              {company.specialisations.map((spec) => (
                <span
                  key={spec}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-muted text-foreground border border-border"
                >
                  {spec}
                </span>
              ))}
            </div>
            <hr className="border-border mt-6" />
          </section>
        )}

        {/* ── Compliance documents ── */}
        <section>
          <h3 className="text-base font-bold text-foreground mb-4">{t('complianceDocuments')}</h3>

          {!documents?.length ? (
            <p className="text-sm text-muted-foreground">{t('noDocuments')}</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-lg border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{doc.file.filename}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {/* Uploader avatar + email */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                          {(doc.file.uploadedBy?.email?.[0] ?? '?').toUpperCase()}
                        </div>
                        <span>{doc.file.uploadedBy?.email ?? '—'}</span>
                      </div>
                      {/* Date */}
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View"
                      onClick={() => void handleView(doc.file.id)}
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Download"
                      onClick={() => void handleDownload(doc.file.id, doc.file.filename)}
                    >
                      <DownloadIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
