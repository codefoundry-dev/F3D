import { useTranslation } from '@forethread/i18n';
import { useNavigate } from 'react-router-dom';

import InfoIcon from '../assets/icons/info.svg?react';

import { ErrorFallback } from './ErrorFallback';

export interface ErrorPageProps {
  /** Optional custom title override */
  title?: string;
  /** Optional custom message override */
  message?: string;
}

export function ErrorPage({ title, message }: ErrorPageProps) {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();

  return (
    <ErrorFallback
      icon={<InfoIcon className="w-10 h-10 text-muted-foreground" />}
      title={title ?? t('common:errorTitle')}
      message={message ?? t('common:errorMessage')}
      retryLabel={t('common:errorRetry')}
      backLabel={t('common:errorBack')}
      onRetry={() => window.location.reload()}
      onBack={() => navigate(-1)}
    />
  );
}
