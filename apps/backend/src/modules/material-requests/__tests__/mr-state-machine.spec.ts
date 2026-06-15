import { BadRequestException } from '@nestjs/common';
import { MaterialRequestStatus } from '@prisma/client';

import { MR_TRANSITIONS, assertTransition, canTransition } from '../mr-state-machine';

describe('MR state machine', () => {
  describe('canTransition', () => {
    it('allows DRAFT → SUBMITTED', () => {
      expect(canTransition(MaterialRequestStatus.DRAFT, MaterialRequestStatus.SUBMITTED)).toBe(
        true,
      );
    });

    it('allows DRAFT → CANCELLED', () => {
      expect(canTransition(MaterialRequestStatus.DRAFT, MaterialRequestStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('allows SUBMITTED → APPROVED', () => {
      expect(canTransition(MaterialRequestStatus.SUBMITTED, MaterialRequestStatus.APPROVED)).toBe(
        true,
      );
    });

    it('allows SUBMITTED → DECLINED', () => {
      expect(canTransition(MaterialRequestStatus.SUBMITTED, MaterialRequestStatus.DECLINED)).toBe(
        true,
      );
    });

    it('allows SUBMITTED → CANCELLED', () => {
      expect(canTransition(MaterialRequestStatus.SUBMITTED, MaterialRequestStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('allows APPROVED → CONVERTED', () => {
      expect(canTransition(MaterialRequestStatus.APPROVED, MaterialRequestStatus.CONVERTED)).toBe(
        true,
      );
    });

    it('allows APPROVED → CANCELLED', () => {
      expect(canTransition(MaterialRequestStatus.APPROVED, MaterialRequestStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('rejects an illegal transition (DRAFT → APPROVED)', () => {
      expect(canTransition(MaterialRequestStatus.DRAFT, MaterialRequestStatus.APPROVED)).toBe(
        false,
      );
    });

    it('rejects an illegal transition (DRAFT → CONVERTED)', () => {
      expect(canTransition(MaterialRequestStatus.DRAFT, MaterialRequestStatus.CONVERTED)).toBe(
        false,
      );
    });

    it('rejects an illegal transition (SUBMITTED → CONVERTED)', () => {
      expect(canTransition(MaterialRequestStatus.SUBMITTED, MaterialRequestStatus.CONVERTED)).toBe(
        false,
      );
    });

    it('rejects a self-transition (SUBMITTED → SUBMITTED)', () => {
      expect(canTransition(MaterialRequestStatus.SUBMITTED, MaterialRequestStatus.SUBMITTED)).toBe(
        false,
      );
    });

    it('rejects any transition out of a terminal state (CONVERTED → CANCELLED)', () => {
      expect(canTransition(MaterialRequestStatus.CONVERTED, MaterialRequestStatus.CANCELLED)).toBe(
        false,
      );
    });

    it('rejects any transition out of DECLINED', () => {
      expect(canTransition(MaterialRequestStatus.DECLINED, MaterialRequestStatus.SUBMITTED)).toBe(
        false,
      );
    });

    it('rejects any transition out of CANCELLED', () => {
      expect(canTransition(MaterialRequestStatus.CANCELLED, MaterialRequestStatus.SUBMITTED)).toBe(
        false,
      );
    });

    it('treats an unknown source status as having no transitions', () => {
      expect(
        canTransition('NOT_A_STATUS' as MaterialRequestStatus, MaterialRequestStatus.SUBMITTED),
      ).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw for a legal transition', () => {
      expect(() =>
        assertTransition(MaterialRequestStatus.SUBMITTED, MaterialRequestStatus.APPROVED),
      ).not.toThrow();
    });

    it('throws BadRequestException for an illegal transition', () => {
      expect(() =>
        assertTransition(MaterialRequestStatus.CONVERTED, MaterialRequestStatus.DRAFT),
      ).toThrow(BadRequestException);
    });

    it('names the offending pair in the error message', () => {
      expect(() =>
        assertTransition(MaterialRequestStatus.DECLINED, MaterialRequestStatus.SUBMITTED),
      ).toThrow('DECLINED → SUBMITTED');
    });
  });

  describe('MR_TRANSITIONS map', () => {
    it('defines an entry for every MaterialRequestStatus value', () => {
      for (const status of Object.values(MaterialRequestStatus)) {
        expect(MR_TRANSITIONS[status]).toBeDefined();
      }
    });

    it('marks terminal states with no outgoing transitions', () => {
      expect(MR_TRANSITIONS[MaterialRequestStatus.CONVERTED]).toEqual([]);
      expect(MR_TRANSITIONS[MaterialRequestStatus.DECLINED]).toEqual([]);
      expect(MR_TRANSITIONS[MaterialRequestStatus.CANCELLED]).toEqual([]);
    });
  });
});
