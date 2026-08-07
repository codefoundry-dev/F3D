import type { ApprovalEntityType, ApproverPoolView } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';

const mockUseApproverPool = vi.hoisted(() => vi.fn());
const mockWithdrawMutate = vi.hoisted(() => vi.fn());

// i18n is deliberately NOT mocked: the pool summary's grammar (irregular role
// plurals, the tenant-scoped "in your company" phrasing) is part of what this
// panel promises, and a key-echoing stub would assert none of it.
vi.mock('../hooks/useApproverPool', () => ({
  useApproverPool: mockUseApproverPool,
  useWithdrawNomination: () => ({ mutate: mockWithdrawMutate, isPending: false }),
  useAddNominations: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ApproverPoolPanel } from './ApproverPoolPanel';

function makePool(overrides: Partial<ApproverPoolView> = {}): ApproverPoolView {
  return {
    entityType: 'PURCHASE_ORDER',
    entityId: 'po-1',
    approvalStatus: 'PENDING',
    members: [
      { id: 'u1', name: 'Ama Boateng', role: 'PROCUREMENT_OFFICER', customRoleName: null },
      { id: 'u2', name: 'Kojo Owusu', role: 'PROCUREMENT_OFFICER', customRoleName: null },
      { id: 'u3', name: 'Efua Sarpong', role: 'COMPANY_ADMIN', customRoleName: null },
    ],
    roleGroups: [
      { role: 'PROCUREMENT_OFFICER', customRoleName: null, count: 2 },
      { role: 'COMPANY_ADMIN', customRoleName: null, count: 1 },
    ],
    memberCount: 3,
    isEmpty: false,
    resolvedBy: null,
    resolvedAt: null,
    nominations: [],
    canNominate: false,
    ...overrides,
  };
}

function renderPanel(
  pool: ApproverPoolView | undefined,
  entityType: ApprovalEntityType = 'PURCHASE_ORDER',
) {
  mockUseApproverPool.mockReturnValue({ data: pool, isLoading: false, isError: !pool });
  return render(<ApproverPoolPanel entityType={entityType} entityId="po-1" />);
}

describe('ApproverPoolPanel (FOR-304)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when the document never needed approval', () => {
    const { container } = renderPanel(makePool({ approvalStatus: 'NOT_REQUIRED' }));
    expect(container.firstChild).toBeNull();
  });

  describe('while pending', () => {
    it('names the pool by role and count, never by individual', () => {
      renderPanel(makePool());

      expect(screen.getByTestId('approver-pool-summary')).toHaveTextContent(
        'Procurement Officers, Company Admin (3 people in your company)',
      );

      // No member is named while responsibility sits with the Pool as a group.
      expect(screen.queryByText(/Ama Boateng/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Kojo Owusu/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Efua Sarpong/)).not.toBeInTheDocument();
    });

    it('scopes the count to the viewer’s own company', () => {
      renderPanel(makePool({ memberCount: 1, roleGroups: [makePool().roleGroups[1]] }));
      expect(screen.getByTestId('approver-pool-summary')).toHaveTextContent(
        '(1 person in your company)',
      );
    });

    it('pluralises a built-in role irregularly rather than by appending "s"', () => {
      renderPanel(
        makePool({
          roleGroups: [{ role: 'FOREMAN', customRoleName: null, count: 3 }],
          memberCount: 3,
        }),
      );
      const summary = screen.getByTestId('approver-pool-summary');
      expect(summary).toHaveTextContent('Foremen');
      expect(summary.textContent).not.toContain('Foremans');
    });

    it('labels a custom-role holder by the custom role, not the built-in one', () => {
      renderPanel(
        makePool({
          roleGroups: [{ role: 'FOREMAN', customRoleName: 'Junior Buyer', count: 1 }],
          memberCount: 1,
        }),
      );
      const summary = screen.getByTestId('approver-pool-summary');
      expect(summary).toHaveTextContent('Junior Buyer');
      expect(summary.textContent).not.toContain('Foreman');
    });

    it('renders no cap amount anywhere in the DOM', () => {
      const { container } = renderPanel(makePool());
      // Publishing per-user caps would expose the company's spend hierarchy and
      // invite approver-shopping. The read model carries none — and the panel
      // must not reconstruct one from anything else it has.
      expect(container.textContent).not.toMatch(/\d[\d,]*\.\d{2}/);
      expect(container.textContent).not.toMatch(/limit/i);
    });

    it('hides the nomination affordance when the viewer is not the nominator', () => {
      renderPanel(makePool({ canNominate: false }));
      expect(screen.queryByTestId('approver-pool-nominate')).not.toBeInTheDocument();
    });

    it('offers nomination to the creator', () => {
      renderPanel(makePool({ canNominate: true }));
      expect(screen.getByTestId('approver-pool-nominate')).toBeInTheDocument();
    });
  });

  describe('nominees', () => {
    const nomination = (overrides: Partial<ApproverPoolView['nominations'][number]> = {}) => ({
      userId: 'u1',
      name: 'Ama Boateng',
      role: 'PROCUREMENT_OFFICER',
      customRoleName: null,
      nominatedAt: '2026-08-09T10:00:00.000Z',
      nominatedById: 'creator-1',
      stillEligible: true,
      ...overrides,
    });

    it('names nominees — they were explicitly asked, unlike the pool at large', () => {
      renderPanel(makePool({ nominations: [nomination()] }));
      expect(screen.getByText('Ama Boateng')).toBeInTheDocument();
    });

    it('greys a nominee who fell out of the pool rather than dropping them', () => {
      renderPanel(
        makePool({
          nominations: [nomination({ userId: 'u9', name: 'Yaw Mensah', stillEligible: false })],
        }),
      );
      // The Pool is live, but a Nomination is the creator's frozen intent — it
      // survives the nominee losing eligibility, so the creator can see why
      // nothing is happening.
      expect(screen.getByText('Yaw Mensah')).toBeInTheDocument();
      expect(screen.getByText('no longer eligible')).toBeInTheDocument();
    });

    it('says everyone was notified when nobody was nominated', () => {
      renderPanel(makePool({ nominations: [] }));
      expect(screen.getByText('Everyone in the pool was notified.')).toBeInTheDocument();
    });
  });

  describe('once resolved', () => {
    it('names the individual who approved, plus when', () => {
      renderPanel(
        makePool({
          approvalStatus: 'APPROVED',
          resolvedBy: { id: 'u1', name: 'Ama Boateng' },
          resolvedAt: '2026-08-12T09:30:00.000Z',
        }),
      );
      // ADR-0006's audit requirement wants a person, not a group, once the
      // decision has an owner.
      expect(screen.getByTestId('approver-pool-resolved')).toHaveTextContent(
        'Approved by Ama Boateng · Aug 12, 2026',
      );
      expect(screen.queryByTestId('approver-pool-summary')).not.toBeInTheDocument();
    });

    it('names the individual who rejected', () => {
      renderPanel(
        makePool({
          approvalStatus: 'REJECTED',
          resolvedBy: { id: 'u1', name: 'Ama Boateng' },
          resolvedAt: '2026-08-12T09:30:00.000Z',
        }),
      );
      expect(screen.getByTestId('approver-pool-resolved')).toHaveTextContent(
        'Rejected by Ama Boateng',
      );
    });
  });

  describe('empty pool (FOR-302)', () => {
    it('explains that nobody can approve instead of showing an empty list', () => {
      renderPanel(makePool({ members: [], roleGroups: [], memberCount: 0, isEmpty: true }));
      expect(screen.getByTestId('approver-pool-empty')).toHaveTextContent(
        'No one can approve this',
      );
      expect(screen.getByText(/Raise an approval limit/)).toBeInTheDocument();
      expect(screen.queryByTestId('approver-pool-summary')).not.toBeInTheDocument();
    });
  });

  it('renders the same shape for an invoice as for a purchase order (FOR-309)', () => {
    const po = renderPanel(makePool(), 'PURCHASE_ORDER');
    const poSummary = screen.getByTestId('approver-pool-summary').textContent;
    po.unmount();

    renderPanel(makePool({ entityType: 'INVOICE', entityId: 'inv-1' }), 'INVOICE');
    expect(screen.getByTestId('approver-pool-summary').textContent).toBe(poSummary);
  });
});
