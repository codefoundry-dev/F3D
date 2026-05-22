import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { GeminiService } from '../../src/modules/gemini/gemini.service';
import { EmailService } from '../../src/modules/notifications/email.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { PrismaService } from '../../src/prisma/prisma.service';

import { MockEmailService } from './test-helpers';

/**
 * FOR-199: end-to-end coverage of the document-intelligence pipeline. The
 * outer Storage + Gemini integrations are swapped for in-memory mocks so the
 * test exercises the controller, service, Prisma layer, and permission guard
 * without needing MinIO or the live Gemini API.
 */
describe('Doc Extractions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let geminiMock: { isConfigured: jest.Mock; generate: jest.Mock };
  let storageMock: {
    upload: jest.Mock;
    delete: jest.Mock;
    objects: Map<string, Buffer>;
  };
  let pmTokens: { accessToken: string; userId: string };

  beforeAll(async () => {
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

    storageMock = {
      objects: new Map(),
      upload: jest.fn(async (key: string, buffer: Buffer) => {
        storageMock.objects.set(key, buffer);
        return { bucket: 'test-bucket', key };
      }),
      delete: jest.fn(async (key: string) => {
        storageMock.objects.delete(key);
      }),
    };

    geminiMock = {
      isConfigured: jest.fn().mockReturnValue(true),
      generate: jest.fn().mockResolvedValue({
        text: '{"title":"Concrete BOM","items":[{"description":"Cement","quantity":50,"unit":"bag"}]}',
        model: 'gemini-2.5-flash',
        usage: { promptTokenCount: 100, candidatesTokenCount: 30 },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(new MockEmailService())
      .overrideProvider(StorageService)
      .useValue(storageMock as unknown as StorageService)
      .overrideProvider(GeminiService)
      .useValue(geminiMock as unknown as GeminiService)
      .compile();

    app = moduleFixture.createNestApplication();
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
    pmTokens = await loginAsSeedUser(app);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('uploads a PDF, kicks off extraction, and returns a PENDING/PROCESSING job', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/doc-extractions')
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .field('type', 'BOM')
      .attach('file', Buffer.from('%PDF-1.4 fake bom'), {
        filename: 'bom.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const job = res.body.data;
    expect(job.id).toBeDefined();
    expect(job.type).toBe('BOM');
    expect(['PENDING', 'PROCESSING', 'COMPLETED']).toContain(job.status);
    expect(job.file.filename).toBe('bom.pdf');

    expect(storageMock.upload).toHaveBeenCalled();
    await pollUntilSettled(app, pmTokens.accessToken, job.id);
    expect(geminiMock.generate).toHaveBeenCalled();
  });

  it('reaches COMPLETED via the polling endpoint with the parsed result', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/doc-extractions')
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .field('type', 'BOM')
      .attach('file', Buffer.from('%PDF-poll'), {
        filename: 'poll.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const id = createRes.body.data.id;
    const job = await pollUntilSettled(app, pmTokens.accessToken, id);

    expect(job.status).toBe('COMPLETED');
    expect(job.rawResult).toMatchObject({
      title: 'Concrete BOM',
      items: [expect.objectContaining({ description: 'Cement' })],
    });
    expect(job.editedResult).toMatchObject({ title: 'Concrete BOM' });
    expect(job.usage).toMatchObject({ promptTokens: 100, completionTokens: 30 });
  });

  it('marks the job FAILED when Gemini returns malformed JSON', async () => {
    geminiMock.generate.mockResolvedValueOnce({
      text: 'not really JSON at all',
      model: 'gemini-2.5-flash',
    });

    const createRes = await request(app.getHttpServer())
      .post('/v1/doc-extractions')
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .field('type', 'BOM')
      .attach('file', Buffer.from('%PDF-malformed'), {
        filename: 'malformed.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const job = await pollUntilSettled(app, pmTokens.accessToken, createRes.body.data.id);
    expect(job.status).toBe('FAILED');
    expect(job.errorCode).toBe('MALFORMED_RESPONSE');
  });

  it('rejects non-PDF/image uploads with 400', async () => {
    await request(app.getHttpServer())
      .post('/v1/doc-extractions')
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .field('type', 'BOM')
      .attach('file', Buffer.from('hello'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('returns 401 when no auth token is provided', async () => {
    await request(app.getHttpServer())
      .post('/v1/doc-extractions')
      .field('type', 'BOM')
      .attach('file', Buffer.from('%PDF-unauth'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);
  });

  it('supports the full edit → confirm → delete lifecycle', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/doc-extractions')
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .field('type', 'BOM')
      .attach('file', Buffer.from('%PDF-lifecycle'), {
        filename: 'lifecycle.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const id = createRes.body.data.id;
    await pollUntilSettled(app, pmTokens.accessToken, id);

    const editRes = await request(app.getHttpServer())
      .patch(`/v1/doc-extractions/${id}`)
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .send({ editedResult: { title: 'Edited BOM', items: [] } })
      .expect(200);
    expect(editRes.body.data.editedResult).toEqual({ title: 'Edited BOM', items: [] });

    const confirmRes = await request(app.getHttpServer())
      .post(`/v1/doc-extractions/${id}/confirm`)
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .send({})
      .expect(200);
    expect(confirmRes.body.data.status).toBe('CONFIRMED');
    expect(confirmRes.body.data.confirmedAt).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/v1/doc-extractions/${id}/confirm`)
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/v1/doc-extractions/${id}`)
      .set('Authorization', `Bearer ${pmTokens.accessToken}`)
      .expect(204);

    const stillThere = await prisma.docExtraction.findUnique({ where: { id } });
    expect(stillThere).toBeNull();
  });
});

// ── Local helpers ─────────────────────────────────────────────────────────

interface ExtractionJob {
  id: string;
  status: string;
  rawResult: Record<string, unknown> | null;
  editedResult: Record<string, unknown> | null;
  errorCode: string | null;
  usage: { promptTokens: number; completionTokens: number } | null;
  confirmedAt: string | null;
}

async function pollUntilSettled(
  app: INestApplication,
  token: string,
  id: string,
): Promise<ExtractionJob> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await request(app.getHttpServer())
      .get(`/v1/doc-extractions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const job = res.body.data as ExtractionJob;
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CONFIRMED') {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Extraction ${id} did not settle in time`);
}

async function loginAsSeedUser(
  app: INestApplication,
): Promise<{ accessToken: string; userId: string }> {
  const email = 'procurement@testcontractor.local';
  const password = 'Dev@123456';
  const loginRes = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const userId = loginRes.body.data?.userId ?? loginRes.body.userId;
  if (!userId) throw new Error('login did not return userId');

  // Seed users have an OTP step — we need to fetch the OTP from the EmailService mock,
  // but since we're using a fresh EmailService here, the OTP arrives in its sentEmails
  // list. We hook into the testing module above.
  // Workaround: use the same MockEmailService pattern as test-helpers.
  const mockEmail = (app as unknown as {
    get: (token: typeof EmailService) => MockEmailService;
  }).get(EmailService) as unknown as MockEmailService;
  const sent = mockEmail.getLastEmailTo(email);
  if (!sent?.otp) throw new Error('no OTP captured for login');

  const otpRes = await request(app.getHttpServer())
    .post('/v1/auth/verify-otp')
    .send({ userId, otp: sent.otp })
    .expect(200);

  const setCookie = otpRes.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
  const jwt = extractCookieValue(cookies, 'jwt');
  if (!jwt) throw new Error('no jwt cookie set');
  return { accessToken: jwt, userId };
}

function extractCookieValue(cookies: string[], name: string): string | null {
  for (const raw of cookies) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(pair.slice(eq + 1));
  }
  return null;
}
