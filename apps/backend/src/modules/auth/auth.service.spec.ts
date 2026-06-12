import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';

import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

jest.mock('argon2');

const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: { sign: jest.Mock; signAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let otpService: { generateAndStore: jest.Mock; verifyOtp: jest.Mock };
  let emailService: {
    sendOtpEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
    sendInvitationExpiredNotification: jest.Mock;
  };

  const activeUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    role: UserRole.PROCUREMENT_OFFICER,
    status: UserStatus.ACTIVE,
    companyId: 'company-1',
    passwordHash: 'hashed-password',
    refreshTokenHash: 'hashed-refresh',
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    invitationToken: null,
    invitationTokenExpiresAt: null,
    invitedBy: null,
    invitedById: null,
    lastLoginAt: null,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('access-token'),
      signAsync: jest.fn().mockResolvedValue('async-token'),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_REFRESH_EXPIRES_IN: '7d',
          APP_URL: 'http://localhost:3001',
        };
        return map[key] ?? defaultValue;
      }),
    };

    otpService = {
      generateAndStore: jest.fn(),
      verifyOtp: jest.fn(),
    };

    emailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendInvitationExpiredNotification: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      otpService as unknown as OtpService,
      emailService as unknown as EmailService,
    );

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should generate and send OTP for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      mockedArgon2.verify.mockResolvedValue(true);
      const expiresAt = new Date('2026-03-05T12:10:00Z');
      otpService.generateAndStore.mockResolvedValue({ otp: '123456', expiresAt });
      emailService.sendOtpEmail.mockResolvedValue(undefined);

      const result = await service.login('user@example.com', 'password123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
      expect(mockedArgon2.verify).toHaveBeenCalledWith('hashed-password', 'password123');
      expect(otpService.generateAndStore).toHaveBeenCalledWith('user-1');
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
        expiresAt,
      );
      expect(result).toEqual({ otpExpiresAt: expiresAt, userId: 'user-1' });
    });

    it('should throw UnauthorizedException if email not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('unknown@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException if user status is Invited', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: UserStatus.INVITED });

      await expect(service.login('user@example.com', 'pass')).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException if user status is Inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: UserStatus.INACTIVE });

      await expect(service.login('user@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user has no passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, passwordHash: null });

      await expect(service.login('user@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(service.login('user@example.com', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('resendOtp', () => {
    it('issues and emails a new OTP for an active user without needing the password', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      const expiresAt = new Date('2026-03-05T12:25:00Z');
      otpService.generateAndStore.mockResolvedValue({ otp: '654321', expiresAt });

      const result = await service.resendOtp('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(mockedArgon2.verify).not.toHaveBeenCalled();
      expect(otpService.generateAndStore).toHaveBeenCalledWith('user-1');
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
        'user@example.com',
        '654321',
        expiresAt,
      );
      expect(result).toEqual({ otpExpiresAt: expiresAt, userId: 'user-1' });
    });

    it('throws UnauthorizedException for an unknown userId', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resendOtp('missing')).rejects.toThrow(UnauthorizedException);
      expect(otpService.generateAndStore).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for an inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: UserStatus.INACTIVE });

      await expect(service.resendOtp('user-1')).rejects.toThrow(UnauthorizedException);
      expect(otpService.generateAndStore).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should return token pair on valid OTP', async () => {
      otpService.verifyOtp.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.PROCUREMENT_OFFICER,
        companyId: 'company-1',
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockedArgon2.hash.mockResolvedValue('hashed-refresh-token');
      prisma.user.update.mockResolvedValue({});

      const result = await service.verifyOtp('user-1', '123456');

      expect(otpService.verifyOtp).toHaveBeenCalledWith('user-1', '123456');
      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          refreshTokenHash: 'hashed-refresh-token',
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it('should throw UnauthorizedException on invalid OTP', async () => {
      otpService.verifyOtp.mockResolvedValue(false);

      await expect(service.verifyOtp('user-1', '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException if user not found after OTP validation', async () => {
      otpService.verifyOtp.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(NotFoundException);
    });
  });

  describe('refresh', () => {
    it('should return new token pair for active user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.PROCUREMENT_OFFICER,
        companyId: 'company-1',
        status: UserStatus.ACTIVE,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      mockedArgon2.hash.mockResolvedValue('hashed-new-refresh');
      prisma.user.update.mockResolvedValue({});

      const result = await service.refresh('user-1');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshTokenHash: 'hashed-new-refresh' },
      });
    });

    it('should throw UnauthorizedException if user is not active', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        status: UserStatus.INACTIVE,
      });

      await expect(service.refresh('user-1')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('user-1')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should set refreshTokenHash to null', async () => {
      prisma.user.update.mockResolvedValue({});

      await service.logout('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshTokenHash: null },
      });
    });
  });

  describe('forgotPassword', () => {
    it('should send reset email for active user', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      mockedArgon2.hash.mockResolvedValue('hashed-reset-token');
      prisma.user.update.mockResolvedValue({});

      await service.forgotPassword('user@example.com');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordResetToken: 'hashed-reset-token',
          passwordResetExpiresAt: expect.any(Date),
        },
      });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('reset-password?token='),
        'Test User',
      );
    });

    it('should silently succeed for non-existing email (no enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.forgotPassword('unknown@example.com')).resolves.toBeUndefined();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should silently succeed for non-active user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: UserStatus.INACTIVE });

      await expect(service.forgotPassword('user@example.com')).resolves.toBeUndefined();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      const user = {
        ...activeUser,
        passwordResetToken: 'hashed-reset-tok',
        passwordResetExpiresAt: new Date(Date.now() + 3600000),
      };
      prisma.user.findMany.mockResolvedValue([user]);
      mockedArgon2.verify.mockResolvedValue(true);
      mockedArgon2.hash.mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue({});

      await service.resetPassword('raw-token', 'newpassword123');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordHash: 'new-hashed-password',
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          refreshTokenHash: null,
        },
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      prisma.user.findMany.mockResolvedValue([{ ...activeUser, passwordResetToken: 'hashed-tok' }]);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(service.resetPassword('bad-token', 'newpass')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when no users have reset tokens', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await expect(service.resetPassword('any-token', 'newpass')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip users with null passwordResetToken in iteration', async () => {
      prisma.user.findMany.mockResolvedValue([
        { ...activeUser, id: 'user-null', passwordResetToken: null },
        { ...activeUser, id: 'user-valid', passwordResetToken: 'hashed-tok' },
      ]);
      mockedArgon2.verify.mockResolvedValue(true);
      mockedArgon2.hash.mockResolvedValue('new-hash');
      prisma.user.update.mockResolvedValue({});

      await service.resetPassword('raw-token', 'newpass');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-valid' } }),
      );
    });

    it('should continue iteration if argon2.verify throws', async () => {
      prisma.user.findMany.mockResolvedValue([
        { ...activeUser, id: 'user-bad', passwordResetToken: 'corrupt-hash' },
        { ...activeUser, id: 'user-good', passwordResetToken: 'valid-hash' },
      ]);
      mockedArgon2.verify.mockRejectedValueOnce(new Error('bad hash')).mockResolvedValueOnce(true);
      mockedArgon2.hash.mockResolvedValue('new-hash');
      prisma.user.update.mockResolvedValue({});

      await service.resetPassword('raw-token', 'newpass');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-good' } }),
      );
    });
  });

  describe('validateActivationToken', () => {
    it('should return valid=true for matching token with future expiry', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          ...activeUser,
          status: UserStatus.INVITED,
          invitationToken: 'hashed-invite-tok',
          invitationTokenExpiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockedArgon2.verify.mockResolvedValue(true);

      const result = await service.validateActivationToken('raw-invite-tok');

      expect(result).toEqual({ valid: true, email: 'user@example.com' });
    });

    it('should return valid=false for matching token with past expiry', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          ...activeUser,
          status: UserStatus.INVITED,
          invitationToken: 'hashed-invite-tok',
          invitationTokenExpiresAt: new Date(Date.now() - 86400000),
        },
      ]);
      mockedArgon2.verify.mockResolvedValue(true);

      const result = await service.validateActivationToken('raw-invite-tok');

      expect(result).toEqual({ valid: false, email: 'user@example.com' });
    });

    it('should throw BadRequestException if no token matches', async () => {
      prisma.user.findMany.mockResolvedValue([{ ...activeUser, invitationToken: 'hashed-tok' }]);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(service.validateActivationToken('bad-tok')).rejects.toThrow(BadRequestException);
    });

    it('should skip users with null invitationToken', async () => {
      prisma.user.findMany.mockResolvedValue([{ ...activeUser, invitationToken: null }]);

      await expect(service.validateActivationToken('any-tok')).rejects.toThrow(BadRequestException);
      expect(mockedArgon2.verify).not.toHaveBeenCalled();
    });

    it('should continue if argon2.verify throws for a user', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          ...activeUser,
          id: 'user-bad',
          invitationToken: 'corrupt-hash',
          invitationTokenExpiresAt: new Date(Date.now() + 86400000),
        },
        {
          ...activeUser,
          id: 'user-good',
          invitationToken: 'valid-hash',
          invitationTokenExpiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockedArgon2.verify.mockRejectedValueOnce(new Error('bad hash')).mockResolvedValueOnce(true);

      const result = await service.validateActivationToken('raw-tok');

      expect(result).toEqual({ valid: true, email: 'user@example.com' });
    });
  });

  describe('requestNewInvitation', () => {
    it('should send notification to invitedBy admin', async () => {
      const invitedUser = {
        ...activeUser,
        status: UserStatus.INVITED,
        invitedBy: { id: 'admin-1', email: 'admin@example.com', name: 'Admin User' },
      };
      prisma.user.findFirst.mockResolvedValue(invitedUser);

      await service.requestNewInvitation('user@example.com');

      expect(emailService.sendInvitationExpiredNotification).toHaveBeenCalledWith(
        'admin@example.com',
        'Admin User',
        'Test User',
        'user@example.com',
      );
    });

    it('should find fallback admin when invitedBy is null', async () => {
      const invitedUser = {
        ...activeUser,
        status: UserStatus.INVITED,
        invitedBy: null,
        companyId: 'company-1',
      };
      prisma.user.findFirst.mockResolvedValueOnce(invitedUser).mockResolvedValueOnce({
        id: 'fallback-admin',
        email: 'fallback@example.com',
        name: 'Fallback',
      });

      await service.requestNewInvitation('user@example.com');

      expect(emailService.sendInvitationExpiredNotification).toHaveBeenCalledWith(
        'fallback@example.com',
        'Fallback',
        'Test User',
        'user@example.com',
      );
    });

    it('should silently succeed for non-existing email (no enumeration)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.requestNewInvitation('unknown@example.com')).resolves.toBeUndefined();
      expect(emailService.sendInvitationExpiredNotification).not.toHaveBeenCalled();
    });

    it('should silently succeed when no admin is found', async () => {
      const invitedUser = {
        ...activeUser,
        status: UserStatus.INVITED,
        invitedBy: null,
      };
      prisma.user.findFirst.mockResolvedValueOnce(invitedUser).mockResolvedValueOnce(null);

      await expect(service.requestNewInvitation('user@example.com')).resolves.toBeUndefined();
      expect(emailService.sendInvitationExpiredNotification).not.toHaveBeenCalled();
    });
  });

  describe('activateAccount', () => {
    it('should activate account for valid token', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          ...activeUser,
          status: UserStatus.INVITED,
          invitationToken: 'hashed-invite',
          invitationTokenExpiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockedArgon2.verify.mockResolvedValue(true);
      mockedArgon2.hash.mockResolvedValue('hashed-new-password');
      prisma.user.update.mockResolvedValue({});

      await service.activateAccount('raw-invite-tok', 'mypassword');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordHash: 'hashed-new-password',
          status: UserStatus.ACTIVE,
          invitationToken: null,
          invitationTokenExpiresAt: null,
        },
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      prisma.user.findMany.mockResolvedValue([{ ...activeUser, invitationToken: 'hashed-tok' }]);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(service.activateAccount('bad-tok', 'pass')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no invited users found', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await expect(service.activateAccount('any-tok', 'pass')).rejects.toThrow(BadRequestException);
    });

    it('should skip users with null invitationToken', async () => {
      prisma.user.findMany.mockResolvedValue([
        { ...activeUser, id: 'user-null', invitationToken: null },
      ]);

      await expect(service.activateAccount('tok', 'pass')).rejects.toThrow(BadRequestException);
      expect(mockedArgon2.verify).not.toHaveBeenCalled();
    });

    it('should continue iteration if argon2.verify throws', async () => {
      prisma.user.findMany.mockResolvedValue([
        { ...activeUser, id: 'user-bad', invitationToken: 'corrupt' },
        { ...activeUser, id: 'user-good', invitationToken: 'valid' },
      ]);
      mockedArgon2.verify.mockRejectedValueOnce(new Error('bad hash')).mockResolvedValueOnce(true);
      mockedArgon2.hash.mockResolvedValue('hashed-pw');
      prisma.user.update.mockResolvedValue({});

      await service.activateAccount('raw-tok', 'pass');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-good' } }),
      );
    });
  });
});
