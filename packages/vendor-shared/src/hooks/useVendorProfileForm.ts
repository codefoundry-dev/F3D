import { useTranslation } from '@forethread/i18n';
import { VendorCategory, isValidEmail, isValidUrl } from '@forethread/shared-types/client';
import { notificationService } from '@forethread/ui-components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type RepDraft,
  type RepDraftErrors,
  EMPTY_REP_DRAFT,
  validateRepField,
} from '../components/RepresentativesSection';
import type { WarehouseData } from '../components/WarehouseLocationFields';
import {
  useVendorProfile,
  useUpdateVendorProfile,
  useDeleteWarehouse,
  useAddWarehouse,
  useUpdateWarehouse,
  useAddVendorRepresentative,
  useVendorLogoUrl,
  useUploadVendorLogo,
} from '../services';

const EMPTY_WAREHOUSE: WarehouseData = { name: '', city: '', address: '', postcode: '' };
const REQUIRED_FIELDS = ['contactEmail', 'legalName', 'abn', 'taxCode', 'legalAddress'];

function buildFormData(profile: {
  legalName: string;
  specialisations: string[];
  abn: string | null;
  taxCode: string | null;
  legalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
}): Record<string, string> {
  return {
    legalName: profile.legalName || '',
    specialisations: profile.specialisations?.[0] || '',
    abn: profile.abn || '',
    taxCode: profile.taxCode || '',
    legalAddress: profile.legalAddress || '',
    contactEmail: profile.contactEmail || '',
    contactPhone: profile.contactPhone || '',
    website: profile.website || '',
  };
}

export function useVendorProfileForm(vendorId: string, initialEdit?: boolean) {
  const { t } = useTranslation(['vendors', 'common']);
  const { data: profile, isLoading } = useVendorProfile(vendorId);
  const { data: logoUrl } = useVendorLogoUrl(vendorId);
  const uploadLogoMutation = useUploadVendorLogo();
  const updateProfile = useUpdateVendorProfile();
  const deleteWarehouseMutation = useDeleteWarehouse();
  const addWarehouseMutation = useAddWarehouse();
  const updateWarehouseMutation = useUpdateWarehouse();
  const addRepresentativeMutation = useAddVendorRepresentative();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [newWarehouse, setNewWarehouse] = useState<WarehouseData>(EMPTY_WAREHOUSE);
  const [warehouseEdits, setWarehouseEdits] = useState<Record<string, WarehouseData>>({});
  const [warehouseDeletes, setWarehouseDeletes] = useState<Set<string>>(new Set());
  const [repDrafts, setRepDrafts] = useState<RepDraft[]>([{ ...EMPTY_REP_DRAFT }]);
  const [repDraftErrors, setRepDraftErrors] = useState<RepDraftErrors[]>([{}]);
  const [, setRepTouched] = useState<Partial<Record<keyof RepDraft, boolean>>[]>([{}]);

  const requiredMsg = t('vendors:validation.required', { defaultValue: 'This field is required' });
  const invalidEmailMsg = t('vendors:validation.invalidEmail', {
    defaultValue: 'Invalid email address',
  });

  const specialisationOptions = useMemo(
    () =>
      Object.values(VendorCategory).map((cat) => ({
        value: cat,
        label: t(`vendorCategories.${cat}` as `vendorCategories.ELECTRICAL`),
      })),
    [t],
  );

  const hasInitialized = useRef(false);
  useEffect(() => {
    if (initialEdit && profile && !hasInitialized.current) {
      hasInitialized.current = true;
      setFormData(buildFormData(profile));
      setFormErrors({});
      setIsEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEdit, profile]);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    const original = buildFormData(profile);
    const formChanged = Object.keys(original).some((k) => formData[k] !== original[k]);
    const newWhFilled = !!(
      newWarehouse.name ||
      newWarehouse.city ||
      newWarehouse.address ||
      newWarehouse.postcode
    );
    const whEdited = Object.keys(warehouseEdits).length > 0;
    const whDeleted = warehouseDeletes.size > 0;
    const repDraftFilled = repDrafts.some((d) => d.name || d.email || d.phone || d.position);
    return formChanged || newWhFilled || whEdited || whDeleted || repDraftFilled;
  }, [formData, newWarehouse, warehouseEdits, warehouseDeletes, repDrafts, profile]);

  const hasValidationErrors =
    Object.keys(formErrors).length > 0 ||
    repDraftErrors.some((errs) => Object.keys(errs).length > 0);

  const validateField = useCallback(
    (key: string, value: string): string | undefined => {
      if (REQUIRED_FIELDS.includes(key) && !value.trim()) return requiredMsg;
      if (key === 'contactEmail' && value && !isValidEmail(value)) {
        return t('vendors:validation.invalidEmail', { defaultValue: 'Invalid email address' });
      }
      if (key === 'website' && value && !isValidUrl(value)) {
        return t('vendors:validation.invalidWebsite', {
          defaultValue: 'Must start with http:// or https://',
        });
      }
      return undefined;
    },
    [requiredMsg, t],
  );

  const updateField = useCallback(
    (key: string, value: string) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      const err = validateField(key, value);
      setFormErrors((prev) => {
        const next = { ...prev };
        if (err) next[key] = err;
        else delete next[key];
        return next;
      });
    },
    [validateField],
  );

  const handleEdit = useCallback(() => {
    if (!profile) return;
    setFormData(buildFormData(profile));
    setFormErrors({});
    setIsEditing(true);
    setNewWarehouse(EMPTY_WAREHOUSE);
    setWarehouseEdits({});
    setWarehouseDeletes(new Set());
    setRepDrafts([{ ...EMPTY_REP_DRAFT }]);
    setRepDraftErrors([{}]);
    setRepTouched([{}]);
  }, [profile]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setFormErrors({});
    setNewWarehouse(EMPTY_WAREHOUSE);
    setWarehouseEdits({});
    setWarehouseDeletes(new Set());
    setRepDrafts([{ ...EMPTY_REP_DRAFT }]);
    setRepDraftErrors([{}]);
    setRepTouched([{}]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!profile) return;

    // Only validate/save the profile fields when they actually changed, so a
    // representative can be added (FOR-272) without being blocked by required
    // profile fields the user never touched (e.g. an incomplete profile).
    const original = buildFormData(profile);
    const profileChanged = Object.keys(original).some((k) => formData[k] !== original[k]);

    const errors: Record<string, string> = {};
    if (profileChanged) {
      for (const key of [...REQUIRED_FIELDS, 'website']) {
        const err = validateField(key, formData[key] || '');
        if (err) errors[key] = err;
      }
    }
    const wh = newWarehouse;
    const whHasAny = wh.name || wh.city || wh.address || wh.postcode;
    if (whHasAny) {
      if (!wh.name) errors['wh_name'] = requiredMsg;
      if (!wh.city) errors['wh_city'] = requiredMsg;
      if (!wh.address) errors['wh_address'] = requiredMsg;
      if (!wh.postcode) errors['wh_postcode'] = requiredMsg;
    }
    // Validate rep drafts that have data
    const newRepErrors: RepDraftErrors[] = repDrafts.map((draft) => {
      const hasDraftData = draft.name || draft.email || draft.phone || draft.position;
      if (!hasDraftData) return {};
      const errs: RepDraftErrors = {};
      for (const key of ['name', 'email', 'phone', 'position'] as const) {
        const err = validateRepField(key, draft[key], requiredMsg, invalidEmailMsg);
        if (err) errs[key] = err;
      }
      return errs;
    });
    setRepDraftErrors(newRepErrors);
    const hasRepErrors = newRepErrors.some((e) => Object.keys(e).length > 0);

    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || hasRepErrors) return;

    try {
      if (profileChanged) {
        await updateProfile.mutateAsync({
          id: vendorId,
          dto: {
            legalName: formData.legalName,
            abn: formData.abn,
            taxCode: formData.taxCode,
            legalAddress: formData.legalAddress,
            contactEmail: formData.contactEmail,
            contactPhone: formData.contactPhone,
            website: formData.website,
            specialisations: formData.specialisations ? [formData.specialisations] : [],
          },
        });
      }

      // Add new warehouse
      if (wh.name && wh.city && wh.address && wh.postcode) {
        await addWarehouseMutation.mutateAsync({ vendorId, input: wh });
        setNewWarehouse(EMPTY_WAREHOUSE);
      }

      // Delete warehouses marked for deletion
      for (const whId of warehouseDeletes) {
        await deleteWarehouseMutation.mutateAsync({ vendorId, warehouseId: whId });
      }

      // Update edited warehouses
      for (const [whId, data] of Object.entries(warehouseEdits)) {
        if (!warehouseDeletes.has(whId)) {
          await updateWarehouseMutation.mutateAsync({ vendorId, warehouseId: whId, input: data });
        }
      }

      setWarehouseEdits({});
      setWarehouseDeletes(new Set());

      // ── Persist newly added representative drafts (FOR-272) ──
      // Each filled draft becomes a saved representative WITHOUT an invitation
      // email. Successfully created drafts are dropped; any that fail (e.g. a
      // duplicate email → 409) stay in the form with an inline error so the user
      // can correct and resubmit. Profile/warehouse changes are already saved.
      const remainingDrafts: RepDraft[] = [];
      const remainingErrors: RepDraftErrors[] = [];
      const remainingTouched: Partial<Record<keyof RepDraft, boolean>>[] = [];
      let repFailed = false;

      for (const draft of repDrafts) {
        if (!draft.name.trim() && !draft.email.trim()) continue; // skip empty rows

        try {
          await addRepresentativeMutation.mutateAsync({
            vendorId,
            input: {
              name: draft.name.trim(),
              email: draft.email.trim(),
              phone: draft.phone.trim() || undefined,
              position: draft.position.trim() || undefined,
            },
          });
        } catch (err) {
          repFailed = true;
          const statusCode = (err as { statusCode?: number })?.statusCode;
          remainingDrafts.push(draft);
          remainingErrors.push({
            email:
              statusCode === 409
                ? t('vendors:representatives.emailInUse', {
                    defaultValue: 'A user with this email already exists',
                  })
                : t('vendors:representatives.addError', {
                    defaultValue: 'Failed to add representative',
                  }),
          });
          // Mark touched so editing the email clears the error and re-enables submit.
          remainingTouched.push({ email: true });
        }
      }

      if (repFailed) {
        setRepDrafts(remainingDrafts);
        setRepDraftErrors(remainingErrors);
        setRepTouched(remainingTouched);
        notificationService.error(
          t('vendors:representatives.addError', {
            defaultValue: 'Failed to add representative',
          }),
        );
        return; // stay in edit mode so the user can fix the failed rows
      }

      setRepDrafts([{ ...EMPTY_REP_DRAFT }]);
      setRepDraftErrors([{}]);
      setRepTouched([{}]);

      notificationService.success(
        t('vendors:profileUpdated', { defaultValue: 'Profile updated successfully' }),
      );
      setIsEditing(false);
    } catch {
      notificationService.error(
        t('vendors:profileUpdateError', { defaultValue: 'Failed to save changes' }),
      );
    }
  }, [
    profile,
    validateField,
    formData,
    newWarehouse,
    requiredMsg,
    updateProfile,
    vendorId,
    warehouseDeletes,
    warehouseEdits,
    addWarehouseMutation,
    deleteWarehouseMutation,
    updateWarehouseMutation,
    addRepresentativeMutation,
    repDrafts,
    invalidEmailMsg,
    t,
  ]);

  // ── Representative draft handlers ──────────────────────────────────────────

  const handleRepDraftFieldChange = useCallback(
    (index: number, field: keyof RepDraft, value: string) => {
      setRepDrafts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
      // Validate on change if already touched
      setRepTouched((prev) => {
        if (prev[index]?.[field]) {
          const err = validateRepField(field, value, requiredMsg, invalidEmailMsg);
          setRepDraftErrors((prevErrs) => {
            const next = [...prevErrs];
            next[index] = { ...next[index] };
            if (err) next[index][field] = err;
            else delete next[index][field];
            return next;
          });
        }
        return prev;
      });
    },
    [requiredMsg, invalidEmailMsg],
  );

  const handleRepDraftBlur = useCallback(
    (index: number, field: keyof RepDraft) => {
      setRepTouched((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: true };
        return next;
      });
      const value = repDrafts[index]?.[field] ?? '';
      const err = validateRepField(field, value, requiredMsg, invalidEmailMsg);
      setRepDraftErrors((prev) => {
        const next = [...prev];
        next[index] = { ...next[index] };
        if (err) next[index][field] = err;
        else delete next[index][field];
        return next;
      });
    },
    [repDrafts, requiredMsg, invalidEmailMsg],
  );

  const handleAddRepDraft = useCallback(() => {
    setRepDrafts((prev) => [...prev, { ...EMPTY_REP_DRAFT }]);
    setRepDraftErrors((prev) => [...prev, {}]);
    setRepTouched((prev) => [...prev, {}]);
  }, []);

  const handleRemoveRepDraft = useCallback((index: number) => {
    setRepDrafts((prev) => prev.filter((_, i) => i !== index));
    setRepDraftErrors((prev) => prev.filter((_, i) => i !== index));
    setRepTouched((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleWarehouseDelete = useCallback(
    (warehouseId: string) => {
      if (isEditing) {
        setWarehouseDeletes((prev) => new Set(prev).add(warehouseId));
      } else {
        void deleteWarehouseMutation.mutateAsync({ vendorId, warehouseId });
      }
    },
    [isEditing, deleteWarehouseMutation, vendorId],
  );

  const handleWarehousePageEditChange = useCallback((whId: string, data: WarehouseData) => {
    setWarehouseEdits((prev) => ({ ...prev, [whId]: data }));
  }, []);

  const uploadLogo = useCallback(
    (file: File) => uploadLogoMutation.mutate({ companyId: vendorId, file }),
    [uploadLogoMutation, vendorId],
  );

  const whErrors = {
    name: formErrors.wh_name,
    city: formErrors.wh_city,
    address: formErrors.wh_address,
    postcode: formErrors.wh_postcode,
  };

  return {
    profile,
    isLoading,
    logoUrl: logoUrl ?? profile?.logoUrl ?? null,
    isUploadingLogo: uploadLogoMutation.isPending,
    uploadLogo,
    isEditing,
    formData,
    formErrors,
    isDirty,
    hasValidationErrors,
    isSubmitting: updateProfile.isPending,
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
  };
}
