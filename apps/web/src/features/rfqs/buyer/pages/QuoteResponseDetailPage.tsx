import { useTranslation } from '@forethread/i18n';
import {
  usePageTitleStore,
  useRfq,
  QuoteResponseDetailPage as SharedQuoteResponseDetailPage,
} from '@forethread/rfq-shared';
import type { QuoteResponseTab } from '@forethread/rfq-shared';
import { Spinner } from '@forethread/ui-components';
import { useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

export default function QuoteResponseDetailPage() {
  const { t } = useTranslation('rfqs');
  const { id: rfqId, quoteId } = useParams<{ id: string; quoteId: string }>();
  const { data: rfq, isLoading, isError } = useRfq(rfqId ?? '');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as QuoteResponseTab | null;
  const validTabs: QuoteResponseTab[] = ['messages', 'lineItems', 'attachments'];
  const initialTab: QuoteResponseTab =
    tabParam && validTabs.includes(tabParam) ? tabParam : 'messages';

  const handleTabChange = useCallback(
    (tab: QuoteResponseTab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );

  useEffect(() => {
    const qr = rfq?.quoteResponses.find((q) => q.id === quoteId);
    if (qr) setPageTitle(qr.vendorName);
    return () => setPageTitle(null);
  }, [rfq, setPageTitle, quoteId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !rfq) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">{t('detail.noData')}</div>
    );
  }

  const quoteResponse = rfq.quoteResponses.find((qr) => qr.id === quoteId);
  if (!quoteResponse) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">{t('detail.noData')}</div>
    );
  }

  return (
    <SharedQuoteResponseDetailPage
      rfqId={rfqId ?? ''}
      quoteId={quoteResponse.id}
      vendorName={quoteResponse.vendorName}
      status={quoteResponse.status}
      initialTab={initialTab}
      onTabChange={handleTabChange}
    />
  );
}
