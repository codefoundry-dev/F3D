import { type CatalogueImportSummary, importCatalogue, queryKeys } from '@forethread/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Commits a confirmed CATALOGUE extraction into the materials catalogue
 * (FOR-228). On success the materials list cache is invalidated so the newly
 * imported rows show up immediately.
 */
export function useCatalogueImport() {
  const qc = useQueryClient();
  return useMutation<CatalogueImportSummary, Error, string>({
    // Bulk-importing a large catalogue (tens of thousands of rows) takes well
    // beyond the api client's default 30s timeout, so allow up to 5 minutes.
    mutationFn: (extractionId: string) => importCatalogue(extractionId, { timeout: 300_000 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.materials.all() });
    },
  });
}
