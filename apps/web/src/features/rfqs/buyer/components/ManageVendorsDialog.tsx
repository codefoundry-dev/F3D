import { useTranslation } from '@forethread/i18n';
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@forethread/ui-components';
import { useState } from 'react';

import { useAssignedVendors } from '../services/rfqs.service';

import { SelectVendorsCard } from './create/SelectVendorsCard';

interface ManageVendorsDialogProps {
  /** Vendor company ids already invited on this RFQ — pre-selected on open. */
  currentVendorIds: string[];
  isSaving: boolean;
  isError: boolean;
  onCancel: () => void;
  /** Receives the chosen vendor company ids (always ≥ 1 — Save is disabled at 0). */
  onSave: (vendorIds: string[]) => void;
}

/**
 * Pick the vendors invited on a DRAFT RFQ. An RFQ converted from a Material
 * Request starts with no vendors and the create wizard is bypassed, so without
 * this the Send button can never enable. Reuses the wizard's {@link
 * SelectVendorsCard}; the parent owns the update mutation and reports progress
 * via `isSaving` / `isError`.
 */
export function ManageVendorsDialog({
  currentVendorIds,
  isSaving,
  isError,
  onCancel,
  onSave,
}: ManageVendorsDialogProps) {
  const { t } = useTranslation('rfqs');
  const { data: vendors = [], isLoading } = useAssignedVendors();
  const [selectedIds, setSelectedIds] = useState<string[]>(currentVendorIds);

  const toggle = (vendorId: string, selected: boolean) =>
    setSelectedIds((prev) =>
      selected ? [...new Set([...prev, vendorId])] : prev.filter((id) => id !== vendorId),
    );

  return (
    <Modal onClose={onCancel} maxWidth="max-w-4xl" scrollBody>
      <ModalHeader onClose={onCancel}>{t('manageVendors.title')}</ModalHeader>
      <ModalBody>
        <p className="mb-4 text-sm text-muted-foreground">{t('manageVendors.subtitle')}</p>

        <SelectVendorsCard
          vendors={vendors}
          selectedIds={selectedIds}
          onToggle={toggle}
          onSelectAll={(ids) => setSelectedIds((prev) => [...new Set([...prev, ...ids])])}
          onRemoveAll={() => setSelectedIds([])}
          isLoading={isLoading}
        />

        {isError && (
          <Alert variant="destructive" className="mt-4">
            {t('manageVendors.error')}
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          {t('manageVendors.cancel')}
        </Button>
        <Button
          type="button"
          onClick={() => onSave(selectedIds)}
          isLoading={isSaving}
          disabled={isSaving || selectedIds.length === 0}
          data-testid="save-vendors"
        >
          {t('manageVendors.save')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
