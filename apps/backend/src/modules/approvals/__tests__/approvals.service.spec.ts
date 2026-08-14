import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalEntityType, ApprovalStatus, UserRole } from '@prisma/client';

import { ApprovalsService } from '../approvals.service';

const creator = {
  id: 'creator-1',
  email: 'creator@test.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'comp-1',
};
const bystander = {
  id: 'other-1',
  email: 'other@test.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'comp-1',
};
const otherCompany = { ...bystander, id: 'x-1', companyId: 'comp-2' };
const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const mockPrisma = {
  purchaseOrder: { findUnique: jest.fn() },
  invoice: { findUnique: jest.fn() },
  materialRequest: { findUnique: jest.fn() },
  approvalNomination: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  auditLog: { findFirst: jest.fn() },
  user: { findFirst: jest.fn() },
};

const mockApprovalAuth = {
  resolveApproverPool: jest.fn(),
};

const poMember = (
  id: string,
  name: string,
  role: UserRole,
  customRoleName: string | null = null,
) => ({
  id,
  name,
  email: `${id}@test.com`,
  role,
  customRoleName,
});

function makeService() {
  return new ApprovalsService(mockPrisma as never, mockApprovalAuth as never) as ApprovalsService &
    Record<string, never>;
}

function givenPo(overrides: Record<string, unknown> = {}) {
  mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
    id: 'po-1',
    companyId: 'comp-1',
    totalAmount: 5000,
    approvalStatus: ApprovalStatus.PENDING,
    createdByUserId: creator.id,
    approvedBy: null,
    ...overrides,
  });
}

function givenMr(overrides: Record<string, unknown> = {}) {
  mockPrisma.materialRequest.findUnique.mockResolvedValue({
    id: 'mr-1',
    companyId: 'comp-1',
    status: 'SUBMITTED',
    requestedById: creator.id,
    reviewedBy: null,
    ...overrides,
  });
}

describe('ApprovalsService (FOR-304)', () => {
  let service: ApprovalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.approvalNomination.findMany.mockResolvedValue([]);
    mockPrisma.approvalNomination.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.approvalNomination.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockApprovalAuth.resolveApproverPool.mockResolvedValue([]);
    service = makeService();
  });

  describe('getApproverPool', () => {
    it('groups members by role so the panel can name the pool without naming a person', async () => {
      givenPo();
      mockApprovalAuth.resolveApproverPool.mockResolvedValue([
        poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
        poMember('u2', 'Kojo Owusu', UserRole.PROCUREMENT_OFFICER),
        poMember('u3', 'Efua Sarpong', UserRole.COMPANY_ADMIN),
      ]);

      const view = await service.getApproverPool(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        creator,
      );

      expect(view.memberCount).toBe(3);
      expect(view.isEmpty).toBe(false);
      expect(view.roleGroups).toEqual([
        { role: UserRole.PROCUREMENT_OFFICER, customRoleName: null, count: 2 },
        { role: UserRole.COMPANY_ADMIN, customRoleName: null, count: 1 },
      ]);
    });

    it('keeps a custom role as its own group rather than folding it into the built-in one', async () => {
      givenPo();
      mockApprovalAuth.resolveApproverPool.mockResolvedValue([
        poMember('u1', 'Ama Boateng', UserRole.FOREMAN, 'Junior Buyer'),
        poMember('u2', 'Kojo Owusu', UserRole.FOREMAN),
      ]);

      const view = await service.getApproverPool(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        creator,
      );

      // The custom role's grant *replaced* the built-in one, so "Junior Buyer"
      // must never hide inside "Foreman" — they qualified on different caps.
      expect(view.roleGroups).toEqual([
        { role: UserRole.FOREMAN, customRoleName: 'Junior Buyer', count: 1 },
        { role: UserRole.FOREMAN, customRoleName: null, count: 1 },
      ]);
    });

    it('never exposes a cap amount or an email in the member view', async () => {
      givenPo();
      mockApprovalAuth.resolveApproverPool.mockResolvedValue([
        poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
      ]);

      const view = await service.getApproverPool(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        creator,
      );

      // The Pool is rendered to tenants. A cap would publish the spend
      // hierarchy; an email is more contact detail than the panel needs.
      expect(view.members[0]).toEqual({
        id: 'u1',
        name: 'Ama Boateng',
        role: UserRole.PROCUREMENT_OFFICER,
        customRoleName: null,
      });
      expect(JSON.stringify(view)).not.toContain('threshold');
      expect(JSON.stringify(view)).not.toContain('@test.com');
    });

    it('recomputes the pool on every call instead of reading a stored one', async () => {
      givenPo();
      await service.getApproverPool(ApprovalEntityType.PURCHASE_ORDER, 'po-1', creator);
      await service.getApproverPool(ApprovalEntityType.PURCHASE_ORDER, 'po-1', creator);

      // Authorisation is evaluated live at approve time; a snapshot would name
      // approvers who then hit a 403.
      expect(mockApprovalAuth.resolveApproverPool).toHaveBeenCalledTimes(2);
      expect(mockApprovalAuth.resolveApproverPool).toHaveBeenCalledWith(
        'comp-1',
        'po.approve',
        5000,
      );
    });

    it('previews the pool for an unsaved total when one is supplied (FOR-309)', async () => {
      givenPo();

      await service.getApproverPool(ApprovalEntityType.PURCHASE_ORDER, 'po-1', creator, 99_000);

      // The invoice reviewer picks approvers for a figure they have typed but
      // not yet saved; the stored total would list the wrong people.
      expect(mockApprovalAuth.resolveApproverPool).toHaveBeenCalledWith(
        'comp-1',
        'po.approve',
        99_000,
      );
    });

    it('treats an explicit null preview as "no cap to clear" rather than falling back', async () => {
      givenPo();

      await service.getApproverPool(ApprovalEntityType.PURCHASE_ORDER, 'po-1', creator, null);

      // A cleared total field is a real state, not "use the old one".
      expect(mockApprovalAuth.resolveApproverPool).toHaveBeenCalledWith(
        'comp-1',
        'po.approve',
        null,
      );
    });

    it('flags an empty pool rather than returning a bare empty list', async () => {
      givenPo();
      mockApprovalAuth.resolveApproverPool.mockResolvedValue([]);

      const view = await service.getApproverPool(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        creator,
      );

      expect(view.isEmpty).toBe(true);
      expect(view.memberCount).toBe(0);
      expect(view.roleGroups).toEqual([]);
    });

    it('still lists a PO creator in their own Pool — PO separation of duties is FOR-320', async () => {
      givenPo();
      mockApprovalAuth.resolveApproverPool.mockResolvedValue([
        poMember(creator.id, 'Creator', UserRole.PROCUREMENT_OFFICER),
      ]);

      const view = await service.getApproverPool(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        creator,
      );

      // The FOR-349 exclusion is deliberately scoped to material requests; the
      // PO hole closes with the enterprise engine's SoD rule.
      expect(view.members.map((m) => m.id)).toEqual([creator.id]);
    });

    it('resolves an invoice through invoice.approve, reusing the same pool logic', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        companyId: 'comp-1',
        totalAmount: 800,
        approvalStatus: ApprovalStatus.PENDING,
        reviewedByUserId: creator.id,
        approvedBy: null,
      });

      const view = await service.getApproverPool(ApprovalEntityType.INVOICE, 'inv-1', creator);

      expect(mockApprovalAuth.resolveApproverPool).toHaveBeenCalledWith(
        'comp-1',
        'invoice.approve',
        800,
      );
      expect(view.entityType).toBe(ApprovalEntityType.INVOICE);
    });

    describe('material requests (FOR-347)', () => {
      it('resolves through materialRequest.approve with a null amount — grant membership, not caps', async () => {
        givenMr();

        const view = await service.getApproverPool(
          ApprovalEntityType.MATERIAL_REQUEST,
          'mr-1',
          creator,
        );

        expect(mockApprovalAuth.resolveApproverPool).toHaveBeenCalledWith(
          'comp-1',
          'materialRequest.approve',
          null,
        );
        expect(view.entityType).toBe(ApprovalEntityType.MATERIAL_REQUEST);
        expect(view.approvalStatus).toBe(ApprovalStatus.PENDING);
      });

      it.each([
        ['DRAFT', ApprovalStatus.NOT_REQUIRED],
        ['SUBMITTED', ApprovalStatus.PENDING],
        ['APPROVED', ApprovalStatus.APPROVED],
        ['CONVERTED', ApprovalStatus.APPROVED],
        ['DECLINED', ApprovalStatus.REJECTED],
        ['CANCELLED', ApprovalStatus.NOT_REQUIRED],
      ])('derives approval status from MaterialRequestStatus %s → %s', async (status, expected) => {
        // An MR has no stored approvalStatus column: its lifecycle IS its
        // approval axis, so the service derives one instead of duplicating state.
        givenMr({ status });
        mockPrisma.auditLog.findFirst.mockResolvedValue(null);

        const view = await service.getApproverPool(
          ApprovalEntityType.MATERIAL_REQUEST,
          'mr-1',
          creator,
        );

        expect(view.approvalStatus).toBe(expected);
      });

      it('surfaces the reviewer as the resolver once approved', async () => {
        givenMr({ status: 'APPROVED', reviewedBy: { id: 'u9', name: 'Ama Boateng' } });
        mockPrisma.auditLog.findFirst.mockResolvedValue({
          createdAt: new Date('2026-08-13T10:00:00.000Z'),
        });

        const view = await service.getApproverPool(
          ApprovalEntityType.MATERIAL_REQUEST,
          'mr-1',
          creator,
        );

        expect(view.resolvedBy).toEqual({ id: 'u9', name: 'Ama Boateng' });
        expect(view.resolvedAt).toBe('2026-08-13T10:00:00.000Z');
        expect(mockPrisma.auditLog.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ targetType: 'MaterialRequest' }),
          }),
        );
      });

      it('excludes the requester from their own Pool, whatever grant they hold (FOR-349)', async () => {
        givenMr();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([
          poMember(creator.id, 'Creator', UserRole.PROCUREMENT_OFFICER),
          poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
        ]);

        const view = await service.getApproverPool(
          ApprovalEntityType.MATERIAL_REQUEST,
          'mr-1',
          bystander,
        );

        expect(view.members.map((m) => m.id)).toEqual(['u1']);
        expect(view.memberCount).toBe(1);
        expect(view.roleGroups).toEqual([
          { role: UserRole.PROCUREMENT_OFFICER, customRoleName: null, count: 1 },
        ]);
      });

      it('flags an empty Pool when the requester is the only grant holder (FOR-349)', async () => {
        givenMr();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([
          poMember(creator.id, 'Creator', UserRole.PROCUREMENT_OFFICER),
        ]);

        const view = await service.getApproverPool(
          ApprovalEntityType.MATERIAL_REQUEST,
          'mr-1',
          creator,
        );

        expect(view.isEmpty).toBe(true);
        expect(view.memberCount).toBe(0);
      });

      it('lets the requester nominate while pending, and nobody else', async () => {
        givenMr();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([
          poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
        ]);

        const asRequester = await service.getApproverPool(
          ApprovalEntityType.MATERIAL_REQUEST,
          'mr-1',
          creator,
        );
        const asBystander = await service.getApproverPool(
          ApprovalEntityType.MATERIAL_REQUEST,
          'mr-1',
          bystander,
        );

        expect(asRequester.canNominate).toBe(true);
        expect(asBystander.canNominate).toBe(false);
      });

      it('throws NotFound for a missing material request', async () => {
        mockPrisma.materialRequest.findUnique.mockResolvedValue(null);
        await expect(
          service.getApproverPool(ApprovalEntityType.MATERIAL_REQUEST, 'mr-x', creator),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('getProspectivePool (FOR-347)', () => {
      it('resolves the pool for the caller company with no document at all', async () => {
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([
          poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
          poMember('u2', 'Efua Sarpong', UserRole.COMPANY_ADMIN),
        ]);

        const view = await service.getProspectivePool(ApprovalEntityType.MATERIAL_REQUEST, creator);

        expect(mockApprovalAuth.resolveApproverPool).toHaveBeenCalledWith(
          'comp-1',
          'materialRequest.approve',
          null,
        );
        expect(view.entityId).toBeNull();
        expect(view.approvalStatus).toBe(ApprovalStatus.PENDING);
        expect(view.memberCount).toBe(2);
        expect(view.nominations).toEqual([]);
        expect(view.canNominate).toBe(true);
        // No document was read — the pool is a pure function of the company.
        expect(mockPrisma.materialRequest.findUnique).not.toHaveBeenCalled();
      });

      it('excludes the caller — a requester cannot route an MR to themselves (FOR-349)', async () => {
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([
          poMember(creator.id, 'Creator', UserRole.PROCUREMENT_OFFICER),
          poMember('u1', 'Ama Boateng', UserRole.COMPANY_ADMIN),
        ]);

        const view = await service.getProspectivePool(ApprovalEntityType.MATERIAL_REQUEST, creator);

        expect(view.members.map((m) => m.id)).toEqual(['u1']);
        expect(view.memberCount).toBe(1);
      });

      it('flags an empty prospective pool so the wizard can block before submitting', async () => {
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([]);

        const view = await service.getProspectivePool(ApprovalEntityType.MATERIAL_REQUEST, creator);

        expect(view.isEmpty).toBe(true);
      });

      it('rejects a caller with no company (SUPER_ADMIN is never in a pool)', async () => {
        await expect(
          service.getProspectivePool(ApprovalEntityType.MATERIAL_REQUEST, superAdmin),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    describe('once resolved', () => {
      it('names the individual who acted and when', async () => {
        givenPo({
          approvalStatus: ApprovalStatus.APPROVED,
          approvedBy: { id: 'u1', name: 'Ama Boateng' },
        });
        mockPrisma.auditLog.findFirst.mockResolvedValue({
          createdAt: new Date('2026-08-12T09:30:00.000Z'),
        });

        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          creator,
        );

        expect(view.resolvedBy).toEqual({ id: 'u1', name: 'Ama Boateng' });
        expect(view.resolvedAt).toBe('2026-08-12T09:30:00.000Z');
      });

      it('leaves the actor unnamed while still pending', async () => {
        givenPo({ approvedBy: { id: 'u1', name: 'Ama Boateng' } });

        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          creator,
        );

        expect(view.resolvedBy).toBeNull();
        expect(view.resolvedAt).toBeNull();
        expect(mockPrisma.auditLog.findFirst).not.toHaveBeenCalled();
      });

      it('survives a missing audit entry rather than failing the whole read', async () => {
        givenPo({
          approvalStatus: ApprovalStatus.REJECTED,
          approvedBy: { id: 'u1', name: 'Ama Boateng' },
        });
        mockPrisma.auditLog.findFirst.mockResolvedValue(null);

        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          creator,
        );

        expect(view.resolvedAt).toBeNull();
        expect(view.resolvedBy).toEqual({ id: 'u1', name: 'Ama Boateng' });
      });
    });

    describe('nominations', () => {
      const nominationRow = (userId: string, name: string) => ({
        userId,
        nominatedById: creator.id,
        nominatedAt: new Date('2026-08-09T10:00:00.000Z'),
        user: { name, role: UserRole.PROCUREMENT_OFFICER, customRoleId: null, customRole: null },
      });

      it('marks a nominee still in the pool as eligible', async () => {
        givenPo();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([
          poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
        ]);
        mockPrisma.approvalNomination.findMany.mockResolvedValue([
          nominationRow('u1', 'Ama Boateng'),
        ]);

        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          creator,
        );

        expect(view.nominations[0]).toMatchObject({ userId: 'u1', stillEligible: true });
      });

      it('keeps a nominee who fell out of the pool, flagged as no longer eligible', async () => {
        givenPo();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([
          poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
        ]);
        mockPrisma.approvalNomination.findMany.mockResolvedValue([
          nominationRow('u9', 'Yaw Mensah'),
        ]);

        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          creator,
        );

        // The Pool is live; the Nomination is the creator's frozen intent. The
        // row persists so the creator can see why nothing is happening.
        expect(view.nominations).toHaveLength(1);
        expect(view.nominations[0]).toMatchObject({ userId: 'u9', stillEligible: false });
      });
    });

    describe('who may nominate', () => {
      it('allows the creator while the PO is pending', async () => {
        givenPo();
        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          creator,
        );
        expect(view.canNominate).toBe(true);
      });

      it('refuses a pool member who is not the creator — re-nominating each other is deferred', async () => {
        givenPo();
        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          bystander,
        );
        expect(view.canNominate).toBe(false);
      });

      it('refuses the creator once the approval has resolved', async () => {
        givenPo({ approvalStatus: ApprovalStatus.APPROVED, approvedBy: null });
        mockPrisma.auditLog.findFirst.mockResolvedValue(null);
        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          creator,
        );
        expect(view.canNominate).toBe(false);
      });
    });

    describe('tenant scope', () => {
      it('refuses a user from another company', async () => {
        givenPo();
        await expect(
          service.getApproverPool(ApprovalEntityType.PURCHASE_ORDER, 'po-1', otherCompany),
        ).rejects.toThrow(ForbiddenException);
      });

      it('lets SUPER_ADMIN through as break-glass without joining the pool', async () => {
        givenPo();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([
          poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
        ]);

        const view = await service.getApproverPool(
          ApprovalEntityType.PURCHASE_ORDER,
          'po-1',
          superAdmin,
        );

        // Platform-operator identity is never exposed to a tenant: SUPER_ADMIN
        // has a null companyId, so it is never resolved into a Pool.
        expect(view.members.map((m) => m.id)).toEqual(['u1']);
        expect(view.canNominate).toBe(false);
      });

      it('404s on an unknown purchase order', async () => {
        mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
        await expect(
          service.getApproverPool(ApprovalEntityType.PURCHASE_ORDER, 'nope', creator),
        ).rejects.toThrow(NotFoundException);
      });

      it('404s on an unknown invoice', async () => {
        mockPrisma.invoice.findUnique.mockResolvedValue(null);
        await expect(
          service.getApproverPool(ApprovalEntityType.INVOICE, 'nope', creator),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ── Nomination (FOR-306 / FOR-308) ───────────────────────────────────────

  const POOL = [
    poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
    poMember('u2', 'Kojo Owusu', UserRole.PROCUREMENT_OFFICER),
  ];

  describe('assertNomineesInPool', () => {
    it('accepts pool members', async () => {
      await expect(
        service.assertNomineesInPool('comp-1', POOL, ['u1', 'u2']),
      ).resolves.toBeUndefined();
    });

    it('rejects anyone outside the pool — nomination narrows, never widens', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ name: 'Yaw Mensah' });

      // The picker is a convenience; this server-side check is the control.
      await expect(service.assertNomineesInPool('comp-1', POOL, ['u1', 'u9'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('names the rejected user when they belong to the company', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ name: 'Yaw Mensah' });

      await expect(service.assertNomineesInPool('comp-1', POOL, ['u9'])).rejects.toThrow(
        /Yaw Mensah/,
      );

      // Company-scoped, so a bad id cannot be used to probe other tenants.
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['u9'] }, companyId: 'comp-1' } }),
      );
    });

    it('still rejects an id that matches nobody at all', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.assertNomineesInPool('comp-1', POOL, ['ghost'])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('recordNominationsAtSubmit', () => {
    it('persists the chosen members and reports them as the ones to notify', async () => {
      const notify = await service.recordNominationsAtSubmit(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        'comp-1',
        POOL,
        ['u1'],
        creator.id,
      );

      expect(mockPrisma.approvalNomination.createMany).toHaveBeenCalledWith({
        data: [
          {
            entityType: ApprovalEntityType.PURCHASE_ORDER,
            entityId: 'po-1',
            userId: 'u1',
            nominatedById: creator.id,
            companyId: 'comp-1',
          },
        ],
        skipDuplicates: true,
      });
      expect(notify.map((m) => m.id)).toEqual(['u1']);
    });

    it('writes nothing when nobody was nominated — that means "notify everyone"', async () => {
      const notify = await service.recordNominationsAtSubmit(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        'comp-1',
        POOL,
        [],
        creator.id,
      );

      expect(mockPrisma.approvalNomination.createMany).not.toHaveBeenCalled();
      expect(notify).toEqual([]);
    });

    it('does not re-notify someone already nominated', async () => {
      mockPrisma.approvalNomination.findMany.mockResolvedValue([{ userId: 'u1' }]);

      const notify = await service.recordNominationsAtSubmit(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        'comp-1',
        POOL,
        ['u1', 'u2'],
        creator.id,
      );

      // u1 was already asked; only u2 is new, so only u2 gets an email.
      expect(notify.map((m) => m.id)).toEqual(['u2']);
      expect(mockPrisma.approvalNomination.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [expect.objectContaining({ userId: 'u2' })] }),
      );
    });

    it('is a complete no-op when every nominee was already asked', async () => {
      mockPrisma.approvalNomination.findMany.mockResolvedValue([{ userId: 'u1' }]);

      const notify = await service.recordNominationsAtSubmit(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        'comp-1',
        POOL,
        ['u1'],
        creator.id,
      );

      expect(notify).toEqual([]);
      expect(mockPrisma.approvalNomination.createMany).not.toHaveBeenCalled();
    });

    it('deduplicates a repeated id in one request', async () => {
      await service.recordNominationsAtSubmit(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        'comp-1',
        POOL,
        ['u1', 'u1'],
        creator.id,
      );

      expect(mockPrisma.approvalNomination.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [expect.objectContaining({ userId: 'u1' })] }),
      );
    });
  });

  describe('addNominations (FOR-308)', () => {
    beforeEach(() => {
      givenPo();
      mockApprovalAuth.resolveApproverPool.mockResolvedValue(POOL);
    });

    it('lets the creator ask another pool member', async () => {
      const { notify } = await service.addNominations(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        ['u2'],
        creator,
      );
      expect(notify.map((m) => m.id)).toEqual(['u2']);
    });

    it('refuses a pool member who is not the creator', async () => {
      // Pool members re-nominating each other is deferred in the ADR amendment.
      await expect(
        service.addNominations(ApprovalEntityType.PURCHASE_ORDER, 'po-1', ['u2'], bystander),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.approvalNomination.createMany).not.toHaveBeenCalled();
    });

    it('refuses once the approval has already resolved', async () => {
      givenPo({ approvalStatus: ApprovalStatus.APPROVED });
      await expect(
        service.addNominations(ApprovalEntityType.PURCHASE_ORDER, 'po-1', ['u2'], creator),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a nominee outside the pool, server-side', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ name: 'Yaw Mensah' });
      await expect(
        service.addNominations(ApprovalEntityType.PURCHASE_ORDER, 'po-1', ['u9'], creator),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a requester nominating themselves on their own MR (FOR-349)', async () => {
      givenMr();
      mockApprovalAuth.resolveApproverPool.mockResolvedValue([
        poMember(creator.id, 'Creator', UserRole.PROCUREMENT_OFFICER),
        poMember('u1', 'Ama Boateng', UserRole.PROCUREMENT_OFFICER),
      ]);
      // Holding the grant does not put them in their own Pool, so this is the
      // ordinary outside-the-Pool 400 — no special case.
      await expect(
        service.addNominations(ApprovalEntityType.MATERIAL_REQUEST, 'mr-1', [creator.id], creator),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.approvalNomination.createMany).not.toHaveBeenCalled();
    });
  });

  describe('withdrawNomination (FOR-308)', () => {
    beforeEach(() => {
      givenPo();
      mockApprovalAuth.resolveApproverPool.mockResolvedValue(POOL);
    });

    it('removes the routing hint without touching the pool', async () => {
      const view = await service.withdrawNomination(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        'u1',
        creator,
      );

      expect(mockPrisma.approvalNomination.deleteMany).toHaveBeenCalledWith({
        where: { entityType: ApprovalEntityType.PURCHASE_ORDER, entityId: 'po-1', userId: 'u1' },
      });
      // Authority is untouched: the withdrawn user is still in the Pool and the
      // PO stays in their dashboard queue, so this can never strand it.
      expect(view.members.map((m) => m.id)).toEqual(['u1', 'u2']);
    });

    it('404s when there was no such nomination', async () => {
      mockPrisma.approvalNomination.deleteMany.mockResolvedValue({ count: 0 });
      await expect(
        service.withdrawNomination(ApprovalEntityType.PURCHASE_ORDER, 'po-1', 'u1', creator),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses a non-creator', async () => {
      await expect(
        service.withdrawNomination(ApprovalEntityType.PURCHASE_ORDER, 'po-1', 'u1', bystander),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolveNotificationTargets', () => {
    it('notifies the whole pool when nobody was nominated', async () => {
      mockPrisma.approvalNomination.findMany.mockResolvedValue([]);

      const targets = await service.resolveNotificationTargets(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        POOL,
      );

      // Nominating nobody must reproduce the pre-nomination broadcast exactly.
      expect(targets).toEqual(POOL);
    });

    it('narrows to the nominees when there are some', async () => {
      mockPrisma.approvalNomination.findMany.mockResolvedValue([{ userId: 'u2' }]);

      const targets = await service.resolveNotificationTargets(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        POOL,
      );

      expect(targets.map((m) => m.id)).toEqual(['u2']);
    });

    it('falls back to the whole pool when every nominee has dropped out of it', async () => {
      mockPrisma.approvalNomination.findMany.mockResolvedValue([{ userId: 'u9' }]);

      const targets = await service.resolveNotificationTargets(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        POOL,
      );

      // Emailing nobody would silence a request that still needs approving; a
      // stale intent must not be able to do that.
      expect(targets).toEqual(POOL);
    });

    it('notifies nobody when the pool itself is empty', async () => {
      const targets = await service.resolveNotificationTargets(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        [],
      );
      expect(targets).toEqual([]);
    });
  });

  describe('deleteNominationsFor', () => {
    it('clears the polymorphic rows the database cannot cascade', async () => {
      await service.deleteNominationsFor(ApprovalEntityType.INVOICE, 'inv-1');
      expect(mockPrisma.approvalNomination.deleteMany).toHaveBeenCalledWith({
        where: { entityType: ApprovalEntityType.INVOICE, entityId: 'inv-1' },
      });
    });
  });
});
