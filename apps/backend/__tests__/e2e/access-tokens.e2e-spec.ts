import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  INestApplication,
  Module,
  Post,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AccessTokenPurpose, AccessTokenSubject, type AccessToken } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import {
  AccessTokensModule,
  AccessTokensService,
  CurrentAccessToken,
  RequireAccessToken,
} from '../../src/modules/access-tokens';
import { Public } from '../../src/common/decorators/public.decorator';
import { EmailService } from '../../src/modules/notifications/email.service';
import { PrismaService } from '../../src/prisma/prisma.service';

import { MockEmailService } from './test-helpers';

/**
 * FOR-201: end-to-end coverage of the tokenized-link guard. A throwaway test
 * controller exercises the @RequireAccessToken decorator so we hit the full
 * HTTP pipeline (guard, validation, request augmentation, response shaping).
 */

@Controller('test-access-tokens')
class TestTokenController {
  constructor(private readonly tokens: AccessTokensService) {}

  @Public()
  @RequireAccessToken({
    expectedPurpose: AccessTokenPurpose.QUOTE_SUBMIT,
    expectedSubjectType: AccessTokenSubject.QUOTE_RESPONSE,
  })
  @Get('check')
  check(@CurrentAccessToken() token: AccessToken) {
    return {
      tokenId: token.id,
      subjectId: token.subjectId,
      purpose: token.purpose,
      attempts: token.attempts,
    };
  }

  @Public()
  @RequireAccessToken({ expectedPurpose: AccessTokenPurpose.QUOTE_SUBMIT })
  @Post('consume')
  async consume(@CurrentAccessToken() token: AccessToken) {
    await this.tokens.consumeToken(token.id);
    return { ok: true };
  }
}

@Module({ imports: [AccessTokensModule], controllers: [TestTokenController] })
class TestTokenModule {}

describe('Access Tokens guard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: AccessTokensService;

  beforeAll(async () => {
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, TestTokenModule],
    })
      .overrideProvider(EmailService)
      .useValue(new MockEmailService())
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

    prisma = moduleFixture.get(PrismaService);
    tokens = moduleFixture.get(AccessTokensService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await prisma.accessToken.deleteMany({});
  });

  it('lets a valid token through and exposes it to the handler', async () => {
    const issued = await tokens.issueToken({
      subjectType: AccessTokenSubject.QUOTE_RESPONSE,
      subjectId: 'q-123',
      purpose: AccessTokenPurpose.QUOTE_SUBMIT,
      ttlMs: 60_000,
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/test-access-tokens/check?token=${issued.token}`)
      .expect(200);

    expect(res.body.data).toEqual({
      tokenId: issued.record.id,
      subjectId: 'q-123',
      purpose: AccessTokenPurpose.QUOTE_SUBMIT,
      attempts: 1,
    });
  });

  it('returns 403 when no token is provided', async () => {
    await request(app.getHttpServer()).get('/v1/test-access-tokens/check').expect(403);
  });

  it('returns 403 when the token has expired', async () => {
    const issued = await tokens.issueToken({
      subjectType: AccessTokenSubject.QUOTE_RESPONSE,
      subjectId: 'q-1',
      purpose: AccessTokenPurpose.QUOTE_SUBMIT,
      ttlMs: 60_000,
    });
    // Force expiry in the DB without waiting.
    await prisma.accessToken.update({
      where: { id: issued.record.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/test-access-tokens/check?token=${issued.token}`)
      .expect(403);
    expect(String(res.body.error)).toMatch(/expired/i);
  });

  it('rejects the second use of a single-use token (consume → 403)', async () => {
    const issued = await tokens.issueToken({
      subjectType: AccessTokenSubject.QUOTE_RESPONSE,
      subjectId: 'q-1',
      purpose: AccessTokenPurpose.QUOTE_SUBMIT,
      ttlMs: 60_000,
    });

    await request(app.getHttpServer())
      .post('/v1/test-access-tokens/consume')
      .set('X-Access-Token', issued.token)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/test-access-tokens/consume')
      .set('X-Access-Token', issued.token)
      .expect(403);
    expect(String(res.body.error)).toMatch(/already been used/i);
  });

  it('rejects a token whose secret has been tampered with', async () => {
    const issued = await tokens.issueToken({
      subjectType: AccessTokenSubject.QUOTE_RESPONSE,
      subjectId: 'q-1',
      purpose: AccessTokenPurpose.QUOTE_SUBMIT,
      ttlMs: 60_000,
    });
    const [lookupId] = issued.token.split('.');
    const tampered = `${lookupId}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

    await request(app.getHttpServer())
      .get(`/v1/test-access-tokens/check?token=${tampered}`)
      .expect(403);
  });

  it('rejects a token whose purpose does not match the route', async () => {
    const issued = await tokens.issueToken({
      subjectType: AccessTokenSubject.RFQ,
      subjectId: 'rfq-1',
      purpose: AccessTokenPurpose.RFQ_VIEW,
      ttlMs: 60_000,
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/test-access-tokens/check?token=${issued.token}`)
      .expect(403);
    expect(String(res.body.error)).toMatch(/not valid for this action/i);
  });

  it('fires the per-token rate limit (429) after maxAttempts failed tries', async () => {
    const issued = await tokens.issueToken({
      subjectType: AccessTokenSubject.QUOTE_RESPONSE,
      subjectId: 'q-1',
      purpose: AccessTokenPurpose.QUOTE_SUBMIT,
      ttlMs: 60_000,
      maxAttempts: 3,
    });
    const [lookupId] = issued.token.split('.');
    const bad = `${lookupId}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

    // Burn through the allowance (3 failed attempts) and then trip 429.
    await request(app.getHttpServer()).get(`/v1/test-access-tokens/check?token=${bad}`).expect(403);
    await request(app.getHttpServer()).get(`/v1/test-access-tokens/check?token=${bad}`).expect(403);
    await request(app.getHttpServer()).get(`/v1/test-access-tokens/check?token=${bad}`).expect(403);
    const locked = await request(app.getHttpServer())
      .get(`/v1/test-access-tokens/check?token=${bad}`)
      .expect(429);
    expect(String(locked.body.error)).toMatch(/too many attempts/i);
  });
});
