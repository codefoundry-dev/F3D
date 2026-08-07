import type { ApproverPoolView } from '@forethread/api-client';
import { fireEvent, render, screen } from '@testing-library/react';

const mockUseApproverPool = vi.hoisted(() => vi.fn());
const mockAddMutate = vi.hoisted(() => vi.fn());
const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useApproverPool', () => ({
  useApproverPool: mockUseApproverPool,
  useAddNominations: () => ({ mutate: mockAddMutate, isPending: false }),
  useWithdrawNomination: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@forethread/ui-components', async () => {
  const actual = await vi.importActual<typeof import('@forethread/ui-components')>(
    '@forethread/ui-components',
  );
  return { ...actual, notificationService: { success: mockSuccess, error: mockError } };
});

import { NominateApproversModal } from './NominateApproversModal';

function makePool(overrides: Partial<ApproverPoolView> = {}): ApproverPoolView {
  return {
    entityType: 'PURCHASE_ORDER',
    entityId: 'po-1',
    approvalStatus: 'PENDING',
    members: [
      { id: 'u1', name: 'Ama Boateng', role: 'PROCUREMENT_OFFICER', customRoleName: null },
      { id: 'u2', name: 'Kojo Owusu', role: 'COMPANY_ADMIN', customRoleName: null },
    ],
    roleGroups: [
      { role: 'PROCUREMENT_OFFICER', customRoleName: null, count: 1 },
      { role: 'COMPANY_ADMIN', customRoleName: null, count: 1 },
    ],
    memberCount: 2,
    isEmpty: false,
    resolvedBy: null,
    resolvedAt: null,
    nominations: [],
    canNominate: true,
    ...overrides,
  };
}

function renderModal(
  props: Partial<React.ComponentProps<typeof NominateApproversModal>> = {},
  pool = makePool(),
) {
  mockUseApproverPool.mockReturnValue({ data: pool, isLoading: false, isError: false });
  return render(
    <NominateApproversModal
      entityType="PURCHASE_ORDER"
      entityId="po-1"
      mode="submit"
      onClose={vi.fn()}
      {...props}
    />,
  );
}

/** The checkbox for a named pool member. */
function checkboxFor(name: string): HTMLInputElement {
  const label = screen.getByText(name).closest('label');
  return label?.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

describe('NominateApproversModal (FOR-306)', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('submit mode', () => {
    it('lists the pool by name and role', () => {
      renderModal();
      expect(screen.getByText('Ama Boateng')).toBeInTheDocument();
      expect(screen.getByText('Kojo Owusu')).toBeInTheDocument();
      expect(screen.getByText('Procurement Officer')).toBeInTheDocument();
    });

    it('never renders a cap amount', () => {
      const { container } = renderModal();
      // A picker showing "approves up to 50,000.00" would publish the spend
      // hierarchy and invite approver-shopping.
      expect(container.textContent).not.toMatch(/\d[\d,]*\.\d{2}/);
    });

    it('preselects "notify everyone", so confirming untouched keeps today’s behaviour', () => {
      const onConfirm = vi.fn();
      renderModal({ onConfirm });

      expect(screen.getByLabelText('Notify everyone in the pool')).toBeChecked();
      fireEvent.click(screen.getByTestId('nominate-modal-confirm'));

      // An empty list is the wire signal for "the whole pool".
      expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it('disables the per-person checkboxes while "notify everyone" is chosen', () => {
      renderModal();
      expect(checkboxFor('Ama Boateng')).toBeDisabled();
    });

    it('confirms with only the people picked', () => {
      const onConfirm = vi.fn();
      renderModal({ onConfirm });

      fireEvent.click(screen.getByLabelText('Notify specific people'));
      fireEvent.click(checkboxFor('Kojo Owusu'));
      fireEvent.click(screen.getByTestId('nominate-modal-confirm'));

      expect(onConfirm).toHaveBeenCalledWith(['u2']);
    });

    it('refuses to confirm an empty explicit selection rather than silently broadcasting', () => {
      const onConfirm = vi.fn();
      renderModal({ onConfirm });

      fireEvent.click(screen.getByLabelText('Notify specific people'));
      fireEvent.click(screen.getByTestId('nominate-modal-confirm'));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(mockError).toHaveBeenCalled();
    });

    it('blocks at the modal when nobody can approve, instead of submitting into a dead state', () => {
      const onConfirm = vi.fn();
      renderModal(
        { onConfirm },
        makePool({ members: [], roleGroups: [], memberCount: 0, isEmpty: true }),
      );

      expect(screen.getByText('No one can approve this')).toBeInTheDocument();
      expect(screen.queryByTestId('nominate-modal-confirm')).not.toBeInTheDocument();
    });
  });

  describe('add mode (FOR-308)', () => {
    const withNominee = () =>
      makePool({
        nominations: [
          {
            userId: 'u1',
            name: 'Ama Boateng',
            role: 'PROCUREMENT_OFFICER',
            customRoleName: null,
            nominatedAt: '2026-08-09T10:00:00.000Z',
            nominatedById: 'creator-1',
            stillEligible: true,
          },
        ],
      });

    it('hides people already asked — re-nominating them is a no-op, not a second email', () => {
      renderModal({ mode: 'add' }, withNominee());

      expect(screen.queryByText('Ama Boateng')).not.toBeInTheDocument();
      expect(screen.getByText('Kojo Owusu')).toBeInTheDocument();
    });

    it('offers no "notify everyone" choice — the point is naming someone new', () => {
      renderModal({ mode: 'add' }, withNominee());
      expect(screen.queryByLabelText('Notify everyone in the pool')).not.toBeInTheDocument();
    });

    it('adds the picked nominees itself rather than handing them back', () => {
      const onClose = vi.fn();
      renderModal({ mode: 'add', onClose }, withNominee());

      fireEvent.click(checkboxFor('Kojo Owusu'));
      fireEvent.click(screen.getByTestId('nominate-modal-confirm'));

      expect(mockAddMutate).toHaveBeenCalledWith(['u2'], expect.any(Object));
    });
  });
});
