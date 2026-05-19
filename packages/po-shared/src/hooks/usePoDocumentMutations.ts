import { uploadPoDocument, deletePoDocument } from '@forethread/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Encapsulates upload & delete document mutations for a Purchase Order,
 * including query cache invalidation and loading state tracking.
 */
export function usePoDocumentMutations(poId: string) {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPoDocument(poId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', poId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => deletePoDocument(poId, docId),
    onSuccess: () => {
      setDeletingId(null);
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', poId] });
    },
    onError: () => setDeletingId(null),
  });

  const deleteDocument = (docId: string) => {
    setDeletingId(docId);
    deleteMutation.mutate(docId);
  };

  return {
    uploadMutation,
    deleteMutation,
    deletingId,
    deleteDocument,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
