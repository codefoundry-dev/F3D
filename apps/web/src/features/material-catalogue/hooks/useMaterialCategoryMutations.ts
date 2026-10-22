import { createMaterialCategory, queryKeys, updateMaterialCategory } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { toast } from '@forethread/ui-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { errorMessage } from './useMaterialMutations';

/**
 * Super-Admin category management (FOR-362): create, rename, (de)activate.
 * Invalidates the whole materials cache — category names render on every list
 * row — plus the vendor material-search popup's separate category key.
 * Errors are returned to the caller (not toasted) so the modal can show them
 * inline next to the field that caused them.
 */
export function useMaterialCategoryMutations() {
  const { t } = useTranslation(['materialCatalogue']);
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.materials.all() });
    void queryClient.invalidateQueries({ queryKey: ['material-categories'] });
  };

  const create = useMutation({
    mutationFn: (name: string) => createMaterialCategory({ name }, { skipErrorHandler: true }),
    onSuccess: (c) => {
      invalidate();
      toast.success(t('categories.toasts.created', { name: c.name }));
    },
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; isActive?: boolean }) =>
      updateMaterialCategory(id, input, { skipErrorHandler: true }),
    onSuccess: (c, vars) => {
      invalidate();
      if (vars.name !== undefined) toast.success(t('categories.toasts.renamed', { name: c.name }));
      else if (c.isActive) toast.success(t('categories.toasts.activated', { name: c.name }));
      else toast.success(t('categories.toasts.deactivated', { name: c.name }));
    },
  });

  return {
    create,
    update,
    errorText: (error: unknown) => errorMessage(error, t('categories.errors.saveFailed')),
  };
}
