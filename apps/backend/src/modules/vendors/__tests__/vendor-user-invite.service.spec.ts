import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import { VendorUserInviteService } from '../vendor-user-invite.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockEmailService = {
  sendVendorInvitationEmail: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:3001'),
};

const mockAuditService = {
  log: jest.fn(),
};

const vendorUser = {
  id: 'vu-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
  companyId: 'vendor-comp-1',
};

describe('VendorUserInviteService', () => {
  let service: VendorUserInviteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VendorUserInviteService(
      mockPrisma as never,
      mockEmailService as never,
      mockConfigService as never,
      mockAuditService as never,
    );
  });

  describe('inviteVendorUser', () => {
    it('throws ForbiddenException when user is not a vendor', async () => {
      const adminUser = { ...vendorUser, role: UserRole.COMPANY_ADMIN };
      await expect(
        service.inviteVendorUser(
          'vendor-comp-1',
          { name: 'New', email: 'new@v.com', position: 'Sales' },
          adminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when vendor user belongs to different company', async () => {
      await expect(
        service.inviteVendorUser(
          'other-comp',
          { name: 'New', email: 'new@v.com', position: 'Sales' },
          vendorUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when email already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.inviteVendorUser(
          'vendor-comp-1',
          { name: 'New', email: 'existing@v.com', position: 'Sales' },
          vendorUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user, sends email, and logs audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-u-1',
        name: 'New User',
        email: 'new@v.com',
        position: 'Sales',
        status: UserStatus.INVITED,
      });

      const result = await service.inviteVendorUser(
        'vendor-comp-1',
        { name: 'New User', email: 'new@v.com', position: 'Sales' },
        vendorUser,
      );

      expect(result.id).toBe('new-u-1');
      expect(result.status).toBe('INVITED');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New User',
            email: 'new@v.com',
            role: UserRole.VENDOR,
            status: UserStatus.INVITED,
            companyId: 'vendor-comp-1',
          }),
        }),
      );
      expect(mockEmailService.sendVendorInvitationEmail).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VENDOR_USER_INVITED',
          performedById: 'vu-1',
          targetId: 'new-u-1',
        }),
      );
    });
  });

  describe('resendInvitation', () => {
    it('throws ForbiddenException when vendor user belongs to different company', async () => {
      await expect(service.resendInvitation('other-comp', 'u-1', vendorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when target user not found or not INVITED', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resendInvitation('vendor-comp-1', 'missing', vendorUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('regenerates token and resends email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        email: 'invited@v.com',
        name: 'Invited User',
        status: UserStatus.INVITED,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.resendInvitation('vendor-comp-1', 'u-1', vendorUser);
      expect(result.message).toBe('Invitation resent successfully');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: expect.objectContaining({
            invitationToken: expect.any(String),
            invitationTokenExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mockEmailService.sendVendorInvitationEmail).toHaveBeenCalledWith(
        'invited@v.com',
        expect.stringContaining('activate?token='),
        'Invited User',
      );
    });
  });

  describe('cancelInvitation', () => {
    it('throws ForbiddenException when vendor user belongs to different company', async () => {
      await expect(service.cancelInvitation('other-comp', 'u-1', vendorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when target user not found or not INVITED', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.cancelInvitation('vendor-comp-1', 'missing', vendorUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes the invited user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.INVITED,
      });
      mockPrisma.user.delete.mockResolvedValue({});

      const result = await service.cancelInvitation('vendor-comp-1', 'u-1', vendorUser);
      expect(result.message).toBe('Invitation cancelled successfully');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
    });
  });
});
