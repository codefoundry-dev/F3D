// LoginPage — implemented in T055-T058 (auth feature phase)
import { useTranslation } from '@forethread/i18n';

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-lg bg-card p-8 shadow">
        <h1 className="mb-6 text-2xl font-bold text-foreground">{t('auth:portalName')}</h1>
        <p className="text-muted-foreground">{t('auth:loginPlaceholderDescription')}</p>
      </div>
    </div>
  );
}
