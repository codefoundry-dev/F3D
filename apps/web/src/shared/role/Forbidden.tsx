import { useTranslation } from '@forethread/i18n';
import { Link } from 'react-router-dom';

import { useUserRole } from './useUserRole';
import { homePathForRole } from './roleHome';

export default function Forbidden() {
  const { t } = useTranslation(['common']);
  const role = useUserRole();
  const home = homePathForRole(role);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-2xl font-semibold">
        {t('common:forbiddenTitle', { defaultValue: '403 — Access denied' })}
      </h1>
      <p className="text-muted-foreground">
        {t('common:forbiddenDescription', {
          defaultValue: "You don't have permission to view this page.",
        })}
      </p>
      <Link to={home} className="text-primary hover:underline">
        {t('common:backHome', { defaultValue: 'Back to home' })}
      </Link>
    </div>
  );
}
