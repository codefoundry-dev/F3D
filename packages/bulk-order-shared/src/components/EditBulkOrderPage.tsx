import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  Button,
  Spinner,
  Alert,
  Input,
  CustomDropdown,
  DatePicker,
  notificationService,
} from '@forethread/ui-components';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { BULK_ORDER_ROUTES } from '../constants/routes';
import { useBulkOrder, useUpdateBulkOrder } from '../services/bulk-orders.service';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function EditBulkOrderPage() {
  const { t } = useTranslation('bulkOrders');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBulkOrder(id ?? '');
  const updateBulkOrder = useUpdateBulkOrder();
  const setTitle = usePageTitleStore((s) => s.setTitle);

  const [brands, setBrands] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.bulkId, t('list.subtitle') as string);
      if (!initialized) {
        setBrands(((data as unknown as Record<string, unknown>).brands as string) ?? '');
        setEndDate(data.endDate ? data.endDate.split('T')[0] : '');
        setStatus(((data as unknown as Record<string, unknown>).status as string) ?? 'ACTIVE');
        setInitialized(true);
      }
    }
    return () => setTitle(null);
  }, [data, setTitle, t, initialized]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('list.failedToLoad')}</Alert>
      </div>
    );
  }

  const handleSubmit = async () => {
    try {
      await updateBulkOrder.mutateAsync({
        id: id!,
        payload: {
          brands: brands || undefined,
          endDate: endDate || undefined,
          status: status || undefined,
        },
      });
      notificationService.success(t('modals.updateSuccess'));
      navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', id!));
    } catch {
      notificationService.error(t('modals.updateError'));
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">{t('modals.editTitle')}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t('modals.editSubtitle')}</p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            {t('modals.statusLabel')}
          </label>
          <CustomDropdown
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            placeholder={t('modals.statusLabel')}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            {t('modals.brandsLabel')}
          </label>
          <Input
            value={brands}
            onChange={(e) => setBrands(e.target.value)}
            placeholder={t('modals.brandsLabel')}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            {t('modals.endDateLabel')}
          </label>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            minDate={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      {/* Bulk order read-only info */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 mt-6 mb-6">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t('detail.bulkId')}</span>
            <p className="font-medium text-foreground">{data.bulkId}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('detail.projectName')}</span>
            <p className="font-medium text-foreground">{data.projectName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('detail.vendorName')}</span>
            <p className="font-medium text-foreground">{data.vendorName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('detail.createdBy')}</span>
            <p className="font-medium text-foreground">{data.createdBy}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          disabled={updateBulkOrder.isPending}
          onClick={handleSubmit}
        >
          {updateBulkOrder.isPending ? t('modals.saving') : t('modals.save')}
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={() => navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', id!))}
        >
          {t('modals.cancel')}
        </Button>
      </div>
    </div>
  );
}
