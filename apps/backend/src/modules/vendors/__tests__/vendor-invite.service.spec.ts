import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { VendorInviteService } from '../vendor-invite.service';

const mockPrisma = {
  company: { findFirst: jest.fn() },
  companyVendorAssignment: { findUnique: jest.fn(), create: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};

const mockEmailService = {
  sendVendorInvitationEmail: jest.fn(),
  sendVendorCompanyInvitationEmail: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('http://vendor-app.test'),
};

const mockAuditService = {
  log: jest.fn(),
};

const companyAdmin = { id: 'ca-1', role: UserRole.COMPANY_ADMIN, companyId: 'comp-1' };

const baseDto = {
  companyName: 'VendorCo',
  companyEmail: 'vendor@co.com',
  userName: 'Vendor User',
  userEmail: 'user@vendor.com',
};

describe('VendorInviteService', () => {
  let service: VendorInviteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VendorInviteService(
      mockPrisma as never,
      mockEmailService as never,
      mockConfig as never,
      mockAuditService as never,
    );
  });

  it('throws BadRequestException when user has no companyId', async () => {
    await expect(
      service.inviteVendor(baseDto as never, { ...companyAdmin, companyId: null }),
    ).rejects.toThrow(BadRequestException);
  });

  it('adds existing vendor to contractor list and creates new user, returns alreadyExisted=true', async () => {
    mockPrisma.company.findFirst.mockResolvedValue({
      id: 'existing-v',
      legalName: 'VendorCo',
      users: [{ id: 'u-1', status: 'ACTIVE', name: 'V' }],
    });
    mockPrisma.companyVendorAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.companyVendorAssignment.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'new-u' });
    mockEmailService.sendVendorInvitationEmail.mockResolvedValue(undefined);
    mockAuditService.log.mockResolvedValue(undefined);

    const result = await service.inviteVendor(baseDto as never, companyAdmin);
    expect(result.alreadyExisted).toBe(true);
    expect(result.vendorCompanyId).toBe('existing-v');
    expect(mockPrisma.companyVendorAssignment.create).toHaveBeenCalled();
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'user@vendor.com', companyId: 'existing-v' }),
      }),
    );
    expect(mockEmailService.sendVendorInvitationEmail).toHaveBeenCalled();
  });

  it('creates new user for already-assigned vendor company', async () => {
    mockPrisma.company.findFirst.mockResolvedValue({
      id: 'existing-v',
      legalName: 'VendorCo',
      users: [],
    });
    mockPrisma.companyVendorAssignment.findUnique.mockResolvedValue({ id: 'assign-1' });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'new-u' });
    mockEmailService.sendVendorInvitationEmail.mockResolvedValue(undefined);
    mockAuditService.log.mockResolvedValue(undefined);

    const result = await service.inviteVendor(baseDto as never, companyAdmin);
    expect(result.alreadyExisted).toBe(true);
    expect(result.vendorCompanyId).toBe('existing-v');
    // Should NOT create a new assignment since it already exists
    expect(mockPrisma.companyVendorAssignment.create).not.toHaveBeenCalled();
    // Should create a new user
    expect(mockPrisma.user.create).toHaveBeenCalled();
  });

  it('throws ConflictException when inviting with existing user email to existing vendor', async () => {
    mockPrisma.company.findFirst.mockResolvedValue({
      id: 'existing-v',
      legalName: 'VendorCo',
      users: [],
    });
    mockPrisma.companyVendorAssignment.findUnique.mockResolvedValue({ id: 'assign-1' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u-existing' });

    await expect(service.inviteVendor(baseDto as never, companyAdmin)).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws ConflictException when user email already exists', async () => {
    mockPrisma.company.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u-existing' });

    await expect(service.inviteVendor(baseDto as never, companyAdmin)).rejects.toThrow(
      ConflictException,
    );
  });

  it('creates new vendor company and user via transaction', async () => {
    mockPrisma.company.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        company: { create: jest.fn().mockResolvedValue({ id: 'new-v', legalName: 'VendorCo' }) },
        user: { create: jest.fn().mockResolvedValue({ id: 'new-u' }) },
        companyVendorAssignment: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    mockEmailService.sendVendorInvitationEmail.mockResolvedValue(undefined);
    mockAuditService.log.mockResolvedValue(undefined);

    const result = await service.inviteVendor(baseDto as never, companyAdmin);
    expect(result.alreadyExisted).toBe(false);
    expect(result.vendorCompanyId).toBe('new-v');
    expect(mockEmailService.sendVendorInvitationEmail).toHaveBeenCalledWith(
      'user@vendor.com',
      expect.stringContaining('/activate?token='),
      'Vendor User',
    );
    expect(mockAuditService.log).toHaveBeenCalled();
  });

  it('sends company email when different from user email', async () => {
    mockPrisma.company.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        company: { create: jest.fn().mockResolvedValue({ id: 'new-v', legalName: 'VendorCo' }) },
        user: { create: jest.fn().mockResolvedValue({ id: 'new-u' }) },
        companyVendorAssignment: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    mockEmailService.sendVendorInvitationEmail.mockResolvedValue(undefined);
    mockEmailService.sendVendorCompanyInvitationEmail.mockResolvedValue(undefined);
    mockAuditService.log.mockResolvedValue(undefined);

    await service.inviteVendor(baseDto as never, companyAdmin);
    expect(mockEmailService.sendVendorCompanyInvitationEmail).toHaveBeenCalledWith('vendor@co.com');
  });

  it('does not send company email when same as user email', async () => {
    mockPrisma.company.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        company: { create: jest.fn().mockResolvedValue({ id: 'new-v', legalName: 'VendorCo' }) },
        user: { create: jest.fn().mockResolvedValue({ id: 'new-u' }) },
        companyVendorAssignment: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    mockEmailService.sendVendorInvitationEmail.mockResolvedValue(undefined);
    mockAuditService.log.mockResolvedValue(undefined);

    const sameEmailDto = { ...baseDto, companyEmail: 'user@vendor.com' };
    await service.inviteVendor(sameEmailDto as never, companyAdmin);
    expect(mockEmailService.sendVendorCompanyInvitationEmail).not.toHaveBeenCalled();
  });
});
