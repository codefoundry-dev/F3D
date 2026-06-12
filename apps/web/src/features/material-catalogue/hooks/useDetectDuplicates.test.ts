import type { DetectMaterialDuplicatesResponse } from '@forethread/api-client';
import { describe, expect, it } from 'vitest';

import { mapDuplicateResults } from './useDetectDuplicates';

describe('mapDuplicateResults', () => {
  it('returns empty lookups for an undefined response', () => {
    const { duplicateIndexes, matchesByIndex } = mapDuplicateResults(undefined);
    expect(duplicateIndexes.size).toBe(0);
    expect(matchesByIndex.size).toBe(0);
  });

  it('collects only indexes that have at least one match', () => {
    const response: DetectMaterialDuplicatesResponse = {
      results: [
        { index: 0, matches: [] },
        {
          index: 2,
          matches: [
            {
              id: 'm-2',
              name: 'Concrete Block',
              code: 'MAT-00041',
              status: 'PUBLIC',
              matchedOn: ['name'],
            },
          ],
        },
        {
          index: 5,
          matches: [
            {
              id: 'm-5',
              name: 'Type I Masonry',
              code: 'MAT-00099',
              status: 'PUBLIC',
              matchedOn: ['upc'],
            },
            {
              id: 'm-6',
              name: 'Type I Masonry (dup)',
              code: 'MAT-00100',
              status: 'PUBLIC',
              matchedOn: ['name'],
            },
          ],
        },
      ],
    };

    const { duplicateIndexes, matchesByIndex } = mapDuplicateResults(response);

    expect([...duplicateIndexes].sort((a, b) => a - b)).toEqual([2, 5]);
    expect(duplicateIndexes.has(0)).toBe(false);
    expect(matchesByIndex.get(2)?.[0].code).toBe('MAT-00041');
    expect(matchesByIndex.get(5)).toHaveLength(2);
  });
});
