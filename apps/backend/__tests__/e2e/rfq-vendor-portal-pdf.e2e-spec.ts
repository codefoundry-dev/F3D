import type { INestApplication } from '@nestjs/common';
import { AccessTokenPurpose, AccessTokenSubject } from '@prisma/client';
import request from 'supertest';

import { AccessTokensService } from '../../src/modules/access-tokens/access-tokens.service';
import { GeminiService } from '../../src/modules/gemini/gemini.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import type { PrismaService } from '../../src/prisma/prisma.service';

import {
  AuthTokens,
  authRequest,
  bootstrapTestApp,
  getHttpServer,
  loginUser,
  SEED_USERS,
  teardownTestApp,
} from './test-helpers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * FOR-206 — Quote submission via PDF upload (Gemini OCR + vendor confirmation).
 *
 * Drives the alternative vendor-portal path end-to-end:
 *   • POST a quote PDF → a Gemini extraction job is started (token validated,
 *     NOT consumed).
 *   • Poll the (token-less) status endpoint until the job COMPLETES with the
 *     normalized quote line items.
 *   • Submit the reviewed quote with the source PDF attached → it is persisted.
 *
 * The Gemini + Storage integrations are mocked at the instance level so the test
 * exercises the controllers, services, Prisma layer and token logic without
 * needing MinIO or the live Gemini API.
 */
describe('RFQ vendor portal — PDF upload (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokens: AccessTokensService;

  let admin: AuthTokens;

  let vendorId: string;
  let rfqId: string;
  let rfqVendorId: string;
  let rfqLineItemId: string;
  let extractionId: string;

  const EXTRACTED_QUOTE = {
    vendorName: 'Portal Vendor',
    quoteNumber: 'Q-206',
    currency: 'USD',
    totalAmount: 62.5,
    items: [
      {
        description: 'Test Material',
        quantity: 5,
        unit: 'pcs',
        unitPrice: 12.5,
        lineTotal: 62.5,
        leadTime: '1 week',
      },
    ],
    notes: 'Firm 30 days',
  };

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    accessTokens = app.get(AccessTokensService);

    // Swap the external integrations for in-memory mocks.
    const gemini = app.get(GeminiService);
    jest.spyOn(gemini, 'isConfigured').mockReturnValue(true);
    jest.spyOn(gemini, 'generate').mockResolvedValue({
      text: JSON.stringify(EXTRACTED_QUOTE),
      model: 'gemini-2.5-flash',
      usage: { promptTokenCount: 80, candidatesTokenCount: 40 },
    } as Awaited<ReturnType<GeminiService['generate']>>);

    const storage = app.get(StorageService);
    jest
      .spyOn(storage, 'upload')
      .mockImplementation(async (key: string) => ({ bucket: 'test-bucket', key }));
    jest.spyOn(storage, 'getSignedUrl').mockResolvedValue('http://signed.local/quote.pdf');
    jest.spyOn(storage, 'delete').mockResolvedValue(undefined);

    admin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
  });

  afterAll(async () => {
    if (rfqId) {
      await prisma.quoteResponse.deleteMany({ where: { rfqId } });
      await prisma.docExtraction.deleteMany({ where: { rfqId } });
      await prisma.accessToken.deleteMany({ where: { subjectId: rfqId } });
      await prisma.rfqVendor.deleteMany({ where: { rfqId } });
      await prisma.rfqLineItem.deleteMany({ where: { rfqId } });
      await prisma.rfq.delete({ where: { id: rfqId } }).catch(() => undefined);
    }
    if (vendorId) {
      await prisma.companyVendorAssignment.deleteMany({ where: { vendorId } });
      await prisma.company.delete({ where: { id: vendorId } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

  async function issueToken(): Promise<string> {
    const { token } = await accessTokens.issueToken({
      subjectType: AccessTokenSubject.RFQ,
      subjectId: rfqId,
      purpose: AccessTokenPurpose.QUOTE_SUBMIT,
      ttlMs: 60 * 60 * 1000,
      maxAttempts: 50,
      metadata: { rfqVendorId, vendorId },
    });
    return token;
  }

  it('sets up an OPEN RFQ with an invited vendor', async () => {
    const contractor = await prisma.company.findFirst({
      where: { abn: 'TEST-CONTRACTOR-001' },
      select: { id: true },
    });
    expect(contractor).not.toBeNull();

    const project = await prisma.project.findFirst({
      where: { companyId: contractor!.id, locations: { some: { type: 'DELIVERY' } } },
      select: {
        id: true,
        locations: { where: { type: 'DELIVERY' }, select: { id: true }, take: 1 },
      },
    });
    expect(project).not.toBeNull();
    const deliveryLocationId = project!.locations[0]!.id;

    const material = await prisma.material.findFirst({ select: { id: true } });
    expect(material).not.toBeNull();

    const stamp = Date.now();
    const vendorRes = await authRequest('post', '/v1/companies', admin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: `PDF Portal Vendor ${stamp}`,
        contactEmail: `pdf-vendor-${stamp}@for206.local`,
      })
      .expect(201);
    vendorId = vendorRes.body.data.id;

    const createRes = await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds: [vendorId],
        lineItems: [{ materialId: material!.id, quantity: 5, uom: 'pcs', costCode: 'CC-206' }],
      })
      .expect(201);
    rfqId = createRes.body.data.id;

    await authRequest('post', `/v1/rfqs/${rfqId}/send`, admin.accessToken).send({}).expect(200);

    const rfqVendor = await prisma.rfqVendor.findFirstOrThrow({
      where: { rfqId, vendorId },
      select: { id: true },
    });
    rfqVendorId = rfqVendor.id;

    const lineItem = await prisma.rfqLineItem.findFirstOrThrow({
      where: { rfqId },
      select: { id: true },
    });
    rfqLineItemId = lineItem.id;
  });

  it('uploads a quote PDF and extracts the line items (without burning the token)', async () => {
    const token = await issueToken();
    const server = getHttpServer();

    const uploadRes = await request(server)
      .post(`/v1/rfqs/invitation/${token}/quote-extraction`)
      .attach('file', Buffer.from('%PDF-1.4 fake quote'), {
        filename: 'quote.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    extractionId = uploadRes.body.data.id;
    expect(extractionId).toBeTruthy();
    expect(uploadRes.body.data.type).toBe('QUOTE');

    // Poll the token-less status endpoint until the async extraction settles.
    let job: { status: string; editedResult: { items?: unknown[] } | null } | undefined;
    for (let i = 0; i < 25; i += 1) {
      const pollRes = await request(server)
        .get(`/v1/rfqs/invitation/quote-extraction/${extractionId}`)
        .expect(200);
      job = pollRes.body.data;
      if (job && (job.status === 'COMPLETED' || job.status === 'FAILED')) break;
      await sleep(50);
    }

    expect(job?.status).toBe('COMPLETED');
    expect(job?.editedResult?.items).toHaveLength(1);

    // The extraction must NOT consume the invitation token — the vendor still
    // submits afterwards. The landing page remains viewable with the same token.
    await request(server).get(`/v1/rfqs/invitation/${token}`).expect(200);
  });

  it('rejects polling a non-existent / non-quote extraction id', async () => {
    await request(getHttpServer())
      .get('/v1/rfqs/invitation/quote-extraction/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('submits the reviewed quote with the source PDF attached', async () => {
    const token = await issueToken();
    const server = getHttpServer();

    // The frontend attaches the uploaded PDF (the extraction's file) to the quote.
    const extraction = await prisma.docExtraction.findUniqueOrThrow({
      where: { id: extractionId },
      select: { fileId: true },
    });

    const submitRes = await request(server)
      .post(`/v1/rfqs/invitation/${token}/quote`)
      .send({
        message: 'Submitted from extracted PDF',
        attachmentIds: [extraction.fileId],
        lineItems: [
          {
            rfqLineItemId,
            unitPrice: 12.5,
            quotedQuantity: 5,
            deliveryDate: '2026-07-01',
            notes: 'Lead time: 1 week',
          },
        ],
      })
      .expect(201);

    expect(submitRes.body.data.id).toBeTruthy();

    const quote = await prisma.quoteResponse.findFirstOrThrow({
      where: { rfqId, vendorId },
      select: {
        status: true,
        lineItems: { select: { unitPrice: true } },
        attachments: { select: { fileId: true } },
      },
    });
    expect(quote.status).toBe('SUBMITTED');
    expect(quote.lineItems.length).toBeGreaterThan(0);
    expect(quote.attachments).toHaveLength(1);
    expect(quote.attachments[0].fileId).toBe(extraction.fileId);
  });
});
