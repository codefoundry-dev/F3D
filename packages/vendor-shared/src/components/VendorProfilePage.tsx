import { useTranslation } from '@forethread/i18n';
import {
  AvatarUpload,
  Button,
  FormField,
  Input,
  Spinner,
  CustomDropdown,
  AddressInput,
} from '@forethread/ui-components';
import AbnIcon from '@forethread/ui-components/assets/icons/abn.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import LegalNameIcon from '@forethread/ui-components/assets/icons/legal-name.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import TaxIcon from '@forethread/ui-components/assets/icons/tax.svg?react';
import WebIcon from '@forethread/ui-components/assets/icons/web.svg?react';
import WrenchIcon from '@forethread/ui-components/assets/icons/wrench.svg?react';
import { lazy, Suspense, useState } from 'react';

import { useAddressSearch } from '../hooks/useAddressSearch';
import { useVendorProfileForm } from '../hooks/useVendorProfileForm';

import { InfoItem } from './InfoItem';
import { RepresentativesSection } from './RepresentativesSection';
import { WarehouseCard } from './WarehouseCard';
import { WarehouseLocationFields } from './WarehouseLocationFields';

// Invite-user flow is lazy-loaded so the (svg-heavy) modal tree is only pulled
// in when the vendor opens it — keeps the profile page's test/render light.
const InviteVendorModal = lazy(() =>
  import('./InviteVendorModal').then((m) => ({ default: m.InviteVendorModal })),
);
const VendorInviteSuccessModal = lazy(() =>
  import('./VendorInviteSuccessModal').then((m) => ({ default: m.VendorInviteSuccessModal })),
);

interface VendorProfilePageProps {
  vendorId: string;
  onBack?: () => void;
  initialEdit?: boolean;
}

export default function VendorProfilePage({ vendorId, initialEdit }: VendorProfilePageProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const handleAddressSearch = useAddressSearch();

  const {
    profile,
    isLoading,
    logoUrl,
    isUploadingLogo,
    uploadLogo,
    isEditing,
    formData,
    formErrors,
    isDirty,
    hasValidationErrors,
    isSubmitting,
    specialisationOptions,
    updateField,
    handleEdit,
    handleCancel,
    handleSubmit,
    // Representatives
    repDrafts,
    repDraftErrors,
    handleRepDraftFieldChange,
    handleRepDraftBlur,
    handleAddRepDraft,
    handleRemoveRepDraft,
    // Warehouse
    newWarehouse,
    setNewWarehouse,
    warehouseDeletes,
    whErrors,
    handleWarehouseDelete,
    handleWarehousePageEditChange,
  } = useVendorProfileForm(vendorId, initialEdit);

  const [isInviteUserOpen, setIsInviteUserOpen] = useState(false);
  const [inviteSuccessEmail, setInviteSuccessEmail] = useState<string | null>(null);

  // "Add user" drops an inline draft row; in view mode it first flips to edit
  // (which seeds a single empty draft), matching the Figma where the action is
  // available from both states.
  const handleAddUser = () => {
    if (isEditing) handleAddRepDraft();
    else handleEdit();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="md" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t('vendors:profileNotFound', { defaultValue: 'Profile not found' })}
      </div>
    );
  }

  const companyName = profile.tradeName || profile.legalName || 'Vendor';

  return (
    <div className="p-6">
      <div className="rounded-xl border border-border bg-card p-8">
        {/* ── Header ── */}
        <div className="flex items-center gap-5 mb-8">
          <AvatarUpload
            name={companyName}
            avatarUrl={logoUrl}
            editable
            isUploading={isUploadingLogo}
            onUpload={uploadLogo}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-normal leading-8 text-foreground">{companyName}</h2>
            {profile.contactEmail && (
              <div className="flex items-center gap-1.5 text-base leading-6 text-muted-foreground mt-1">
                <EnvelopeIcon className="w-4 h-4" />
                <span>{profile.contactEmail}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={!isDirty || hasValidationErrors}
                >
                  {t('common:submit', { defaultValue: 'Submit' })}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  {t('common:cancel', { defaultValue: 'Cancel' })}
                </Button>
              </>
            ) : (
              <Button variant="outline" className="gap-2" onClick={handleEdit}>
                <EditIcon className="w-4 h-4" />
                {t('vendors:editProfile', { defaultValue: 'Edit Profile' })}
              </Button>
            )}
          </div>
        </div>

        {/* ── Legal Information ── */}
        <section className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {t('vendors:legalInformation', { defaultValue: 'Legal Information' })}
          </h3>
          {isEditing ? (
            <>
              <div className="grid grid-cols-4 gap-6 mb-4">
                <FormField
                  label={t('vendors:fields.legalName', { defaultValue: 'Legal Name' })}
                  error={formErrors.legalName}
                >
                  <Input
                    leftIcon={<LegalNameIcon className="w-5 h-5" />}
                    value={formData.legalName}
                    onChange={(e) => updateField('legalName', e.target.value)}
                  />
                </FormField>
                <FormField
                  label={t('vendors:fields.specialisation', { defaultValue: 'Specialisation' })}
                >
                  <CustomDropdown
                    options={specialisationOptions}
                    value={formData.specialisations}
                    onChange={(val) => updateField('specialisations', val)}
                    placeholder={t('vendors:fields.specialisationPlaceholder', {
                      defaultValue: 'Select specialisation',
                    })}
                    leftIcon={<WrenchIcon className="w-5 h-5" />}
                    searchable
                  />
                </FormField>
                <FormField
                  label={t('vendors:fields.abn', { defaultValue: 'ABN' })}
                  error={formErrors.abn}
                >
                  <Input
                    leftIcon={<AbnIcon className="w-5 h-5" />}
                    value={formData.abn}
                    onChange={(e) => updateField('abn', e.target.value)}
                  />
                </FormField>
                <FormField
                  label={t('vendors:fields.taxCode', { defaultValue: 'Tax Code' })}
                  error={formErrors.taxCode}
                >
                  <Input
                    leftIcon={<TaxIcon className="w-5 h-5" />}
                    value={formData.taxCode}
                    onChange={(e) => updateField('taxCode', e.target.value)}
                  />
                </FormField>
              </div>
              <FormField
                label={t('vendors:fields.legalAddress', { defaultValue: 'Legal Address' })}
                error={formErrors.legalAddress}
              >
                <AddressInput
                  value={formData.legalAddress}
                  placeholder={t('vendors:fields.legalAddress', { defaultValue: 'Legal Address' })}
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
                  label={t('vendors:fields.legalName', { defaultValue: 'Legal Name' })}
                  value={profile.legalName}
                />
                <InfoItem
                  icon={<WrenchIcon className="w-4 h-4" />}
                  label={t('vendors:fields.specialisation', { defaultValue: 'Specialisation' })}
                  value={
                    profile.specialisations
                      ?.map((s) =>
                        t(`vendorCategories.${s}` as `vendorCategories.ELECTRICAL`, {
                          defaultValue: s,
                        }),
                      )
                      .join(', ') || null
                  }
                />
                <InfoItem
                  icon={<AbnIcon className="w-4 h-4" />}
                  label={t('vendors:fields.abn', { defaultValue: 'ABN' })}
                  value={profile.abn}
                />
                <InfoItem
                  icon={<TaxIcon className="w-4 h-4" />}
                  label={t('vendors:fields.taxCode', { defaultValue: 'Tax Code' })}
                  value={profile.taxCode}
                />
              </div>
              <InfoItem
                icon={<LocationIcon className="w-4 h-4" />}
                label={t('vendors:fields.legalAddress', { defaultValue: 'Legal Address' })}
                value={profile.legalAddress}
              />
            </>
          )}
          <hr className="border-border mt-6" />
        </section>

        {/* ── Contact Information ── */}
        <section className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {t('vendors:contactInformation', { defaultValue: 'Contact Information' })}
          </h3>
          {isEditing ? (
            <div className="grid grid-cols-3 gap-6">
              <FormField
                label={t('vendors:fields.contactEmail', { defaultValue: 'Contact Email' })}
                error={formErrors.contactEmail}
              >
                <Input
                  leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                  value={formData.contactEmail}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                />
              </FormField>
              <FormField label={t('vendors:fields.phoneNumber', { defaultValue: 'Phone Number' })}>
                <Input
                  leftIcon={<PhoneIcon className="w-5 h-5" />}
                  value={formData.contactPhone}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                />
              </FormField>
              <FormField
                label={t('vendors:fields.website', { defaultValue: 'Website' })}
                error={formErrors.website}
              >
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
                label={t('vendors:fields.contactEmail', { defaultValue: 'Contact Email' })}
                value={profile.contactEmail}
              />
              <InfoItem
                icon={<PhoneIcon className="w-4 h-4" />}
                label={t('vendors:fields.phoneNumber', { defaultValue: 'Phone Number' })}
                value={profile.contactPhone}
              />
              <InfoItem
                icon={<WebIcon className="w-4 h-4" />}
                label={t('vendors:fields.website', { defaultValue: 'Website' })}
                value={profile.website}
              />
            </div>
          )}
          <hr className="border-border mt-6" />
        </section>

        {/* ── Representatives' details ── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">
              {t('vendors:representativesDetails', { defaultValue: "Representatives' details" })}
            </h3>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleAddUser}>
                <PlusIcon className="w-4 h-4" />
                {t('vendors:representatives.addUser', { defaultValue: 'Add user' })}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsInviteUserOpen(true)}>
                {t('vendors:representatives.inviteUser', { defaultValue: 'Invite user' })}
              </Button>
            </div>
          </div>
          <RepresentativesSection
            isEditing={isEditing}
            representatives={profile.representatives ?? []}
            drafts={repDrafts}
            draftErrors={repDraftErrors}
            onDraftFieldChange={handleRepDraftFieldChange}
            onDraftBlur={handleRepDraftBlur}
            onRemoveDraft={handleRemoveRepDraft}
          />
          <hr className="border-border mt-6" />
        </section>

        {/* ── Warehouse locations ── */}
        <section>
          <h3 className="text-lg font-bold text-foreground mb-4">
            {t('vendors:warehouseLocations', { defaultValue: 'Warehouse locations' })}
          </h3>
          <div className="space-y-2">
            {profile.warehouseLocations
              ?.filter((wh) => !warehouseDeletes.has(wh.id))
              .map((wh) => (
                <WarehouseCard
                  key={wh.id}
                  vendorId={vendorId}
                  warehouse={wh}
                  isPageEditing={isEditing}
                  onDelete={() => handleWarehouseDelete(wh.id)}
                  onPageEditChange={(data) => handleWarehousePageEditChange(wh.id, data)}
                  searchFn={handleAddressSearch}
                />
              ))}
            {isEditing && (
              <div className="flex flex-col items-start gap-2 self-stretch p-4 rounded-[10px] border-[0.8px] border-solid border-foreground/10">
                <WarehouseLocationFields
                  data={newWarehouse}
                  onChange={setNewWarehouse}
                  searchFn={handleAddressSearch}
                  errors={whErrors}
                />
              </div>
            )}
            {!isEditing &&
              (!profile.warehouseLocations || profile.warehouseLocations.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  {t('vendors:noWarehouseLocations', { defaultValue: 'No warehouse locations' })}
                </p>
              )}
          </div>
        </section>
      </div>

      {(isInviteUserOpen || inviteSuccessEmail) && (
        <Suspense fallback={null}>
          {isInviteUserOpen && (
            <InviteVendorModal
              onClose={() => setIsInviteUserOpen(false)}
              onSuccess={(email) => {
                setIsInviteUserOpen(false);
                setInviteSuccessEmail(email);
              }}
            />
          )}
          {inviteSuccessEmail && (
            <VendorInviteSuccessModal
              email={inviteSuccessEmail}
              onClose={() => setInviteSuccessEmail(null)}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
