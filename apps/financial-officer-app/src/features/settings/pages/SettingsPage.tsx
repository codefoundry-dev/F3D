import { useTranslation } from '@forethread/i18n';

export default function SettingsPage() {
  const { t } = useTranslation('nav');

  return (
    <div className="p-8 max-w-2xl">
      <p className="text-muted-foreground">{t('settingsSubtitle')}</p>
    </div>
  );
}
