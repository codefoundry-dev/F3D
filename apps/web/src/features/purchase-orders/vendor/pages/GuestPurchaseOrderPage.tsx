import {
  type PoDetail,
  exportPublicPurchaseOrder,
  getPublicPurchaseOrder,
  isApiError,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { PoDetailTabs, PoDetailsTab, PoLineItemsTab } from '@forethread/po-shared';
import type { PoTab } from '@forethread/po-shared';
import {
  Alert,
  Badge,
  Button,
  getStatusColor,
  PO_STATUS_COLORS,
  Spinner,
} from '@forethread/ui-components';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

/** The tokenised vendor PO portal only exposes the read-only content tabs. */
const GUEST_TABS: PoTab[] = ['details', 'lineItems'];

/**
 * Public, read-only view of a Purchase Order reached from a tokenised email link
 * (FOR-246). Mirrors the guest RFQ portal (`GuestInvitationPage`): no login, no
 * app shell — the access token (in the URL) authorises the read. The vendor can
 * view the full PO and download its PDF; response actions land in FOR-247.
 */
export default function GuestPurchaseOrderPage() {
  const { t } = useTranslation('purchaseOrders');
  const { token } = useParams<{ token: string }>();

  const {
    data: po,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['guest-po', token],
    queryFn: () => getPublicPurchaseOrder(token ?? ''),
    enabled: !!token,
    // Don't retry — a rejected token is terminal, and each attempt is rate-limited.
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !po || !token) {
    // A 403 means the token is expired / revoked / already invalid — distinct
    // from a malformed or unknown link.
    const expired = isApiError(error, 403);
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md text-center p-8">
          <Alert variant="destructive">
            {expired ? t('guest.expiredToken') : t('guest.invalidToken')}
          </Alert>
          <p className="text-sm text-muted-foreground mt-4">
            {expired ? t('guest.expiredTokenHint') : t('guest.invalidTokenHint')}
          </p>
        </div>
      </div>
    );
  }

  return <GuestPoContent po={po} token={token} />;
}

/* ─── Main Content ─────────────────────────────────────────────────────────── */

function GuestPoContent({ po, token }: { po: PoDetail; token: string }) {
  const { t } = useTranslation('purchaseOrders');
  const [activeTab, setActiveTab] = useState<PoTab>('details');

  const handleDownload = () => {
    void exportPublicPurchaseOrder(token).then(({ url }) => window.open(url, '_blank'));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ═══ Header ═══ */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-foreground truncate">
                {t('guest.title', { poNumber: po.poNumber })}
              </h1>
              <Badge className={getStatusColor(PO_STATUS_COLORS, po.status)}>
                {t(`status.${po.status}` as never)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('guest.subtitle', { contractor: po.company.name, vendor: po.vendor.name })}
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            leftIcon={<DownloadIcon className="w-4 h-4" />}
            onClick={handleDownload}
          >
            {t('guest.download')}
          </Button>
        </div>
      </header>

      {/* ═══ Read-only info banner ═══ */}
      <div className="px-6 pt-4 max-w-[1400px] mx-auto w-full">
        <Alert variant="info" icon={<InfoIcon className="w-4 h-4" />}>
          {t('guest.infoBanner')}
        </Alert>
      </div>

      {/* ═══ PO content ═══ */}
      <div className="flex-1 px-6 py-4 max-w-[1400px] mx-auto w-full space-y-4">
        <PoDetailTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={GUEST_TABS} />
        {activeTab === 'details' && <PoDetailsTab po={po} layout="page" isVendorView />}
        {activeTab === 'lineItems' && (
          <PoLineItemsTab lineItems={po.lineItems ?? []} layout="page" readOnly />
        )}
      </div>
    </div>
  );
}
