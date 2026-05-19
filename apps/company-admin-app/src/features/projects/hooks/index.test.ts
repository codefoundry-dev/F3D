vi.mock('./useProjectSort', () => ({ useProjectSort: vi.fn() }));

import { useProjectSort } from './index';

describe('projects/hooks re-exports', () => {
  it('re-exports useProjectSort', () => {
    expect(useProjectSort).toBeDefined();
  });
});
