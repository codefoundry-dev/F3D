import {
  type DocExtractionResponse,
  getGuestQuoteExtraction,
  submitGuestQuoteExtraction,
} from '@forethread/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

const TERMINAL_STATUSES: ReadonlySet<DocExtractionResponse['status']> = new Set([
  'COMPLETED',
  'CONFIRMED',
  'FAILED',
]);

const POLL_INTERVAL_MS = 1500;

export type ExtractionPhase = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

/**
 * Drives the guest "upload your quote PDF" path (FOR-206): uploads the file to
 * start a Gemini extraction, then polls the (token-less, id-addressed) status
 * endpoint until the job settles. The caller reads {@link ExtractionPhase} to
 * render upload / processing / review states.
 */
export function useQuoteExtraction(token: string) {
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => submitGuestQuoteExtraction(token, file),
    onSuccess: (job) => setExtractionId(job.id),
  });

  const pollQuery = useQuery({
    queryKey: ['guest-quote-extraction', extractionId],
    queryFn: () => getGuestQuoteExtraction(extractionId as string),
    enabled: Boolean(extractionId),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      return TERMINAL_STATUSES.has(data.status) ? false : POLL_INTERVAL_MS;
    },
  });

  const job = pollQuery.data ?? null;

  let phase: ExtractionPhase = 'idle';
  if (uploadMutation.isPending) {
    phase = 'uploading';
  } else if (job?.status === 'COMPLETED' || job?.status === 'CONFIRMED') {
    phase = 'completed';
  } else if (job?.status === 'FAILED' || pollQuery.isError) {
    phase = 'failed';
  } else if (extractionId) {
    phase = 'processing';
  }

  const upload = useCallback(
    (file: File) => {
      setFileName(file.name);
      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const reset = useCallback(() => {
    setExtractionId(null);
    setFileName(null);
    uploadMutation.reset();
  }, [uploadMutation]);

  return {
    phase,
    job,
    fileName,
    uploadError: uploadMutation.error ? uploadMutation.error.message : null,
    upload,
    reset,
  };
}
