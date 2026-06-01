import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration-level e2e: bypasses the OTP flow by minting JWTs directly via
 * JwtService. Verifies the FOR-195 acceptance criteria end-to-end:
 *   1. CRUD endpoints for the canonical permission catalog, roles, and per-role permissions.
 *   2. Granting a permission takes effect on the next request (no logout).
 *   3. Revoking a permission denies the next request.
 *   4. An audit row is written with the added/removed diff.
 */
describe('Roles & permissions (e2e — direct JWT)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  let caUserId: string;
  let foremanUserId: string;
  let foUserId: string;
  let caToken: string;
  let foremanToken: string;
  let foToken: string;

  async function mintToken(user: {
    id: string;
    email: string;
    role: UserRole;
    companyId: string | null;
  }): Promise<string> {
    return jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  }

  async function ensureUser(opts: {
    email: string;
    role: UserRole;
    companyId: string | null;
  }): Promise<{ id: string; email: string; role: UserRole; companyId: string | null }> {
    const existing = await prisma.user.findUnique({ where: { email: opts.email } });
    if (existing) {
      if (existing.status !== UserStatus.ACTIVE) {
        await prisma.user.update({ where: { id: existing.id }, data: { status: UserStatus.ACTIVE } });
      }
      return {
        id: existing.id,
        email: existing.email,
        role: existing.role,
        companyId: existing.companyId,
      };
    }
    const created = await prisma.user.create({
      data: {
        email: opts.email,
        name: opts.email,
        role: opts.role,
        companyId: opts.companyId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true, role: true, companyId: true },
    });
    return created;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: require('@nestjs/common').VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new (require('@nestjs/common').ValidationPipe)({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwt = moduleFixture.get(JwtService);

    // Find an existing contractor company so users we create are scoped to it
    const contractor = await prisma.company.findFirst({ where: { type: 'CONTRACTOR' } });
    if (!contractor) {
      throw new Error('Test seed missing — expected at least one CONTRACTOR company.');
    }

    const ca = await ensureUser({
      email: 'companyadmin@testcontractor.local',
      role: UserRole.COMPANY_ADMIN,
      companyId: contractor.id,
    });
    const foreman = await ensureUser({
      email: 'roles-e2e-foreman@testcontractor.local',
      role: UserRole.FOREMAN,
      companyId: contractor.id,
    });
    const fo = await ensureUser({
      email: 'financial@testcontractor.local',
      role: UserRole.FINANCIAL_OFFICER,
      companyId: contractor.id,
    });

    caUserId = ca.id;
    foremanUserId = foreman.id;
    foUserId = fo.id;
    caToken = await mintToken(ca);
    foremanToken = await mintToken(foreman);
    foToken = await mintToken(fo);
  });

  afterAll(async () => {
    // Clean up the test foreman; leave seed users alone
    if (foremanUserId) {
      await prisma.user.delete({ where: { id: foremanUserId } }).catch(() => undefined);
    }
    await app.close();
  });

  const auth = (token: string) =>
    (method: 'get' | 'put' | 'post', url: string) =>
      request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);

  describe('Read endpoints', () => {
    it('GET /v1/roles/permissions/catalog returns the full catalog', async () => {
      const res = await auth(caToken)('get', '/v1/roles/permissions/catalog').expect(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(50);
      expect(res.body.data.items.some((i: { key: string }) => i.key === 'rfq.read')).toBe(true);
    });

    it('GET /v1/roles returns every UserRole with a count', async () => {
      const res = await auth(caToken)('get', '/v1/roles').expect(200);
      const items: { role: string; permissionCount: number }[] = res.body.data.items;
      expect(items.length).toBe(Object.values(UserRole).length);
      expect(items.find((i) => i.role === 'SUPER_ADMIN')!.permissionCount).toBeGreaterThan(0);
    });

    it('GET /v1/roles/:role returns the role’s permission keys', async () => {
      const res = await auth(caToken)('get', '/v1/roles/VENDOR').expect(200);
      expect(res.body.data.role).toBe('VENDOR');
      expect(res.body.data.permissionKeys).toContain('dashboard.viewVendor');
    });

    it('GET /v1/roles/:role returns 404 for unknown roles', async () => {
      await auth(caToken)('get', '/v1/roles/GHOST').expect(404);
    });

    it('forbids users lacking role.list (FINANCIAL_OFFICER) from reading the catalog', async () => {
      await auth(foToken)('get', '/v1/roles/permissions/catalog').expect(403);
    });
  });

  describe('Mutation + runtime authorisation', () => {
    it('grants a permission and the next request from a user in that role succeeds', async () => {
      // 1. Baseline: foreman cannot list RFQs
      await auth(foremanToken)('get', '/v1/rfqs').expect(403);

      // 2. Grant rfq.list to FOREMAN
      const beforeRes = await auth(caToken)('get', '/v1/roles/FOREMAN').expect(200);
      const before: string[] = beforeRes.body.data.permissionKeys;
      const granted = Array.from(new Set([...before, 'rfq.list']));

      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: granted })
        .expect(200);

      // 3. Same access token, next request — now succeeds
      await auth(foremanToken)('get', '/v1/rfqs').expect(200);

      // 4. Revoke → next request denied again
      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: before })
        .expect(200);

      await auth(foremanToken)('get', '/v1/rfqs').expect(403);
    });

    it('writes a ROLE_PERMISSIONS_UPDATED audit row with added/removed diff', async () => {
      const beforeRes = await auth(caToken)('get', '/v1/roles/FOREMAN').expect(200);
      const before: string[] = beforeRes.body.data.permissionKeys;
      const granted = Array.from(new Set([...before, 'material.create']));

      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: granted })
        .expect(200);

      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'ROLE_PERMISSIONS_UPDATED',
          targetId: 'FOREMAN',
          performedById: caUserId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).not.toBeNull();
      expect(log!.metadata).toMatchObject({
        role: 'FOREMAN',
        added: ['material.create'],
        removed: [],
      });

      // Restore
      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: before })
        .expect(200);
    });

    it('skips the audit log when nothing changed', async () => {
      const beforeRes = await auth(caToken)('get', '/v1/roles/FOREMAN').expect(200);
      const before: string[] = beforeRes.body.data.permissionKeys;
      const countBefore = await prisma.auditLog.count({
        where: { action: 'ROLE_PERMISSIONS_UPDATED', targetId: 'FOREMAN' },
      });

      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: before })
        .expect(200);

      const countAfter = await prisma.auditLog.count({
        where: { action: 'ROLE_PERMISSIONS_UPDATED', targetId: 'FOREMAN' },
      });
      expect(countAfter).toBe(countBefore);
    });

    it('rejects modifying SUPER_ADMIN with 400', async () => {
      await auth(caToken)('put', '/v1/roles/SUPER_ADMIN/permissions')
        .send({ permissionKeys: [] })
        .expect(400);
    });

    it('rejects an unknown permission key with 400', async () => {
      await auth(caToken)('put', '/v1/roles/VENDOR/permissions')
        .send({ permissionKeys: ['rfq.read', 'rfq.notReal'] })
        .expect(400);
    });

    it('configures and persists a per-permission threshold (FOR-196)', async () => {
      const beforeRes = await auth(caToken)('get', '/v1/roles/FOREMAN').expect(200);
      const before: string[] = beforeRes.body.data.permissionKeys;
      const granted = Array.from(new Set([...before, 'po.approve']));

      // The dynamic-key thresholds map must pass the forbidNonWhitelisted pipe
      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: granted, thresholds: { 'po.approve': 25000 } })
        .expect(200);

      const afterRes = await auth(caToken)('get', '/v1/roles/FOREMAN').expect(200);
      expect(afterRes.body.data.thresholds['po.approve']).toBe(25000);

      // Restore — dropping po.approve also clears its threshold
      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: before })
        .expect(200);
    });

    it('rejects a threshold on a non-threshold-aware permission with 400', async () => {
      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: ['rfq.read'], thresholds: { 'rfq.read': 100 } })
        .expect(400);
    });

    it('forbids a non-admin user (FINANCIAL_OFFICER) from editing role permissions', async () => {
      await auth(foToken)('put', '/v1/roles/VENDOR/permissions')
        .send({ permissionKeys: [] })
        .expect(403);
    });
  });

  describe('Permission caching behaviour', () => {
    it('queries the DB on every request so revocation is immediate (no cache)', async () => {
      // Use a permission FOREMAN does NOT have by default so the toggle is real
      const beforeRes = await auth(caToken)('get', '/v1/roles/FOREMAN').expect(200);
      const before: string[] = beforeRes.body.data.permissionKeys;
      expect(before).not.toContain('vendor.list');
      const granted = [...before, 'vendor.list'];

      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: granted })
        .expect(200);

      // First call after grant succeeds with the same JWT
      await auth(foremanToken)('get', '/v1/vendors').expect(200);

      // Immediate revoke — next call must fail with same JWT (no cache TTL)
      await auth(caToken)('put', '/v1/roles/FOREMAN/permissions')
        .send({ permissionKeys: before })
        .expect(200);

      await auth(foremanToken)('get', '/v1/vendors').expect(403);
    });
  });
});
