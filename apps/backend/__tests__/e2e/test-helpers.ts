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
  cc?: string[]; // CC recipients (RFQ send)
  attachments?: { filename: string; content?: Buffer }[]; // Attachment metadata + bytes (RFQ/PO send)
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

  async sendRfqReceivedEmail(
    to: string,
    rfqNumber: string,
    replyUrl: string,
    options?: { cc?: string[]; attachments?: { filename: string }[] },
  ): Promise<void> {
    this.sentEmails.push({
      to,
      subject: `RFQ ${rfqNumber}`,
      html: `<a href="${replyUrl}">View RFQ</a>`,
      url: replyUrl,
      ...(options?.cc ? { cc: options.cc } : {}),
      ...(options?.attachments
        ? { attachments: options.attachments.map((a) => ({ filename: a.filename })) }
        : {}),
    });
  }

  // FOR-211 — PO issued to vendor with the polished PO PDF attached. Captures the
  // PDF buffer so tests can assert the vendor received a valid attachment.
  async sendPoIssuedEmail(
    to: string,
    poNumber: string,
    viewUrl: string,
    pdfBuffer?: Buffer,
  ): Promise<void> {
    this.sentEmails.push({
      to,
      subject: `Purchase Order ${poNumber}`,
      html: `<a href="${viewUrl}">View PO</a>`,
      url: viewUrl,
      ...(pdfBuffer
        ? { attachments: [{ filename: `PO-${poNumber}.pdf`, content: pdfBuffer }] }
        : {}),
    });
  }

  async sendPoDeclinedByVendorEmail(
    to: string,
    poNumber: string,
    _vendorName: string,
    viewUrl: string,
    _reason?: string,
  ): Promise<void> {
    this.sentEmails.push({
      to,
      subject: `Purchase Order ${poNumber} declined`,
      html: `<a href="${viewUrl}">View PO</a>`,
      url: viewUrl,
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
 * Full login flow: POST /login → capture OTP from mock email → POST /verify-otp.
 * The controller sets jwt + jwt_refresh cookies and returns only `{ success: true }`,
 * so we parse the Set-Cookie header to extract the bearer tokens used by `authRequest`.
 */
export async function loginUser(email: string, password: string): Promise<AuthTokens> {
  const server = app.getHttpServer();

  // Step 1: Login
  const loginRes = await request(server)
    .post('/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const userId = loginRes.body.data?.userId ?? loginRes.body.userId;
  if (!userId) {
    throw new Error(`Login did not return a userId for ${email}: ${JSON.stringify(loginRes.body)}`);
  }

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

  const setCookieHeader = otpRes.headers['set-cookie'];
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader].filter(Boolean);

  const accessToken = extractCookieValue(cookies, 'jwt');
  const refreshToken = extractCookieValue(cookies, 'jwt_refresh');
  if (!accessToken || !refreshToken) {
    throw new Error(`verify-otp did not set jwt cookies for ${email}: ${JSON.stringify(cookies)}`);
  }

  return { accessToken, refreshToken, userId };
}

export function extractCookieValue(cookies: string[], name: string): string | null {
  for (const raw of cookies) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(pair.slice(eq + 1));
  }
  return null;
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
  northsideAdmin: {
    email: 'companyadmin@northside.local',
    password: 'Dev@123456',
  },
} as const;

export function getHttpServer() {
  return app.getHttpServer();
}
