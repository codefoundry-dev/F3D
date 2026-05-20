import { getMaterials } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Alert, Button, Spinner } from '@forethread/ui-components';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

export default function MaterialDetailPage() {
  const { t } = useTranslation('rfqs');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['material-detail', id],
    queryFn: async () => {
      const response = await getMaterials({ limit: 1, search: id });
      // If search by ID doesn't work, fetch all and filter
      const found = response.items.find((m) => m.id === id);
      return found ?? null;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('materialDetail.notFound')}</Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          {t('materialDetail.goBack')}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Button variant="outline" size="sm" className="mb-6" onClick={() => navigate(-1)}>
        {t('materialDetail.goBack')}
      </Button>

      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-bold text-foreground mb-6">{data.name}</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {data.code && <DetailField label={t('materialDetail.code')} value={data.code} />}
          {data.categoryName && (
            <DetailField label={t('materialDetail.category')} value={data.categoryName} />
          )}
          <DetailField label={t('materialDetail.uom')} value={data.unitOfMeasure} />
          {data.status && <DetailField label={t('materialDetail.status')} value={data.status} />}
        </div>

        {data.description && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-1">{t('materialDetail.description')}</p>
            <p className="text-sm text-foreground">{data.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
