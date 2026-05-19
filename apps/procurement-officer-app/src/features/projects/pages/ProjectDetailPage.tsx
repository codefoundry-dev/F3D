import { useTranslation } from '@forethread/i18n';
import { useParams } from 'react-router-dom';

export default function ProjectDetailPage() {
  const { t } = useTranslation('projects');
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">
        {t('detail.title', { defaultValue: 'Project' })}: {id}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Coming soon</p>
    </div>
  );
}
