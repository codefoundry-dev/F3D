/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-value'),
  verify: jest.fn().mockResolvedValue(true),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-hex-token'),
  }),
}));

import { UserListQueryDto, UsersService } from './users.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
  },
  emailVerification: {
    deleteMany: jest.fn(),
  },
  companyVendorAssignment: {
    findFirst: jest.fn(),
  },
  rolePermission: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  $transaction: jest.fn(),
};
mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
  fn(mockPrisma),
);

const mockEmailService = {
  sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
  sendDeactivationEmail: jest.fn().mockResolvedValue(undefined),
  sendReactivationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('http://localhost:3001'),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockPermissionsService = {
  getPermissionsForRole: jest.fn().mockResolvedValue(new Set<string>()),
  roleHasPermission: jest.fn().mockResolvedValue(true),
};

const superAdmin = { id: 'sa-1', role: UserRole.SUPER_ADMIN, companyId: null };
const companyAdmin = { id: 'ca-1', role: UserRole.COMPANY_ADMIN, companyId: 'comp-1' };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      mockPrisma as never,
      mockEmailService as never,
      mockConfig as never,
      mockAuditService as never,
      mockPermissionsService as never,
    );
  });

  // ── listUsers ──────────────────────────────────────────────────────────

  describe('listUsers', () => {
    beforeEach(() => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);
    });

    it('SuperAdmin sees all users (no companyId filter)', async () => {
      await service.listUsers({}, superAdmin);
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('companyId');
    });

    it('CompanyAdmin scopes to own company', async () => {
      await service.listUsers({}, companyAdmin);
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.companyId).toBe('comp-1');
    });

    it('applies search filter to name and email', async () => {
      await service.listUsers({ search: 'john' }, superAdmin);
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual([
        { name: { contains: 'john', mode: 'insensitive' } },
        { email: { contains: 'john', mode: 'insensitive' } },
      ]);
    });

    it('applies pagination correctly', async () => {
      await service.listUsers({ page: 2, limit: 10 }, superAdmin);
      const call = mockPrisma.user.findMany.mock.calls[0][0];
      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
    });

    it('caps limit at 100', async () => {
      await service.listUsers({ limit: 200 }, superAdmin);
      const call = mockPrisma.user.findMany.mock.calls[0][0];
      expect(call.take).toBe(100);
    });

    it('applies sorting with valid field', async () => {
      await service.listUsers({ sortBy: 'name', sortDir: 'asc' }, superAdmin);
      const call = mockPrisma.user.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ name: 'asc' });
    });

    it('falls back to createdAt for invalid sortBy', async () => {
      await service.listUsers({ sortBy: 'invalid' }, superAdmin);
      const call = mockPrisma.user.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('maps dateJoined alias to createdAt', async () => {
      await service.listUsers({ sortBy: 'dateJoined', sortDir: 'asc' }, superAdmin);
      const call = mockPrisma.user.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'asc' });
    });

    it('filters by role', async () => {
      await service.listUsers({ role: UserRole.COMPANY_ADMIN }, superAdmin);
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.role).toBe(UserRole.COMPANY_ADMIN);
    });

    it('filters by multiple roles', async () => {
      await service.listUsers(
        { role: [UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER] },
        superAdmin,
      );
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.role).toEqual({ in: [UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER] });
    });

    it('filters by status string', async () => {
      await service.listUsers({ status: 'ACTIVE' }, superAdmin);
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe('ACTIVE');
    });

    it('filters by multiple comma-separated statuses', async () => {
      await service.listUsers({ status: 'ACTIVE,INVITED' }, superAdmin);
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toEqual({ in: ['ACTIVE', 'INVITED'] });
    });

    it('SuperAdmin can filter by companyId query param', async () => {
      await service.listUsers({ companyId: 'comp-2' }, superAdmin);
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.companyId).toBe('comp-2');
    });

    it('SuperAdmin can filter by multiple comma-separated companyIds', async () => {
      await service.listUsers({ companyId: 'comp-1,comp-2' }, superAdmin);
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.companyId).toEqual({ in: ['comp-1', 'comp-2'] });
    });

    it('returns meta with totalPages', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.user.count.mockResolvedValue(50);
      const result = await service.listUsers({ page: 1, limit: 25 }, superAdmin);
      expect(result.meta).toEqual({ page: 1, limit: 25, total: 50, totalPages: 2 });
    });
  });

  // ── createUser ─────────────────────────────────────────────────────────

  describe('createUser', () => {
    const dto = {
      name: 'New User',
      email: 'new@example.com',
      role: UserRole.PROCUREMENT_OFFICER,
      companyId: 'comp-1',
    };

    const createdUser = { id: 'u-new', ...dto, status: UserStatus.INVITED };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      mockPrisma.user.create.mockResolvedValue(createdUser);
    });

    it('creates a user and sends invitation email', async () => {
      const result = await service.createUser(dto, companyAdmin);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        'new@example.com',
        expect.stringContaining('/activate?token='),
        'New User',
      );
      expect(mockAuditService.log).toHaveBeenCalled();
      expect(result).toEqual(createdUser);
    });

    it('CompanyAdmin cannot create users for other companies', async () => {
      await expect(
        service.createUser({ ...dto, companyId: 'comp-other' }, companyAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('CompanyAdmin cannot assign SuperAdmin role', async () => {
      await expect(
        service.createUser({ ...dto, role: UserRole.SUPER_ADMIN }, companyAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.createUser(dto, companyAdmin)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when company not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.company.findUnique.mockResolvedValue(null);
      await expect(service.createUser(dto, companyAdmin)).rejects.toThrow(NotFoundException);
    });

    it('SuperAdmin can create user for any company', async () => {
      const result = await service.createUser({ ...dto, companyId: 'comp-other' }, superAdmin);
      expect(result).toEqual(createdUser);
    });

    it('SuperAdmin can create another SuperAdmin without a company', async () => {
      const { companyId: _omitted, ...noCompanyDto } = dto;
      const result = await service.createUser(
        { ...noCompanyDto, role: UserRole.SUPER_ADMIN },
        superAdmin,
      );

      // No company lookup is attempted, and the user is created company-less.
      expect(mockPrisma.company.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: UserRole.SUPER_ADMIN, companyId: null }),
        }),
      );
      expect(result).toEqual(createdUser);
    });

    it('throws BadRequestException when a non-SuperAdmin role is created without a company', async () => {
      const { companyId: _omitted, ...noCompanyDto } = dto;
      await expect(service.createUser(noCompanyDto, superAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('non-SuperAdmin cannot assign the SuperAdmin role', async () => {
      const { companyId: _omitted, ...noCompanyDto } = dto;
      await expect(
        service.createUser({ ...noCompanyDto, role: UserRole.SUPER_ADMIN }, companyAdmin),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── getUser ────────────────────────────────────────────────────────────

  describe('getUser', () => {
    const userRecord = {
      id: 'u-1',
      companyId: 'comp-1',
      role: UserRole.PROCUREMENT_OFFICER,
      projectMemberships: [{ project: { id: 'p-1', name: 'Project 1' } }],
    };

    it('returns user with projects array', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRecord);
      const result = await service.getUser('u-1', companyAdmin);
      expect(result.projects).toEqual([{ id: 'p-1', name: 'Project 1' }]);
      expect(result.projectMemberships).toBeUndefined();
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUser('bad-id', companyAdmin)).rejects.toThrow(NotFoundException);
    });

    it('CompanyAdmin cannot access user from another company (non-vendor)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userRecord,
        companyId: 'comp-other',
      });
      mockPrisma.companyVendorAssignment.findFirst.mockResolvedValue(null);
      await expect(service.getUser('u-1', companyAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('SuperAdmin can access any user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userRecord,
        companyId: 'comp-other',
      });
      const result = await service.getUser('u-1', superAdmin);
      expect(result).toBeDefined();
    });
  });

  // ── updateUser ─────────────────────────────────────────────────────────

  describe('updateUser', () => {
    const userRecord = {
      id: 'u-1',
      companyId: 'comp-1',
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      projectMemberships: [],
    };

    it('updates user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRecord);
      mockPrisma.user.update.mockResolvedValue({ ...userRecord, name: 'Updated' });

      const result = await service.updateUser('u-1', { name: 'Updated' }, companyAdmin);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { name: 'Updated' },
        select: expect.any(Object),
      });
      expect(result).toBeDefined();
    });

    it('throws when demoting sole CompanyAdmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRecord);
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        service.updateUser('u-1', { role: UserRole.PROCUREMENT_OFFICER }, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows role change when multiple admins exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRecord);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.user.update.mockResolvedValue({
        ...userRecord,
        role: UserRole.PROCUREMENT_OFFICER,
      });

      await expect(
        service.updateUser('u-1', { role: UserRole.PROCUREMENT_OFFICER }, companyAdmin),
      ).resolves.toBeDefined();
    });
  });

  // ── deactivateUser ─────────────────────────────────────────────────────

  describe('deactivateUser', () => {
    const activeUser = {
      id: 'u-1',
      companyId: 'comp-1',
      role: UserRole.PROCUREMENT_OFFICER,
      status: UserStatus.ACTIVE,
      projectMemberships: [],
    };

    it('deactivates an active user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockPrisma.user.update.mockResolvedValue({
        ...activeUser,
        status: UserStatus.INACTIVE,
        email: 'user@test.com',
        name: 'Test',
      });

      const result = await service.deactivateUser('u-1', companyAdmin);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: UserStatus.INACTIVE, refreshTokenHash: null }),
        }),
      );
      expect(mockEmailService.sendDeactivationEmail).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws when user is already inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        status: UserStatus.INACTIVE,
      });

      await expect(service.deactivateUser('u-1', companyAdmin)).rejects.toThrow(
        'User is already inactive',
      );
    });

    it('throws when deactivating sole CompanyAdmin', async () => {
      const adminUser = { ...activeUser, role: UserRole.COMPANY_ADMIN };
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(service.deactivateUser('u-1', companyAdmin)).rejects.toThrow(
        'Cannot deactivate the last Company Admin',
      );
    });

    it('allows deactivating CompanyAdmin when multiple admins exist', async () => {
      const adminUser = { ...activeUser, role: UserRole.COMPANY_ADMIN };
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.user.update.mockResolvedValue({
        ...adminUser,
        status: UserStatus.INACTIVE,
        email: 'admin@test.com',
        name: 'Admin',
      });

      await expect(service.deactivateUser('u-1', companyAdmin)).resolves.toBeDefined();
    });
  });

  // ── reactivateUser ─────────────────────────────────────────────────────

  describe('reactivateUser', () => {
    it('reactivates an inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.INACTIVE,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.ACTIVE,
        email: 'user@test.com',
        name: 'Test',
      });

      const result = await service.reactivateUser('u-1');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: UserStatus.ACTIVE, deactivatedAt: null },
        }),
      );
      expect(mockEmailService.sendReactivationEmail).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.reactivateUser('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws when user is not inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.ACTIVE,
      });
      await expect(service.reactivateUser('u-1')).rejects.toThrow('User is not inactive');
    });
  });

  // ── resendInvitation ───────────────────────────────────────────────────

  describe('resendInvitation', () => {
    it('resends invitation for an invited user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'invited@test.com',
        name: 'INVITED',
        status: UserStatus.INVITED,
        role: UserRole.PROCUREMENT_OFFICER,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.resendInvitation('u-1');
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        'invited@test.com',
        expect.stringContaining('/activate?token='),
        'INVITED',
      );
      expect(result).toEqual({ message: 'Invitation resent successfully' });
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resendInvitation('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws when user is not in Invited status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.ACTIVE,
      });
      await expect(service.resendInvitation('u-1')).rejects.toThrow(
        'User has already activated their account',
      );
    });
  });

  // ── initiateResetPassword ──────────────────────────────────────────────

  describe('initiateResetPassword', () => {
    it('sends password reset email for an active user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'user@test.com',
        name: 'User',
        status: UserStatus.ACTIVE,
        role: UserRole.PROCUREMENT_OFFICER,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.initiateResetPassword('u-1');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordResetToken: 'hashed-value',
          }),
        }),
      );
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@test.com',
        expect.stringContaining('/reset-password?token='),
        'User',
      );
      expect(result).toEqual({ message: 'Password reset email sent successfully' });
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.initiateResetPassword('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws when user is not active', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.INACTIVE,
      });
      await expect(service.initiateResetPassword('u-1')).rejects.toThrow(
        'Can only reset password for active users',
      );
    });
  });

  // ── cancelInvitation ───────────────────────────────────────────────────

  describe('cancelInvitation', () => {
    it('disconnects from company and deletes the user in a transaction when status is Invited', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.INVITED,
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.emailVerification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.delete.mockResolvedValue({});

      const result = await service.cancelInvitation('u-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { companyId: null, invitedByUserId: null },
      });
      expect(mockPrisma.emailVerification.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u-1' },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
      expect(result).toEqual({ message: 'Invitation cancelled and user removed' });
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.cancelInvitation('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws when user is Active', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.ACTIVE,
      });
      await expect(service.cancelInvitation('u-1')).rejects.toThrow(
        'Cannot cancel invitation for an active or inactive user',
      );
    });

    it('throws when user is Inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.INACTIVE,
      });
      await expect(service.cancelInvitation('u-1')).rejects.toThrow(
        'Cannot cancel invitation for an active or inactive user',
      );
    });
  });

  // ── getMe ──────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('returns the user with the permission keys granted to their role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        name: 'Me',
        role: UserRole.COMPANY_ADMIN,
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValueOnce(
        new Set(['rfq.create', 'po.approve']),
      );
      mockPrisma.rolePermission.findFirst.mockResolvedValueOnce({ thresholdAmount: null });

      const result = await service.getMe('u-1');

      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        UserRole.COMPANY_ADMIN,
      );
      expect(result).toEqual({
        id: 'u-1',
        name: 'Me',
        role: UserRole.COMPANY_ADMIN,
        permissions: ['rfq.create', 'po.approve'],
        poApprovalThreshold: null,
      });
    });

    it('exposes the numeric po.approve threshold for a capped role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-2',
        name: 'PO',
        role: UserRole.PROCUREMENT_OFFICER,
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValueOnce(new Set(['po.approve']));
      mockPrisma.rolePermission.findFirst.mockResolvedValueOnce({ thresholdAmount: 25000 });

      const result = await service.getMe('u-2');
      expect(result.poApprovalThreshold).toBe(25000);
    });

    it('returns 0 when the role lacks the po.approve grant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-3',
        name: 'NoApprove',
        role: UserRole.PROCUREMENT_OFFICER,
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValueOnce(new Set<string>());
      mockPrisma.rolePermission.findFirst.mockResolvedValueOnce(null);

      const result = await service.getMe('u-3');
      expect(result.poApprovalThreshold).toBe(0);
    });

    it('returns null (unlimited) for SUPER_ADMIN without a rolePermission lookup', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-4',
        name: 'Root',
        role: UserRole.SUPER_ADMIN,
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValueOnce(new Set<string>());

      const result = await service.getMe('u-4');
      expect(result.poApprovalThreshold).toBeNull();
      expect(mockPrisma.rolePermission.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateMe ───────────────────────────────────────────────────────────

  describe('updateMe', () => {
    it('updates and returns the user', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u-1', name: 'Updated' });
      const result = await service.updateMe('u-1', { name: 'Updated' });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { name: 'Updated' },
        select: expect.any(Object),
      });
      expect(result).toEqual({ id: 'u-1', name: 'Updated' });
    });
  });

  // ── changePassword ─────────────────────────────────────────────────────

  describe('changePassword', () => {
    const argon2 = jest.requireMock('argon2');

    it('changes password when current password is correct', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: 'old-hash' });
      argon2.verify.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.changePassword('u-1', {
        currentPassword: 'old',
        newPassword: 'newpass12',
      });

      expect(argon2.verify).toHaveBeenCalledWith('old-hash', 'old');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { passwordHash: 'hashed-value', refreshTokenHash: null },
        }),
      );
      expect(result.message).toContain('Password changed');
    });

    it('throws when no password is set on account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: null });
      await expect(
        service.changePassword('u-1', { currentPassword: 'old', newPassword: 'new12345' }),
      ).rejects.toThrow('No password set on account');
    });

    it('throws when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.changePassword('u-1', { currentPassword: 'old', newPassword: 'new12345' }),
      ).rejects.toThrow('No password set on account');
    });

    it('throws when current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: 'hash' });
      argon2.verify.mockResolvedValue(false);

      await expect(
        service.changePassword('u-1', { currentPassword: 'wrong', newPassword: 'new12345' }),
      ).rejects.toThrow('Current password is incorrect');
    });
  });
});

// ── UserListQueryDto Transform tests ──────────────────────────────────────────

describe('UserListQueryDto transforms', () => {
  it('parses page string to number', () => {
    const dto = plainToInstance(UserListQueryDto, { page: '3' });
    expect(dto.page).toBe(3);
  });

  it('parses limit string to number', () => {
    const dto = plainToInstance(UserListQueryDto, { limit: '50' });
    expect(dto.limit).toBe(50);
  });

  it('splits comma-separated role string into array', () => {
    const dto = plainToInstance(UserListQueryDto, {
      role: 'COMPANY_ADMIN,PROCUREMENT_OFFICER',
    });
    expect(dto.role).toEqual(['COMPANY_ADMIN', 'PROCUREMENT_OFFICER']);
  });

  it('keeps single role string as-is', () => {
    const dto = plainToInstance(UserListQueryDto, { role: 'COMPANY_ADMIN' });
    expect(dto.role).toBe('COMPANY_ADMIN');
  });
});
