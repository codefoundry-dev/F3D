import { useTranslation } from '@forethread/i18n';
import { SectionTitle } from '@forethread/rfq-shared';
import { Button, Spinner, notificationService } from '@forethread/ui-components';
import ReloadIcon from '@forethread/ui-components/assets/icons/circle-reload.svg?react';
import CopyIcon from '@forethread/ui-components/assets/icons/copy.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

import { useCreatePoDeliveryLink } from '../services/deliveries.service';

interface DeliveryQrSectionProps {
  poId: string;
}

/**
 * "Generate delivery QR" affordance for the buyer PO detail page (screenshot 09).
 * On click it mints the public delivery-portal link for the PO and renders the QR
 * (scanned by a delivery person to submit a report — no login) plus the raw link.
 * Lives in apps/web (not po-shared) because it depends on `qrcode.react`; it is
 * passed into `PoDetailsTab` via the `deliveryQrSlot`, so it only ever renders on
 * the buyer/internal view.
 */
export function DeliveryQrSection({ poId }: DeliveryQrSectionProps) {
  const { t } = useTranslation('deliveries');
  const mutation = useCreatePoDeliveryLink();
  const [url, setUrl] = useState<string | null>(null);

  const generate = () =>
    mutation.mutate(poId, {
      onSuccess: (link) => setUrl(link.url),
      // Surface the backend's reason (e.g. "A delivery link cannot be generated
      // for a PO in status DRAFT.") rather than a generic message. The error
      // interceptor carries `data.error` on `ApiRequestError.message`.
      onError: (error) =>
        notificationService.error(
          error instanceof Error && error.message ? error.message : t('qr.generateFailed'),
        ),
    });

  const copyLink = () => {
    if (!url) return;
    void navigator.clipboard?.writeText(url).then(
      () => notificationService.success(t('qr.copied')),
      () => undefined,
    );
  };

  return (
    <div className="flex flex-col gap-3" data-testid="delivery-qr-section">
      <SectionTitle>{t('qr.title')}</SectionTitle>

      {!url ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">{t('qr.helper')}</p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<PackageIcon className="h-4 w-4" />}
            isLoading={mutation.isPending}
            onClick={generate}
            data-testid="delivery-generate-qr"
          >
            {t('qr.generate')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="rounded-[10px] border border-foreground/10 bg-white p-3">
            {mutation.isPending ? (
              <div className="flex h-[148px] w-[148px] items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : (
              <QRCodeSVG value={url} size={148} />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t('qr.helper')}</p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm font-medium text-foreground underline"
              data-testid="delivery-qr-link"
            >
              {url}
            </a>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<CopyIcon className="h-4 w-4" />}
                onClick={copyLink}
                data-testid="delivery-copy-link"
              >
                {t('qr.copyLink')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ReloadIcon className="h-4 w-4" />}
                isLoading={mutation.isPending}
                onClick={generate}
              >
                {t('qr.regenerate')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
