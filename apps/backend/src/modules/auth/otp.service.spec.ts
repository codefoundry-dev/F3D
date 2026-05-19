import { BadRequestException, HttpException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';

import { PrismaService } from '../../prisma/prisma.service';

import { OtpService } from './otp.service';

jest.mock('argon2');
jest.mock('otplib');

const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;
const mockedAuthenticator = authenticator as jest.Mocked<typeof authenticator>;

describe('OtpService', () => {
  let service: OtpService;
  let prisma: {
    emailVerification: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      emailVerification: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new OtpService(prisma as unknown as PrismaService);

    jest.clearAllMocks();
  });

  describe('generateAndStore', () => {
    it('should generate a 6-digit OTP, hash it, and upsert the record', async () => {
      mockedAuthenticator.generateSecret.mockReturnValue('test-secret');
      mockedAuthenticator.generate.mockReturnValue('123456');
      mockedArgon2.hash.mockResolvedValue('hashed-otp');
      prisma.emailVerification.upsert.mockResolvedValue({});

      const result = await service.generateAndStore('user-1');

      expect(mockedAuthenticator.generate).toHaveBeenCalledWith('test-secret');
      expect(mockedArgon2.hash).toHaveBeenCalledWith('123456');
      expect(prisma.emailVerification.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: {
          userId: 'user-1',
          otpHash: 'hashed-otp',
          expiresAt: expect.any(Date),
        },
        update: {
          otpHash: 'hashed-otp',
          expiresAt: expect.any(Date),
          attempts: 0,
        },
      });
      expect(result.otp).toBe('123456');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should set authenticator options to 6 digits', async () => {
      mockedAuthenticator.generateSecret.mockReturnValue('secret');
      mockedAuthenticator.generate.mockReturnValue('654321');
      mockedArgon2.hash.mockResolvedValue('hash');
      prisma.emailVerification.upsert.mockResolvedValue({});

      await service.generateAndStore('user-1');

      expect(mockedAuthenticator.options).toEqual({ digits: 6 });
    });
  });

  describe('verifyOtp', () => {
    it('should return true and delete record for valid OTP', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue({
        userId: 'user-1',
        otpHash: 'hashed-otp',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 0,
      });
      mockedArgon2.verify.mockResolvedValue(true);
      prisma.emailVerification.delete.mockResolvedValue({});

      const result = await service.verifyOtp('user-1', '123456');

      expect(result).toBe(true);
      expect(mockedArgon2.verify).toHaveBeenCalledWith('hashed-otp', '123456');
      expect(prisma.emailVerification.delete).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should return false and increment attempts for invalid OTP', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue({
        userId: 'user-1',
        otpHash: 'hashed-otp',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 0,
      });
      mockedArgon2.verify.mockResolvedValue(false);
      prisma.emailVerification.update.mockResolvedValue({ attempts: 1 });

      const result = await service.verifyOtp('user-1', '000000');

      expect(result).toBe(false);
      expect(prisma.emailVerification.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('should throw BadRequestException when no OTP record exists', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue(null);

      await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(
        'No OTP found. Please log in again.',
      );
    });

    it('should throw BadRequestException and delete record when OTP has expired', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue({
        userId: 'user-1',
        otpHash: 'hashed-otp',
        expiresAt: new Date(Date.now() - 1000),
        attempts: 0,
      });
      prisma.emailVerification.delete.mockResolvedValue({});

      await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(
        'OTP has expired. Please log in again.',
      );
      expect(prisma.emailVerification.delete).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should throw 423 and delete record when max attempts already reached', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue({
        userId: 'user-1',
        otpHash: 'hashed-otp',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 3,
      });
      prisma.emailVerification.delete.mockResolvedValue({});

      await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(HttpException);
      await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(
        'Account locked due to too many failed OTP attempts',
      );
    });

    it('should throw 423 when invalid OTP causes attempts to reach max', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue({
        userId: 'user-1',
        otpHash: 'hashed-otp',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 2,
      });
      mockedArgon2.verify.mockResolvedValue(false);
      prisma.emailVerification.update.mockResolvedValue({ attempts: 3 });

      await expect(service.verifyOtp('user-1', '000000')).rejects.toThrow(HttpException);
      await expect(service.verifyOtp('user-1', '000000')).rejects.toThrow(
        'Account locked due to too many failed OTP attempts',
      );
    });
  });
});
