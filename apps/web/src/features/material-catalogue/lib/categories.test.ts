import { describe, expect, it } from 'vitest';

import { assignableCategories } from './categories';

const cats = [
  { id: 'a', isActive: true },
  { id: 'b', isActive: false },
  { id: 'c', isActive: true },
];

describe('assignableCategories', () => {
  it('drops deactivated categories', () => {
    expect(assignableCategories(cats).map((c) => c.id)).toEqual(['a', 'c']);
  });

  it("keeps the material's current category even when deactivated", () => {
    expect(assignableCategories(cats, 'b').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});
