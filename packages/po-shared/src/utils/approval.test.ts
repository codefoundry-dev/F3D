import { describe, it, expect } from 'vitest';

import { requiresApproval } from './approval';

describe('requiresApproval (FOR-210)', () => {
  describe('threshold = null (unlimited authority)', () => {
    it('never requires approval, regardless of total', () => {
      expect(requiresApproval(null, 0)).toBe(false);
      expect(requiresApproval(null, 100)).toBe(false);
      expect(requiresApproval(null, 9_999_999)).toBe(false);
    });

    it('treats undefined threshold like unlimited', () => {
      expect(requiresApproval(undefined, 5000)).toBe(false);
    });
  });

  describe('threshold = 0 (no self-approval authority)', () => {
    it('requires approval for any positive total', () => {
      expect(requiresApproval(0, 0.01)).toBe(true);
      expect(requiresApproval(0, 1)).toBe(true);
      expect(requiresApproval(0, 100_000)).toBe(true);
    });

    it('does not require approval for a zero total', () => {
      expect(requiresApproval(0, 0)).toBe(false);
    });
  });

  describe('threshold = number (capped authority)', () => {
    it('does not require approval when total is within the threshold', () => {
      expect(requiresApproval(1000, 500)).toBe(false);
      expect(requiresApproval(1000, 1000)).toBe(false); // boundary: equal is allowed
    });

    it('requires approval when total exceeds the threshold', () => {
      expect(requiresApproval(1000, 1000.01)).toBe(true);
      expect(requiresApproval(1000, 5000)).toBe(true);
    });
  });

  describe('null / undefined / non-positive totals', () => {
    it('treats a null total as 0', () => {
      expect(requiresApproval(0, null)).toBe(false);
      expect(requiresApproval(1000, null)).toBe(false);
    });

    it('treats an undefined total as 0', () => {
      expect(requiresApproval(0, undefined)).toBe(false);
    });

    it('does not require approval for negative totals', () => {
      expect(requiresApproval(0, -50)).toBe(false);
    });
  });
});
