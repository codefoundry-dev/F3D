import { getApiClient } from '../client';

const GOOGLE_PATHS = {
  ADDRESSES: '/google/places/addresses',
} as const;

export async function searchAddresses(
  input: string,
  country?: string,
  types?: string[],
  context?: string,
): Promise<string[]> {
  const { data } = await getApiClient().post<{ data: string[] }>(GOOGLE_PATHS.ADDRESSES, {
    input,
    country,
    types,
    context,
  });
  return data.data;
}
