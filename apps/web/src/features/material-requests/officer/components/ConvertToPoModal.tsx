import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Spinner,
} from '@forethread/ui-components';
import { useState } from 'react';

import { useCompanyVendors } from '../../services/material-requests.service';

interface ConvertToPoModalProps {
  mrNumber: string;
  /** Company whose assigned vendors are offered as PO recipients. */
  companyId: string;
  /** Whether the convert mutation is in flight. */
  isPending?: boolean;
  onClose: () => void;
  onConfirm: (vendorId: string) => void;
}

/**
 * Convert-to-PO vendor picker (US 2.08). Loads the contractor's assigned vendors
 * and requires one to be selected before raising a draft PO from the MR.
 */
export function ConvertToPoModal({
  mrNumber,
  companyId,
  isPending,
  onClose,
  onConfirm,
}: ConvertToPoModalProps) {
  const { t } = useTranslation('materialRequests');
  const { data: vendors, isLoading, isError } = useCompanyVendors(companyId);
  const [vendorId, setVendorId] = useState('');

  const hasVendors = (vendors?.length ?? 0) > 0;

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <ModalHeader onClose={onClose}>{t('convertPoModal.title')}</ModalHeader>
      <ModalBody>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('convertPoModal.subtitle', { number: mrNumber })}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : isError ? (
          <p className="py-4 text-sm text-destructive">{t('convertPoModal.loadFailed')}</p>
        ) : !hasVendors ? (
          <p className="py-4 text-sm text-muted-foreground">{t('convertPoModal.noVendors')}</p>
        ) : (
          <>
            <label
              className="mb-1.5 block text-sm font-medium text-foreground"
              htmlFor="mr-convert-vendor"
            >
              {t('convertPoModal.vendorLabel')}
            </label>
            <Select
              id="mr-convert-vendor"
              data-testid="mr-convert-vendor"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              <option value="">{t('convertPoModal.vendorPlaceholder')}</option>
              {vendors?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.tradeName ?? v.legalName}
                </option>
              ))}
            </Select>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
          {t('convertPoModal.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          data-testid="mr-convert-confirm"
          disabled={!vendorId || isPending === true || !hasVendors}
          onClick={() => onConfirm(vendorId)}
        >
          {t('convertPoModal.confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
