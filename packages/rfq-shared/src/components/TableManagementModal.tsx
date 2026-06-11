import { useTranslation } from '@forethread/i18n';
import { Checkbox, Modal, ModalIconHeader } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';

/** Configurable comparison-table columns (US 5.06 — Table management). */
export interface ComparisonColumnVisibility {
  priceUnit: boolean;
  quantityAvailable: boolean;
  lineDiscount: boolean;
  deliveryDate: boolean;
  lineTotal: boolean;
  totalDiscount: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ComparisonColumnVisibility = {
  priceUnit: true,
  quantityAvailable: true,
  lineDiscount: true,
  deliveryDate: true,
  lineTotal: true,
  totalDiscount: true,
};

const COLUMN_KEYS = [
  'priceUnit',
  'quantityAvailable',
  'lineDiscount',
  'deliveryDate',
  'lineTotal',
  'totalDiscount',
] as const;

export interface TableManagementModalProps {
  visibility: ComparisonColumnVisibility;
  onChange: (visibility: ComparisonColumnVisibility) => void;
  onClose: () => void;
}

/** "Table management" modal — configure which comparison columns are visible. */
export function TableManagementModal({ visibility, onChange, onClose }: TableManagementModalProps) {
  const { t } = useTranslation('rfqs');

  return (
    <Modal onClose={onClose} maxWidth="max-w-[1024px]">
      <div className="p-6">
        <ModalIconHeader
          icon={<SettingsIcon className="w-6 h-6" />}
          title={t('tableManagement.title')}
          subtitle={t('reviewTable.tableManagementSubtitle')}
          onClose={onClose}
          className="mb-8"
        />
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <span className="text-base font-semibold text-foreground">
              {t('tableManagement.configureColumns')}
            </span>
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
              onClick={() =>
                onChange({
                  priceUnit: false,
                  quantityAvailable: false,
                  lineDiscount: false,
                  deliveryDate: false,
                  lineTotal: false,
                  totalDiscount: false,
                })
              }
            >
              {t('tableManagement.deselectAll')}
              <CrossIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
            {COLUMN_KEYS.map((key) => (
              <Checkbox
                key={key}
                checked={visibility[key]}
                onChange={(checked) => onChange({ ...visibility, [key]: checked })}
                label={t(`reviewTable.col${key.charAt(0).toUpperCase()}${key.slice(1)}` as never)}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
