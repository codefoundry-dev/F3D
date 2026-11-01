import { queryKeys, updateMaterial } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { toast } from '@forethread/ui-components';
import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query';

import type { MaterialCodeField } from '../components/MaterialTable';

export interface MaterialCodeEdit {
  id: string;
  field: MaterialCodeField;
  value: string;
}

/**
 * Save one cost / tax code edited in place in the catalogue table (FOR-365).
 * Resolves only after the list has refetched, so the cell's optimistic value
 * hands straight over to the saved one.
 */
export function useMaterialCodeMutation(): UseMutationResult<unknown, unknown, MaterialCodeEdit> {
  const { t } = useTranslation(['materialCatalogue']);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, field, value }: MaterialCodeEdit) =>
      updateMaterial(id, { [field]: value }, { skipErrorHandler: true }),
    onSuccess: (_material, { id, field }) => {
      toast.success(t('table.codeSaved', { field: t(`table.columns.${field}`) }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(id) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.materials.all() });
    },
    onError: (_error, { field }) =>
      toast.error(t('table.codeSaveError', { field: t(`table.columns.${field}`).toLowerCase() })),
  });
}
