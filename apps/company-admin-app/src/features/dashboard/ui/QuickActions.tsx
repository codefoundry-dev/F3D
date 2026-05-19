import type { RfqListItem, BulkOrderListItem } from '@forethread/api-client';
import { getRfq, getBulkOrder } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  SelectRfqModal,
  SelectBulkOrderModal,
  rfqToFormDefaults,
  bulkOrderToFormDefaults,
} from '@forethread/po-shared';
import { Button, useDropdown } from '@forethread/ui-components';
import PurchaseOrdersIcon from '@forethread/ui-components/assets/icons/purchase-orders.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import VendorsIcon from '@forethread/ui-components/assets/icons/vendors.svg?react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

const quickActionBtn = 'border-foreground bg-background text-foreground rounded-xl';

export function QuickActions() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold text-foreground">{t('quickActions.title')}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CreatePoDropdown
          label={t('quickActions.createPo')}
          icon={<PurchaseOrdersIcon className="w-4 h-4" />}
        />
        <CreateRfqDropdown
          label={t('quickActions.createRfq')}
          icon={<SearchIcon className="w-4 h-4" />}
        />
        <Button
          variant="outline"
          size="md"
          leftIcon={<VendorsIcon className="w-4 h-4" />}
          onClick={() => navigate(ROUTES.vendorNew)}
          className={`w-full ${quickActionBtn}`}
        >
          {t('quickActions.addVendor')}
        </Button>
        <Button
          variant="outline"
          size="md"
          leftIcon={<UploadIcon className="w-4 h-4" />}
          onClick={() => navigate(ROUTES.invoiceUpload)}
          className={`w-full ${quickActionBtn}`}
        >
          {t('quickActions.uploadInvoice')}
        </Button>
      </div>
    </div>
  );
}

function CreatePoDropdown({ label, icon }: { label: string; icon: React.ReactNode }) {
  const navigate = useNavigate();
  const dd = useDropdown();
  const [showSelectRfq, setShowSelectRfq] = useState(false);
  const [showSelectBo, setShowSelectBo] = useState(false);

  return (
    <div ref={dd.ref} className="relative">
      <Button
        variant="outline"
        size="md"
        leftIcon={icon}
        onClick={() => dd.setIsOpen((p) => !p)}
        className={`w-full ${quickActionBtn}`}
      >
        {label}
      </Button>

      {dd.isOpen && (
        <div className="absolute left-0 mt-1 w-[301px] border-2 border-foreground/20 bg-background rounded-lg p-2 z-50 flex flex-col items-start gap-1">
          <button
            type="button"
            className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
            onClick={() => {
              dd.setIsOpen(false);
              navigate(ROUTES.purchaseOrderNew);
            }}
          >
            Create manually
          </button>
          <button
            type="button"
            className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
            onClick={() => {
              dd.setIsOpen(false);
              setShowSelectRfq(true);
            }}
          >
            Converting Approved RFQ
          </button>
          <button
            type="button"
            className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
            onClick={() => {
              dd.setIsOpen(false);
              setShowSelectBo(true);
            }}
          >
            From Bulk order
          </button>
        </div>
      )}

      <SelectRfqModal
        open={showSelectRfq}
        onClose={() => setShowSelectRfq(false)}
        onSelect={(rfq: RfqListItem, selectedItemIds?: Set<string>) => {
          setShowSelectRfq(false);
          void getRfq(rfq.id).then((detail) => {
            const filtered = selectedItemIds
              ? {
                  ...detail,
                  lineItems: detail.lineItems.filter((li) => selectedItemIds.has(li.id)),
                }
              : detail;
            const { defaultValues, lockedFields } = rfqToFormDefaults(filtered);
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
  const dd = useDropdown();

  return (
    <div ref={dd.ref} className="relative">
      <Button
        variant="outline"
        size="md"
        leftIcon={icon}
        onClick={() => dd.setIsOpen((p) => !p)}
        className={`w-full ${quickActionBtn}`}
      >
        {label}
      </Button>

      {dd.isOpen && (
        <div className="absolute left-0 mt-1 w-[301px] border-2 border-foreground/20 bg-background rounded-lg p-2 z-50 flex flex-col items-start gap-1">
          <button
            type="button"
            className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
            onClick={() => {
              dd.setIsOpen(false);
              navigate(ROUTES.rfqNew);
            }}
          >
            Create manually
          </button>
          <button
            type="button"
            className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
            onClick={() => {
              dd.setIsOpen(false);
              // TODO: navigate to BOM conversion flow
            }}
          >
            Converting a project BOM
          </button>
          <button
            type="button"
            className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
            onClick={() => {
              dd.setIsOpen(false);
              // TODO: navigate to material list flow
            }}
          >
            From material list
          </button>
        </div>
      )}
    </div>
  );
}
