import { type MaterialCategoryDto } from '@forethread/api-client';

/**
 * Categories a material may be filed under (FOR-362): the active ones, plus
 * `keepId` — the material's current category — so editing a material that sits
 * in a since-deactivated category doesn't silently blank its picker. Filters
 * keep using the full list, so deactivated categories with materials stay
 * findable.
 */
export function assignableCategories<T extends Pick<MaterialCategoryDto, 'id' | 'isActive'>>(
  categories: readonly T[],
  keepId?: string | null,
): T[] {
  return categories.filter((c) => c.isActive !== false || c.id === keepId);
}
