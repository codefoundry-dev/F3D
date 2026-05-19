import { useTranslation } from '@forethread/i18n';

export default function ProjectListPage() {
  const { t } = useTranslation('projects');
  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">
        {t('list.title', { defaultValue: 'Projects' })}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Coming soon</p>
    </div>
  );
}
