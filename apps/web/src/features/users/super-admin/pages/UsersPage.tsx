// UsersPage — implemented in T059-T067 (users feature phase)
import { useTranslation } from '@forethread/i18n';

export default function UsersPage() {
  const { t } = useTranslation('users');

  return (
    <div className="p-8">
      <p className="mt-2 text-muted-foreground">{t('placeholderDescription')}</p>
    </div>
  );
}
