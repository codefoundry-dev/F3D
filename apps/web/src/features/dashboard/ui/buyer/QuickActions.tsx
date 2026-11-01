import type { RfqListItem, BulkOrderListItem } from '@forethread/api-client';
import { getRfq, getBulkOrder } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  SelectRfqModal,
  SelectBulkOrderModal,
  rfqToFormDefaults,
  bulkOrderToFormDefaults,
} from '@forethread/po-shared';
import { Button, Modal, useDropdown, useIsPhone } from '@forethread/ui-components';
import CartIcon from '@forethread/ui-components/assets/icons/cart.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import ReportIcon from '@forethread/ui-components/assets/icons/report.svg?react';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

const quickActionBtn = 'border-border bg-background text-foreground rounded-xl justify-center';

export function QuickActions() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  return (
    <div className="rounded-[14px] border border-border bg-card px-4 py-4">
      <h2 className="mb-3 text-base font-semibold text-foreground">{t('quickActions.title')}</h2>
      {/* Phones: one row that swipes sideways (ADR-0019); laptops: the grid. */}
      <div
        data-swipe-row
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-md:[&>*]:shrink-0 max-md:[&_button]:w-auto md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-5"
      >
        <CreatePoDropdown
          label={t('quickActions.createPo')}
          icon={<CartIcon className="w-[18px] h-[18px]" />}
        />
        <CreateRfqDropdown
          label={t('quickActions.createRfq')}
          icon={<FileTextIcon className="w-[18px] h-[18px]" />}
        />
        <Button
          variant="outline"
          size="md"
          leftIcon={<NewUserIcon className="w-[18px] h-[18px]" />}
          onClick={() => navigate(ROUTES.vendorNew)}
          className={`w-full ${quickActionBtn}`}
        >
          {t('quickActions.addVendor')}
        </Button>
        <Button
          variant="outline"
          size="md"
          leftIcon={<UploadIcon className="w-[18px] h-[18px]" />}
          onClick={() => navigate(ROUTES.invoiceUpload)}
          className={`w-full ${quickActionBtn}`}
        >
          {t('quickActions.uploadInvoice')}
        </Button>
        <Button
          variant="outline"
          size="md"
          leftIcon={<ReportIcon className="w-[18px] h-[18px]" />}
          onClick={() => navigate(ROUTES.deliveries)}
          className={`w-full ${quickActionBtn}`}
        >
          {t('quickActions.deliveryReport')}
        </Button>
      </div>
    </div>
  );
}

function CreatePoDropdown({ label, icon }: { label: string; icon: React.ReactNode }) {
  const navigate = useNavigate();
  const [showSelectRfq, setShowSelectRfq] = useState(false);
  const [showSelectBo, setShowSelectBo] = useState(false);

  return (
    <div className="relative">
      <QuickMenu
        label={label}
        icon={icon}
        items={[
          { label: 'Create manually', onSelect: () => navigate(ROUTES.purchaseOrderNew) },
          { label: 'Converting Approved RFQ', onSelect: () => setShowSelectRfq(true) },
          { label: 'From Bulk order', onSelect: () => setShowSelectBo(true) },
        ]}
      />

      <SelectRfqModal
        open={showSelectRfq}
        onClose={() => setShowSelectRfq(false)}
        onSelect={(
          rfq: RfqListItem,
          selectedItemIds?: Set<string>,
          quoteLineItemIds?: Set<string>,
        ) => {
          setShowSelectRfq(false);
          void getRfq(rfq.id).then((detail) => {
            const filtered = selectedItemIds
              ? {
                  ...detail,
                  lineItems: detail.lineItems.filter((li) => selectedItemIds.has(li.id)),
                }
              : detail;
            const { defaultValues, lockedFields } = rfqToFormDefaults(filtered, {
              quoteLineItemIds,
            });
            navigate(ROUTES.purchaseOrderNew, {
              state: { mode: 'from-rfq', defaultValues, lockedFields: [...lockedFields] },
            });
          });
        }}
      />
      <SelectBulkOrderModal
        open={showSelectBo}
        onClose={() => setShowSelectBo(false)}
        onSelect={(bo: BulkOrderListItem, selectedItemIds?: Set<string>) => {
          setShowSelectBo(false);
          void getBulkOrder(bo.id).then((detail) => {
            const filtered = selectedItemIds
              ? {
                  ...detail,
                  lineItems: detail.lineItems.filter((li) => selectedItemIds.has(li.lineItemId)),
                }
              : detail;
            const { defaultValues, lockedFields } = bulkOrderToFormDefaults(filtered);
            if (defaultValues) {
              defaultValues.vendorId = bo.vendorId;
            }
            navigate(ROUTES.purchaseOrderNew, {
              state: { mode: 'from-bulk-order', defaultValues, lockedFields: [...lockedFields] },
            });
          });
        }}
      />
    </div>
  );
}

function CreateRfqDropdown({ label, icon }: { label: string; icon: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="relative">
      <QuickMenu
        label={label}
        icon={icon}
        items={[
          { label: 'Create manually', onSelect: () => navigate(ROUTES.rfqNew) },
          { label: 'Converting a project BOM', onSelect: () => {} }, // TODO: navigate to BOM conversion flow
          { label: 'From material list', onSelect: () => {} }, // TODO: navigate to material list flow
        ]}
      />
    </div>
  );
}

interface QuickMenuItem {
  label: string;
  onSelect: () => void;
}

/**
 * A quick action with several options: a dropdown under the button on
 * laptops, a bottom sheet on phones (the swipe row would clip a dropdown).
 */
function QuickMenu({
  label,
  icon,
  items,
}: {
  label: string;
  icon: React.ReactNode;
  items: QuickMenuItem[];
}) {
  const isPhone = useIsPhone();
  const dd = useDropdown();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div ref={dd.ref} className="relative">
      <Button
        variant="outline"
        size="md"
        leftIcon={icon}
        onClick={() => (isPhone ? setSheetOpen(true) : dd.setIsOpen((p) => !p))}
        className={`w-full ${quickActionBtn}`}
      >
        {label}
      </Button>

      {dd.isOpen && !isPhone && (
        <div className="absolute left-0 mt-1 w-[301px] border-2 border-foreground/20 bg-background rounded-lg p-2 z-50 flex flex-col items-start gap-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-sm font-medium hover:bg-muted transition-colors w-full text-left"
              onClick={() => {
                dd.setIsOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {sheetOpen && (
        <Modal onClose={() => setSheetOpen(false)} mobile="sheet">
          <div className="flex flex-col gap-1 px-4 pb-4">
            <h2 className="px-2 pb-2 text-base font-semibold text-foreground">{label}</h2>
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex h-12 w-full items-center rounded-[10px] px-2 text-left text-[15px] font-semibold text-gray-700 hover:bg-muted"
                onClick={() => {
                  setSheetOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
