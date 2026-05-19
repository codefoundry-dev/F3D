import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType, ExecutionContext } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EmailService } from '../../src/modules/notifications/email.service';

// ── Mock Email Service ──────────────────────────────────────────────────────
// Captures all sent emails in memory so tests can extract OTP codes, invitation
// tokens, etc. without needing a real SMTP server.

export interface SentEmail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  otp?: string; // Extracted OTP for convenience
  url?: string; // Extracted URL for convenience
}

export class MockEmailService {
  public sentEmails: SentEmail[] = [];

  clear(): void {
    this.sentEmails = [];
  }

  getLastEmailTo(email: string): SentEmail | undefined {
    return [...this.sentEmails].reverse().find((e) => e.to === email);
  }

  async sendOtpEmail(to: string, otp: string, expiresAt: Date): Promise<void> {
    this.sentEmails.push({
      to,
      subject: 'Your Forethread Login Code',
      text: `OTP: ${otp}`,
      otp,
    });
  }

  async sendInvitationEmail(to: string, activationUrl: string, name: string): Promise<void> {
    this.sentEmails.push({
      to,
      subject: 'Welcome to Forethread — Activate Your Account',
      html: `<a href="${activationUrl}">Activate</a>`,
      url: activationUrl,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    this.sentEmails.push({
      to,
      subject: 'Forethread — Password Reset Request',
      html: `<a href="${resetUrl}">Reset</a>`,
      url: resetUrl,
    });
  }

  async sendDeactivationEmail(to: string, name: string): Promise<void> {
    this.sentEmails.push({
      to,
      subject: 'Forethread — Your Account Has Been Deactivated',
    });
  }
}

// ── App Bootstrap ───────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;
let mockEmailService: MockEmailService;

export async function bootstrapTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  emailService: MockEmailService;
}> {
  if (app) {
    return { app, prisma, emailService: mockEmailService };
  }

  mockEmailService = new MockEmailService();

  // Disable rate limiting for e2e tests
  jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EmailService)
    .useValue(mockEmailService)
    .compile();

  app = moduleFixture.createNestApplication();

  // Apply the same global config as main.ts
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.init();

  prisma = moduleFixture.get<PrismaService>(PrismaService);

  return { app, prisma, emailService: mockEmailService };
}

export async function teardownTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = undefined as any;
  }
}

// ── Auth Helpers ────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

/**
 * Full login flow: POST /login → capture OTP from mock email → POST /verify-otp
 * Returns access + refresh tokens ready for use in subsequent requests.
 */
export async function loginUser(email: string, password: string): Promise<AuthTokens> {
  const server = app.getHttpServer();

  // Step 1: Login
  const loginRes = await request(server)
    .post('/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const userId = loginRes.body.data.userId;

  // Step 2: Get OTP from mock email service
  const sentEmail = mockEmailService.getLastEmailTo(email);
  if (!sentEmail?.otp) {
    throw new Error(`No OTP email found for ${email}`);
  }

  // Step 3: Verify OTP
  const otpRes = await request(server)
    .post('/v1/auth/verify-otp')
    .send({ userId, otp: sentEmail.otp })
    .expect(200);

  return {
    accessToken: otpRes.body.data.accessToken,
    refreshToken: otpRes.body.data.refreshToken,
    userId,
  };
}

/**
 * Returns a supertest agent with Authorization header set.
 */
export function authRequest(
  method: 'get' | 'post' | 'patch' | 'delete',
  url: string,
  token: string,
) {
  const server = app.getHttpServer();
  return request(server)[method](url).set('Authorization', `Bearer ${token}`);
}

// ── Seed Credentials ────────────────────────────────────────────────────────

export const SEED_USERS = {
  superAdmin: {
    email: 'superadmin@forethread.local',
    password: 'Dev@123456',
  },
  companyAdmin: {
    email: 'companyadmin@testcontractor.local',
    password: 'Dev@123456',
  },
  procurementOfficer: {
    email: 'procurement@testcontractor.local',
    password: 'Dev@123456',
  },
  financialOfficer: {
    email: 'financial@testcontractor.local',
    password: 'Dev@123456',
  },
} as const;

export function getHttpServer() {
  return app.getHttpServer();
}
