import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ProjectAccessGuard } from './project-access.guard';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockContext(
  user: Record<string, unknown>,
  params: Record<string, string> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  } as unknown as ExecutionContext;
}

const mockPrisma = {
  project: { findUnique: jest.fn() },
  projectMember: { findUnique: jest.fn() },
};

describe('ProjectAccessGuard', () => {
  let guard: ProjectAccessGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ProjectAccessGuard(mockPrisma as never);
  });

  it('returns true when no projectId param (list endpoints)', async () => {
    const ctx = createMockContext(
      { id: 'u-1', role: UserRole.PROCUREMENT_OFFICER, companyId: 'comp-1' },
      {},
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('SuperAdmin bypasses all access checks', async () => {
    const ctx = createMockContext(
      { id: 'sa-1', role: UserRole.SUPER_ADMIN, companyId: null },
      { id: 'p-1' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const ctx = createMockContext(
      { id: 'ca-1', role: UserRole.COMPANY_ADMIN, companyId: 'comp-1' },
      { id: 'p-1' },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('CompanyAdmin can access project in same company', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ companyId: 'comp-1' });
    const ctx = createMockContext(
      { id: 'ca-1', role: UserRole.COMPANY_ADMIN, companyId: 'comp-1' },
      { id: 'p-1' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockPrisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('CompanyAdmin denied for project in different company', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ companyId: 'comp-other' });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);
    const ctx = createMockContext(
      { id: 'ca-1', role: UserRole.COMPANY_ADMIN, companyId: 'comp-1' },
      { id: 'p-1' },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('other role with membership is granted access', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ companyId: 'comp-1' });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ userId: 'po-1', projectId: 'p-1' });
    const ctx = createMockContext(
      { id: 'po-1', role: UserRole.PROCUREMENT_OFFICER, companyId: 'comp-1' },
      { id: 'p-1' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('other role without membership is denied', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ companyId: 'comp-1' });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);
    const ctx = createMockContext(
      { id: 'po-1', role: UserRole.PROCUREMENT_OFFICER, companyId: 'comp-1' },
      { id: 'p-1' },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
