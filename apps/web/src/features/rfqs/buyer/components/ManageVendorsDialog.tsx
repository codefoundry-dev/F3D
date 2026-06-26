import { useTranslation } from '@forethread/i18n';
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalGridBackground,
  ModalHeader,
} from '@forethread/ui-components';
import { useState } from 'react';

import { useAssignedVendors } from '../services/rfqs.service';

import { SelectVendorsCard, type VendorSelection } from './create/SelectVendorsCard';

interface ManageVendorsDialogProps {
  /** Vendor company ids already invited on this RFQ — pre-selected on open. */
  currentVendorIds: string[];
  /** Sales-rep user ids already chosen on this RFQ — pre-selected on open. */
  currentSalesRepIds: string[];
  isSaving: boolean;
  isError: boolean;
  onCancel: () => void;
  /** Receives the chosen vendors + reps (vendorIds always ≥ 1 — Save is disabled at 0). */
  onSave: (selection: { vendorIds: string[]; salesRepIds: string[] }) => void;
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
  currentSalesRepIds,
  isSaving,
  isError,
  onCancel,
  onSave,
}: ManageVendorsDialogProps) {
  const { t } = useTranslation('rfqs');
  const { data: vendors = [], isLoading } = useAssignedVendors();
  const [selection, setSelection] = useState<VendorSelection>({
    vendorIds: currentVendorIds,
    repIds: currentSalesRepIds,
  });

  return (
    <Modal onClose={onCancel} maxWidth="max-w-4xl" scrollBody decoration={<ModalGridBackground />}>
      <ModalHeader onClose={onCancel} className="relative">
        {t('manageVendors.title')}
      </ModalHeader>
      <ModalBody className="relative toolbar:flex-1 toolbar:min-h-0 toolbar:overflow-y-auto">
        <p className="mb-4 text-sm text-muted-foreground">{t('manageVendors.subtitle')}</p>

        <SelectVendorsCard
          vendors={vendors}
          selectedVendorIds={selection.vendorIds}
          selectedRepIds={selection.repIds}
          onChange={setSelection}
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
          onClick={() => onSave({ vendorIds: selection.vendorIds, salesRepIds: selection.repIds })}
          isLoading={isSaving}
          disabled={isSaving || selection.vendorIds.length === 0}
          data-testid="save-vendors"
        >
          {t('manageVendors.save')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
