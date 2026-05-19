import request from 'supertest';
import {
  bootstrapTestApp,
  teardownTestApp,
  loginUser,
  SEED_USERS,
  getHttpServer,
  MockEmailService,
  authRequest,
  AuthTokens,
} from './test-helpers';
import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../../src/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailService: MockEmailService;

  let saTokens: AuthTokens;
  let caTokens: AuthTokens;
  let poTokens: AuthTokens;

  let contractorCompanyId: string;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    emailService = ctx.emailService;

    // Login all test users
    saTokens = await loginUser(SEED_USERS.superAdmin.email, SEED_USERS.superAdmin.password);
    caTokens = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
    poTokens = await loginUser(
      SEED_USERS.procurementOfficer.email,
      SEED_USERS.procurementOfficer.password,
    );

    // Get contractor company ID
    const companiesRes = await authRequest('get', '/v1/companies', saTokens.accessToken).expect(
      200,
    );
    contractorCompanyId = companiesRes.body.data.items.find(
      (c: any) => c.legalName === 'Test Contractor Pty Ltd',
    ).id;
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(() => {
    emailService.clear();
  });

  // ── GET /v1/users/me ────────────────────────────────────────────────────

  describe('GET /v1/users/me', () => {
    it('should return current user profile for SuperAdmin', async () => {
      const res = await authRequest('get', '/v1/users/me', saTokens.accessToken).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(SEED_USERS.superAdmin.email);
      expect(res.body.data.role).toBe('SUPER_ADMIN');
    });

    it('should return current user profile for CompanyAdmin', async () => {
      const res = await authRequest('get', '/v1/users/me', caTokens.accessToken).expect(200);

      expect(res.body.data.email).toBe(SEED_USERS.companyAdmin.email);
      expect(res.body.data.role).toBe('COMPANY_ADMIN');
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(getHttpServer()).get('/v1/users/me').expect(401);
    });
  });

  // ── PATCH /v1/users/me ──────────────────────────────────────────────────

  describe('PATCH /v1/users/me', () => {
    it('should update own profile fields', async () => {
      const res = await authRequest('patch', '/v1/users/me', poTokens.accessToken)
        .send({ name: 'Updated PO Name', position: 'Senior PO' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated PO Name');

      // Reset (position is NOT nullable in DB, use empty string)
      await authRequest('patch', '/v1/users/me', poTokens.accessToken)
        .send({ name: 'Procurement Officer', position: '' })
        .expect(200);
    });
  });

  // ── POST /v1/users/me/change-password ───────────────────────────────────

  describe('POST /v1/users/me/change-password', () => {
    it('should change password with correct current password', async () => {
      const foTokens = await loginUser(
        SEED_USERS.financialOfficer.email,
        SEED_USERS.financialOfficer.password,
      );

      await authRequest('post', '/v1/users/me/change-password', foTokens.accessToken)
        .send({
          currentPassword: SEED_USERS.financialOfficer.password,
          newPassword: 'NewFOPass@123',
        })
        .expect(200);

      // Should login with new password
      const newTokens = await loginUser(SEED_USERS.financialOfficer.email, 'NewFOPass@123');
      expect(newTokens.accessToken).toBeDefined();

      // Reset password back
      await authRequest('post', '/v1/users/me/change-password', newTokens.accessToken)
        .send({
          currentPassword: 'NewFOPass@123',
          newPassword: SEED_USERS.financialOfficer.password,
        })
        .expect(200);
    });

    it('should return 400 for wrong current password', async () => {
      await authRequest('post', '/v1/users/me/change-password', caTokens.accessToken)
        .send({
          currentPassword: 'WrongPassword1',
          newPassword: 'NewPass@123456',
        })
        .expect(400);
    });
  });

  // ── GET /v1/users ───────────────────────────────────────────────────────

  describe('GET /v1/users', () => {
    it('should list all users for SuperAdmin', async () => {
      const res = await authRequest('get', '/v1/users', saTokens.accessToken).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(4); // At least seed users
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(4);
    });

    it('should only return own-company users for CompanyAdmin', async () => {
      const res = await authRequest('get', '/v1/users', caTokens.accessToken).expect(200);

      expect(res.body.success).toBe(true);
      // CompanyAdmin should only see users from Test Contractor Pty Ltd
      for (const user of res.body.data.items) {
        expect(user.company.legalName || user.company.name).toContain('Test Contractor');
      }
    });

    it('should return 403 for ProcurementOfficer (not in allowed roles)', async () => {
      await authRequest('get', '/v1/users', poTokens.accessToken).expect(403);
    });

    it('should support pagination', async () => {
      const res = await authRequest('get', '/v1/users?page=1&limit=2', saTokens.accessToken).expect(
        200,
      );

      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.meta.limit).toBe(2);
    });

    it('should support search filter', async () => {
      const res = await authRequest(
        'get',
        `/v1/users?search=superadmin`,
        saTokens.accessToken,
      ).expect(200);

      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.items.some((u: any) => u.email === SEED_USERS.superAdmin.email);
      expect(found).toBe(true);
    });

    it('should support role filter', async () => {
      const res = await authRequest(
        'get',
        '/v1/users?role=COMPANY_ADMIN',
        saTokens.accessToken,
      ).expect(200);

      for (const user of res.body.data.items) {
        expect(user.role).toBe('COMPANY_ADMIN');
      }
    });

    it('should support status filter', async () => {
      const res = await authRequest('get', '/v1/users?status=INVITED', saTokens.accessToken).expect(
        200,
      );

      for (const user of res.body.data.items) {
        expect(user.status).toBe('INVITED');
      }
    });
  });

  // ── POST /v1/users ──────────────────────────────────────────────────────

  describe('POST /v1/users', () => {
    it('should create a new user as SuperAdmin', async () => {
      const res = await authRequest('post', '/v1/users', saTokens.accessToken)
        .send({
          name: 'E2E Created User',
          email: 'e2e-created-user@test.local',
          role: 'PROCUREMENT_OFFICER',
          companyId: contractorCompanyId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('e2e-created-user@test.local');
      expect(res.body.data.status).toBe('INVITED');
      expect(res.body.data.role).toBe('PROCUREMENT_OFFICER');

      // Invitation email should have been sent
      const email = emailService.getLastEmailTo('e2e-created-user@test.local');
      expect(email).toBeDefined();

      // Cleanup
      await authRequest(
        'delete',
        `/v1/users/${res.body.data.id}/invitation`,
        saTokens.accessToken,
      ).expect(200);
    });

    it('should create a user within own company as CompanyAdmin', async () => {
      const res = await authRequest('post', '/v1/users', caTokens.accessToken)
        .send({
          name: 'CA Created User',
          email: 'ca-created-user@test.local',
          role: 'FINANCIAL_OFFICER',
          companyId: contractorCompanyId,
        })
        .expect(201);

      expect(res.body.data.status).toBe('INVITED');

      // Cleanup
      await authRequest(
        'delete',
        `/v1/users/${res.body.data.id}/invitation`,
        saTokens.accessToken,
      ).expect(200);
    });

    it('should return 403 when CompanyAdmin tries to create in another company', async () => {
      // Get the platform company ID (different from contractor)
      const companiesRes = await authRequest('get', '/v1/companies', saTokens.accessToken).expect(
        200,
      );
      const platformCompany = companiesRes.body.data.items.find(
        (c: any) => c.legalName === 'Forethread Platform',
      );

      await authRequest('post', '/v1/users', caTokens.accessToken)
        .send({
          name: 'Cross-Company User',
          email: 'cross-company@test.local',
          role: 'PROCUREMENT_OFFICER',
          companyId: platformCompany.id,
        })
        .expect(403);
    });

    it('should return 409 for duplicate email', async () => {
      await authRequest('post', '/v1/users', saTokens.accessToken)
        .send({
          name: 'Duplicate User',
          email: SEED_USERS.companyAdmin.email, // Already exists
          role: 'PROCUREMENT_OFFICER',
          companyId: contractorCompanyId,
        })
        .expect(409);
    });

    it('should return 403 for ProcurementOfficer (not in allowed roles)', async () => {
      await authRequest('post', '/v1/users', poTokens.accessToken)
        .send({
          name: 'PO Created User',
          email: 'po-created-user@test.local',
          role: 'FINANCIAL_OFFICER',
          companyId: contractorCompanyId,
        })
        .expect(403);
    });
  });

  // ── GET /v1/users/:id ──────────────────────────────────────────────────

  describe('GET /v1/users/:id', () => {
    it('should return user details for SuperAdmin', async () => {
      const usersRes = await authRequest('get', '/v1/users', saTokens.accessToken).expect(200);
      const userId = usersRes.body.data.items[0].id;

      const res = await authRequest('get', `/v1/users/${userId}`, saTokens.accessToken).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userId);
    });

    it('should return 404 for non-existent user', async () => {
      await authRequest(
        'get',
        '/v1/users/00000000-0000-0000-0000-000000000000',
        saTokens.accessToken,
      ).expect(404);
    });
  });

  // ── PATCH /v1/users/:id ─────────────────────────────────────────────────

  describe('PATCH /v1/users/:id', () => {
    it('should update a user as SuperAdmin', async () => {
      // Find the PO user
      const usersRes = await authRequest(
        'get',
        `/v1/users?role=PROCUREMENT_OFFICER`,
        saTokens.accessToken,
      ).expect(200);
      const poUser = usersRes.body.data.items.find(
        (u: any) => u.email === SEED_USERS.procurementOfficer.email,
      );

      const res = await authRequest('patch', `/v1/users/${poUser.id}`, saTokens.accessToken)
        .send({ name: 'Updated PO by SA' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated PO by SA');

      // Reset
      await authRequest('patch', `/v1/users/${poUser.id}`, saTokens.accessToken)
        .send({ name: 'Procurement Officer' })
        .expect(200);
    });
  });

  // ── Deactivate / Reactivate ─────────────────────────────────────────────

  describe('User lifecycle (deactivate/reactivate)', () => {
    let testUserId: string;

    beforeAll(async () => {
      // Create a test user for lifecycle tests
      const res = await authRequest('post', '/v1/users', saTokens.accessToken)
        .send({
          name: 'Lifecycle Test User',
          email: 'lifecycle-test@test.local',
          role: 'FINANCIAL_OFFICER',
          companyId: contractorCompanyId,
        })
        .expect(201);

      testUserId = res.body.data.id;

      // Activate the user directly in DB for testing
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          status: 'ACTIVE',
          passwordHash: await require('argon2').hash('Test@123456'),
          invitationToken: null,
          invitationTokenExpiresAt: null,
        },
      });
    });

    afterAll(async () => {
      // Clean up
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    });

    it('should deactivate a user', async () => {
      emailService.clear();

      const res = await authRequest(
        'patch',
        `/v1/users/${testUserId}/deactivate`,
        saTokens.accessToken,
      ).expect(200);

      expect(res.body.data.status).toBe('INACTIVE');

      // Deactivation email should have been sent
      const email = emailService.getLastEmailTo('lifecycle-test@test.local');
      expect(email).toBeDefined();
    });

    it('should return 400 when deactivating already inactive user', async () => {
      await authRequest('patch', `/v1/users/${testUserId}/deactivate`, saTokens.accessToken).expect(
        400,
      );
    });

    it('should reactivate a deactivated user', async () => {
      const res = await authRequest(
        'patch',
        `/v1/users/${testUserId}/reactivate`,
        saTokens.accessToken,
      ).expect(200);

      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should prevent deactivating sole active CompanyAdmin', async () => {
      // The seeded CompanyAdmin is the only one in the contractor company
      const usersRes = await authRequest(
        'get',
        `/v1/users?role=COMPANY_ADMIN`,
        saTokens.accessToken,
      ).expect(200);
      const caUser = usersRes.body.data.items.find(
        (u: any) => u.email === SEED_USERS.companyAdmin.email,
      );

      const res = await authRequest(
        'patch',
        `/v1/users/${caUser.id}/deactivate`,
        saTokens.accessToken,
      ).expect(400);

      expect(res.body.error).toContain('sole active Company Admin');
    });
  });

  // ── Invitation Management ──────────────────────────────────────────────

  describe('Invitation management', () => {
    let invitedUserId: string;

    beforeEach(async () => {
      emailService.clear();
      // Create a fresh invited user
      const res = await authRequest('post', '/v1/users', saTokens.accessToken)
        .send({
          name: 'Invitation Test User',
          email: `invite-test-${Date.now()}@test.local`,
          role: 'FINANCIAL_OFFICER',
          companyId: contractorCompanyId,
        })
        .expect(201);

      invitedUserId = res.body.data.id;
    });

    afterEach(async () => {
      await prisma.user.delete({ where: { id: invitedUserId } }).catch(() => {});
    });

    it('should resend invitation for Invited user', async () => {
      emailService.clear();

      await authRequest(
        'post',
        `/v1/users/${invitedUserId}/resend-invitation`,
        saTokens.accessToken,
      ).expect(200);

      // New invitation email should have been sent
      expect(emailService.sentEmails.length).toBeGreaterThanOrEqual(1);
    });

    it('should cancel invitation for Invited user', async () => {
      await authRequest(
        'delete',
        `/v1/users/${invitedUserId}/invitation`,
        saTokens.accessToken,
      ).expect(200);

      // User record should be deleted
      const user = await prisma.user.findUnique({ where: { id: invitedUserId } });
      expect(user).toBeNull();
    });
  });
});
