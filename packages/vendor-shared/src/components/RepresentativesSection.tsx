import type { VendorRepresentative } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { isValidEmail } from '@forethread/shared-types/client';
import { Button, FormField, Input, onPhoneOnly } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import UserIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RepDraft {
  name: string;
  email: string;
  phone: string;
  position: string;
}

export interface RepDraftErrors {
  name?: string;
  email?: string;
  phone?: string;
  position?: string;
}

interface RepresentativesSectionProps {
  isEditing: boolean;
  /** Existing representatives from the profile */
  representatives: VendorRepresentative[];
  /** Draft rows being added (managed by parent) */
  drafts: RepDraft[];
  /** Per-draft error maps */
  draftErrors: RepDraftErrors[];
  onDraftFieldChange: (index: number, field: keyof RepDraft, value: string) => void;
  onDraftBlur: (index: number, field: keyof RepDraft) => void;
  onAddDraft: () => void;
  onRemoveDraft: (index: number) => void;
}

const EMPTY_DRAFT: RepDraft = { name: '', email: '', phone: '', position: '' };

// ── Validation helper (reusable by parent hooks) ─────────────────────────────

export function validateRepField(
  key: keyof RepDraft,
  value: string,
  requiredMsg: string,
  invalidEmailMsg: string,
): string | undefined {
  if ((key === 'name' || key === 'email') && !value.trim()) return requiredMsg;
  if (key === 'email' && value.trim() && !isValidEmail(value)) return invalidEmailMsg;
  return undefined;
}

export { EMPTY_DRAFT as EMPTY_REP_DRAFT };

// ── Component ────────────────────────────────────────────────────────────────

export function RepresentativesSection({
  isEditing,
  representatives,
  drafts,
  draftErrors,
  onDraftFieldChange,
  onDraftBlur,
  onAddDraft,
  onRemoveDraft,
}: RepresentativesSectionProps) {
  const { t } = useTranslation(['vendors']);

  // ── Read-only mode ──
  // Backend for representatives CRUD is not yet ready — show placeholder.
  if (!isEditing) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('vendors:representativesComingSoon', {
          defaultValue: 'Representatives management is not yet available.',
        })}
      </p>
    );
  }

  // ── Edit mode — draft input rows with validation ──
  return (
    <div className="space-y-4">
      {/* Draft rows (new representatives being added) */}
      {drafts.map((draft, idx) => (
        <DraftRow
          key={idx}
          draft={draft}
          errors={draftErrors[idx]}
          onChange={(field, value) => onDraftFieldChange(idx, field, value)}
          onBlur={(field) => onDraftBlur(idx, field)}
          onRemove={
            drafts.length > 1 || representatives.length > 0 ? () => onRemoveDraft(idx) : undefined
          }
        />
      ))}

      {/* Add button */}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onAddDraft}>
        <PlusIcon className="w-4 h-4" />
        {t('vendors:addRepresentative', { defaultValue: 'Add Representative' })}
      </Button>
    </div>
  );
}

// ── Draft row ────────────────────────────────────────────────────────────────

interface DraftRowProps {
  draft: RepDraft;
  errors?: RepDraftErrors;
  onChange: (field: keyof RepDraft, value: string) => void;
  onBlur: (field: keyof RepDraft) => void;
  onRemove?: () => void;
}

function DraftRow({ draft, errors, onChange, onBlur, onRemove }: DraftRowProps) {
  const { t } = useTranslation(['vendors']);

  const handleChange = useCallback(
    (field: keyof RepDraft) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(field, e.target.value);
    },
    [onChange],
  );

  return (
    <div className="grid grid-cols-4 gap-6">
      <FormField
        label={t('vendors:fields.fullName', { defaultValue: 'Full name' })}
        error={errors?.name}
      >
        <Input
          leftIcon={<UserIcon className="w-5 h-5" />}
          placeholder="Name Surname"
          value={draft.name}
          onChange={handleChange('name')}
          onBlur={() => onBlur('name')}
        />
      </FormField>
      <FormField
        label={t('vendors:fields.contactEmail', { defaultValue: 'Contact Email' })}
        error={errors?.email}
      >
        <Input
          leftIcon={<EnvelopeIcon className="w-5 h-5" />}
          placeholder="email@company.com"
          value={draft.email}
          onChange={handleChange('email')}
          onBlur={() => onBlur('email')}
        />
      </FormField>
      <FormField
        label={t('vendors:fields.phoneNumber', { defaultValue: 'Phone Number' })}
        error={errors?.phone}
      >
        <Input
          leftIcon={<PhoneIcon className="w-5 h-5" />}
          placeholder="+61 000 000 000"
          value={draft.phone}
          onChange={handleChange('phone')}
          onKeyDown={onPhoneOnly}
          onBlur={() => onBlur('phone')}
        />
      </FormField>
      <FormField
        label={t('vendors:fields.position', { defaultValue: 'Position' })}
        error={errors?.position}
      >
        <div className="flex gap-2">
          <Input
            leftIcon={<IdBadgeIcon className="w-5 h-5" />}
            placeholder="Position"
            value={draft.position}
            onChange={handleChange('position')}
            onBlur={() => onBlur('position')}
          />
          {onRemove && (
            <button
              type="button"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              onClick={onRemove}
            >
              <DeleteIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </FormField>
    </div>
  );
}
