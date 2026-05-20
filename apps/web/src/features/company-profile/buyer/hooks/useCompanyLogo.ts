import { getCompanyLogoUrl, uploadCompanyLogo } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { notificationService } from '@forethread/ui-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useRef } from 'react';

const COMPANY_KEY = 'company-profile';
const LOGO_URL_KEY = 'company-logo-url';

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB

export function useCompanyLogo(companyId: string | undefined) {
  const { t } = useTranslation('company');
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: logoUrl } = useQuery({
    queryKey: [LOGO_URL_KEY, companyId],
    queryFn: () => getCompanyLogoUrl(companyId as string),
    enabled: Boolean(companyId),
    select: (d) => d.url,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(companyId as string, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [COMPANY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [LOGO_URL_KEY] });
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected
    e.target.value = '';

    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      notificationService.error(t('logoInvalidFormat'));
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      notificationService.error(t('logoTooLarge'));
      return;
    }

    uploadMutation.mutate(file);
  };

  const openFilePicker = () => inputRef.current?.click();

  return {
    logoUrl,
    inputRef,
    isPending: uploadMutation.isPending,
    handleLogoChange,
    openFilePicker,
  };
}
