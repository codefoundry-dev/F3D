import { BadRequestException, HttpException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';

import { PrismaService } from '../../prisma/prisma.service';

import { OtpService } from './otp.service';

jest.mock('argon2');
jest.mock('otplib');

const mockedAuthenticator = authenticator as jest.Mocked<typeof authenticator>;

interface Row {
  userId: string;
  codes: { hash: string; expiresAt: string }[];
  attempts: number;
}

/** Stateful in-memory stand-in for prisma.emailVerification (one row per userId). */
function makeStatefulPrisma() {
  const rows = new Map<string, Row>();
  const api = {
    upsert: jest.fn(({ where, create, update }: any) => {
      const existing = rows.get(where.userId);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row: Row = { attempts: 0, ...create };
      rows.set(where.userId, row);
      return row;
    }),
    findUnique: jest.fn(({ where }: any) => rows.get(where.userId) ?? null),
    update: jest.fn(({ where, data }: any) => {
      const row = rows.get(where.userId);
      if (!row) return null;
      if (data.codes !== undefined) row.codes = data.codes;
      if (data.attempts?.increment) row.attempts += data.attempts.increment;
      return row;
    }),
    delete: jest.fn(({ where }: any) => {
      rows.delete(where.userId);
      return {};
    }),
  };
  return { api, rows };
}

const future = (minutes = 15): string => new Date(Date.now() + minutes * 60_000).toISOString();
const past = (minutes = 5): string => new Date(Date.now() - minutes * 60_000).toISOString();

describe('OtpService', () => {
  let service: OtpService;
  let prisma: ReturnType<typeof makeStatefulPrisma>;

  const codeHashes = (userId: string): string[] =>
    (prisma.rows.get(userId)?.codes ?? []).map((c) => c.hash);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makeStatefulPrisma();
    service = new OtpService({ emailVerification: prisma.api } as unknown as PrismaService);

    // hash(otp) -> `H:<otp>`;  verify(hash, otp) -> hash === `H:<otp>`
    (argon2.hash as jest.Mock).mockImplementation((plain: string) => `H:${plain}`);
    (argon2.verify as jest.Mock).mockImplementation(
      (hash: string, plain: string) => hash === `H:${plain}`,
    );
    mockedAuthenticator.generateSecret.mockReturnValue('secret');
  });

  describe('generateAndStore', () => {
    it('stores a single newest code for a brand-new user', async () => {
      mockedAuthenticator.generate.mockReturnValueOnce('111111');

      const result = await service.generateAndStore('u1');

      expect(codeHashes('u1')).toEqual(['H:111111']);
      expect(result.otp).toBe('111111');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('sets the authenticator to 6 digits', async () => {
      mockedAuthenticator.generate.mockReturnValueOnce('654321');
      await service.generateAndStore('u1');
      expect(mockedAuthenticator.options).toEqual({ digits: 6 });
    });

    it('keeps earlier unexpired codes, newest first', async () => {
      mockedAuthenticator.generate.mockReturnValueOnce('111111').mockReturnValueOnce('222222');

      await service.generateAndStore('u1');
      await service.generateAndStore('u1');

      expect(codeHashes('u1')).toEqual(['H:222222', 'H:111111']);
    });

    it('caps concurrently-valid codes at 3 (drops the oldest)', async () => {
      mockedAuthenticator.generate
        .mockReturnValueOnce('111111')
        .mockReturnValueOnce('222222')
        .mockReturnValueOnce('333333')
        .mockReturnValueOnce('444444');

      for (let i = 0; i < 4; i++) await service.generateAndStore('u1');

      expect(codeHashes('u1')).toEqual(['H:444444', 'H:333333', 'H:222222']);
    });

    it('prunes expired codes and resets attempts when issuing a new one', async () => {
      prisma.rows.set('u1', {
        userId: 'u1',
        codes: [{ hash: 'H:old', expiresAt: past() }],
        attempts: 2,
      });
      mockedAuthenticator.generate.mockReturnValueOnce('555555');

      await service.generateAndStore('u1');

      expect(codeHashes('u1')).toEqual(['H:555555']);
      expect(prisma.rows.get('u1')?.attempts).toBe(0);
    });
  });

  describe('verifyOtp', () => {
    it('accepts the latest code and clears the record', async () => {
      mockedAuthenticator.generate.mockReturnValueOnce('123456');
      await service.generateAndStore('u1');

      expect(await service.verifyOtp('u1', '123456')).toBe(true);
      expect(prisma.rows.has('u1')).toBe(false);
    });

    it('accepts an EARLIER still-valid code after a newer one was issued (the Ayo bug)', async () => {
      mockedAuthenticator.generate.mockReturnValueOnce('111111').mockReturnValueOnce('222222');
      await service.generateAndStore('u1'); // first email -> 111111
      await service.generateAndStore('u1'); // re-login issued 222222 (previously this killed 111111)

      // Code from the FIRST email still works.
      expect(await service.verifyOtp('u1', '111111')).toBe(true);
      expect(prisma.rows.has('u1')).toBe(false);
    });

    it('returns false and increments attempts for a wrong code', async () => {
      mockedAuthenticator.generate.mockReturnValueOnce('123456');
      await service.generateAndStore('u1');

      expect(await service.verifyOtp('u1', '000000')).toBe(false);
      expect(prisma.rows.get('u1')?.attempts).toBe(1);
    });

    it('throws otpNotFound when there is no record', async () => {
      await expect(service.verifyOtp('u1', '123456')).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp('u1', '123456')).rejects.toThrow(
        'No OTP found. Please log in again.',
      );
    });

    it('throws otpExpired and deletes the record when every code has expired', async () => {
      prisma.rows.set('u1', {
        userId: 'u1',
        codes: [{ hash: 'H:111111', expiresAt: past() }],
        attempts: 0,
      });

      await expect(service.verifyOtp('u1', '111111')).rejects.toThrow('OTP has expired');
      expect(prisma.rows.has('u1')).toBe(false);
    });

    it('locks the account (423) when a wrong code makes attempts reach the max', async () => {
      prisma.rows.set('u1', {
        userId: 'u1',
        codes: [{ hash: 'H:111111', expiresAt: future() }],
        attempts: 2,
      });

      await expect(service.verifyOtp('u1', '000000')).rejects.toThrow(
        'Account locked due to too many failed OTP attempts',
      );
    });

    it('locks the account (423) when attempts are already at the max', async () => {
      prisma.rows.set('u1', {
        userId: 'u1',
        codes: [{ hash: 'H:111111', expiresAt: future() }],
        attempts: 3,
      });

      await expect(service.verifyOtp('u1', '111111')).rejects.toThrow(HttpException);
      expect(prisma.rows.has('u1')).toBe(false);
    });
  });
});
