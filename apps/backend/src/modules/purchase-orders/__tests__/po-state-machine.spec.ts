import { BadRequestException } from '@nestjs/common';
import { PoStatus } from '@prisma/client';

import { PO_TRANSITIONS, canTransition, assertTransition } from '../po-state-machine';

describe('PO state machine', () => {
  describe('canTransition', () => {
    it('allows a legal transition (DRAFT → SENT)', () => {
      expect(canTransition(PoStatus.DRAFT, PoStatus.SENT)).toBe(true);
    });

    it('rejects an illegal transition (DRAFT → DELIVERED)', () => {
      expect(canTransition(PoStatus.DRAFT, PoStatus.DELIVERED)).toBe(false);
    });

    it('rejects a self-transition (SENT → SENT)', () => {
      expect(canTransition(PoStatus.SENT, PoStatus.SENT)).toBe(false);
    });

    it('rejects any transition out of a terminal state (CANCELLED → SENT)', () => {
      expect(canTransition(PoStatus.CANCELLED, PoStatus.SENT)).toBe(false);
    });

    it('treats an unknown source status as having no transitions', () => {
      expect(canTransition('NOT_A_STATUS' as PoStatus, PoStatus.SENT)).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw for a legal transition', () => {
      expect(() => assertTransition(PoStatus.SENT, PoStatus.ACKNOWLEDGED)).not.toThrow();
    });

    it('throws BadRequestException for an illegal transition', () => {
      expect(() => assertTransition(PoStatus.DELIVERED, PoStatus.DRAFT)).toThrow(
        BadRequestException,
      );
    });

    it('names the offending pair in the error message', () => {
      expect(() => assertTransition(PoStatus.CLOSED, PoStatus.SENT)).toThrow('CLOSED → SENT');
    });
  });

  describe('PO_TRANSITIONS map', () => {
    it('defines an entry for every PoStatus value', () => {
      for (const status of Object.values(PoStatus)) {
        expect(PO_TRANSITIONS[status]).toBeDefined();
      }
    });

    it('marks terminal states with no outgoing transitions', () => {
      expect(PO_TRANSITIONS[PoStatus.CANCELLED]).toEqual([]);
      expect(PO_TRANSITIONS[PoStatus.CLOSED]).toEqual([]);
      expect(PO_TRANSITIONS[PoStatus.CANCELLED_BY_VENDOR]).toEqual([]);
      expect(PO_TRANSITIONS[PoStatus.DECLINED]).toEqual([]);
      expect(PO_TRANSITIONS[PoStatus.NOT_DELIVERED]).toEqual([]);
    });
  });
});
