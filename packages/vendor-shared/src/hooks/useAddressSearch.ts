import { searchAddresses } from '@forethread/api-client';
import { useCallback } from 'react';

export function useAddressSearch() {
  return useCallback(
    (input: string, types?: string[], locationContext?: string) =>
      searchAddresses(input, undefined, types, locationContext),
    [],
  );
}
