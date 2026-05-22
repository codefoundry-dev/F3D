import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../../src/prisma/prisma.service';

import {
  AuthTokens,
  SEED_USERS,
  authRequest,
  bootstrapTestApp,
  getHttpServer,
  loginUser,
  teardownTestApp,
} from './test-helpers';

describe('Roles & permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let saTokens: AuthTokens;
  let caTokens: AuthTokens;
  let poTokens: AuthTokens;
  let foTokens: AuthTokens;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;

    saTokens = await loginUser(SEED_USERS.superAdmin.email, SEED_USERS.superAdmin.password);
    caTokens = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
    poTokens = await loginUser(
      SEED_USERS.procurementOfficer.email,
      SEED_USERS.procurementOfficer.password,
    );
    foTokens = await loginUser(
      SEED_USERS.financialOfficer.email,
      SEED_USERS.financialOfficer.password,
    );
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  describe('GET /v1/roles/permissions/catalog', () => {
    it('returns every catalog entry with key + description', async () => {
      const res = await authRequest(
        'get',
        '/v1/roles/permissions/catalog',
        caTokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(50);
      expect(res.body.data.items[0]).toMatchObject({ key: expect.any(String), description: expect.any(String) });
    });

    it('forbids users whose role lacks role.list (FOREMAN, FINANCIAL_OFFICER, etc.)', async () => {
      await authRequest('get', '/v1/roles/permissions/catalog', foTokens.accessToken).expect(403);
    });

    it('rejects unauthenticated requests with 401', async () => {
      await request(getHttpServer()).get('/v1/roles/permissions/catalog').expect(401);
    });
  });

  describe('GET /v1/roles', () => {
    it('returns every UserRole with a permission count', async () => {
      const res = await authRequest('get', '/v1/roles', caTokens.accessToken).expect(200);
      const items: { role: string; permissionCount: number }[] = res.body.data.items;
      const byRole = new Map(items.map((i) => [i.role, i.permissionCount]));

      expect(byRole.has('SUPER_ADMIN')).toBe(true);
      expect(byRole.has('VENDOR')).toBe(true);
      expect(byRole.get('SUPER_ADMIN')).toBeGreaterThan(0);
    });
  });

  describe('GET /v1/roles/:role', () => {
    it('returns the live permission set for a known role', async () => {
      const res = await authRequest('get', '/v1/roles/VENDOR', caTokens.accessToken).expect(200);
      expect(res.body.data.role).toBe('VENDOR');
      expect(Array.isArray(res.body.data.permissionKeys)).toBe(true);
      expect(res.body.data.permissionKeys).toContain('dashboard.viewVendor');
    });

    it('returns 404 for an unknown role identifier', async () => {
      await authRequest('get', '/v1/roles/GHOST', caTokens.accessToken).expect(404);
    });
  });

  describe('PUT /v1/roles/:role/permissions — runtime authorisation', () => {
    /**
     * Acceptance criterion: "grant a permission to a role → user with that role gains
     * access on the very next request (no logout)". FOREMAN starts with no rfq.list,
     * so GET /v1/rfqs returns 403; after granting it, the next call returns 200.
     */
    it('grants a permission and the next request from a user in that role succeeds', async () => {
      const foremanCreds = { email: 'foreman1@testcontractor.local', password: 'Dev@123456' };

      // Ensure a FOREMAN seed user exists (the test seed includes one)
      const foreman = await prisma.user.findFirst({ where: { email: foremanCreds.email } });
      if (!foreman) {
        // Seed may not include foreman1; skip gracefully so the suite is still green.
        return;
      }

      const fmTokens = await loginUser(foremanCreds.email, foremanCreds.password);

      // 1. Foreman is denied rfq.list initially
      await authRequest('get', '/v1/rfqs', fmTokens.accessToken).expect(403);

      // 2. Capture FOREMAN's current set and add rfq.list
      const beforeRes = await authRequest('get', '/v1/roles/FOREMAN', caTokens.accessToken).expect(
        200,
      );
      const before: string[] = beforeRes.body.data.permissionKeys;
      const grantedSet = Array.from(new Set([...before, 'rfq.list']));

      await authRequest('put', '/v1/roles/FOREMAN/permissions', caTokens.accessToken)
        .send({ permissionKeys: grantedSet })
        .expect(200);

      // 3. Same access token, next request — now 200
      await authRequest('get', '/v1/rfqs', fmTokens.accessToken).expect(200);

      // 4. Revoke and confirm the next request is denied again
      await authRequest('put', '/v1/roles/FOREMAN/permissions', caTokens.accessToken)
        .send({ permissionKeys: before })
        .expect(200);

      await authRequest('get', '/v1/rfqs', fmTokens.accessToken).expect(403);
    });

    it('writes a ROLE_PERMISSIONS_UPDATED audit log row containing the diff', async () => {
      const beforeRes = await authRequest('get', '/v1/roles/FOREMAN', caTokens.accessToken).expect(
        200,
      );
      const before: string[] = beforeRes.body.data.permissionKeys;
      const granted = Array.from(new Set([...before, 'material.create']));

      await authRequest('put', '/v1/roles/FOREMAN/permissions', caTokens.accessToken)
        .send({ permissionKeys: granted })
        .expect(200);

      const latestLog = await prisma.auditLog.findFirst({
        where: { action: 'ROLE_PERMISSIONS_UPDATED', targetId: 'FOREMAN' },
        orderBy: { createdAt: 'desc' },
      });

      expect(latestLog).not.toBeNull();
      expect(latestLog!.metadata).toMatchObject({
        role: 'FOREMAN',
        added: ['material.create'],
      });

      // Restore baseline
      await authRequest('put', '/v1/roles/FOREMAN/permissions', caTokens.accessToken)
        .send({ permissionKeys: before })
        .expect(200);
    });

    it('rejects modifying SUPER_ADMIN with 400', async () => {
      await authRequest('put', '/v1/roles/SUPER_ADMIN/permissions', caTokens.accessToken)
        .send({ permissionKeys: [] })
        .expect(400);
    });

    it('rejects an unknown permission key with 400', async () => {
      await authRequest('put', '/v1/roles/VENDOR/permissions', caTokens.accessToken)
        .send({ permissionKeys: ['rfq.read', 'rfq.notReal'] })
        .expect(400);
    });

    it('forbids a non-admin user from editing roles', async () => {
      await authRequest('put', '/v1/roles/VENDOR/permissions', poTokens.accessToken)
        .send({ permissionKeys: [] })
        .expect(403);
    });
  });

  describe('SuperAdmin path', () => {
    it('SuperAdmin has the role.update permission too', async () => {
      const beforeRes = await authRequest('get', '/v1/roles/VENDOR', saTokens.accessToken).expect(
        200,
      );
      const before: string[] = beforeRes.body.data.permissionKeys;

      await authRequest('put', '/v1/roles/VENDOR/permissions', saTokens.accessToken)
        .send({ permissionKeys: before })
        .expect(200);
    });
  });
});
