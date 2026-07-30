import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../decorators/current-user.decorator';

import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let permissions: jest.Mocked<PermissionsService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: UserRole.COMPANY_ADMIN,
    companyId: 'company-1',
  };

  function ctx(user?: AuthenticatedUser): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    permissions = {
      getPermissionsForUser: jest.fn(),
      roleHasPermission: jest.fn(),
    } as unknown as jest.Mocked<PermissionsService>;
    guard = new PermissionsGuard(reflector, permissions);
  });

  it('allows the request when no @RequirePermissions metadata is set', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(ctx(mockUser))).resolves.toBe(true);
    expect(permissions.getPermissionsForUser).not.toHaveBeenCalled();
  });

  it('allows the request when the user role has every required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['rfq.create']);
    permissions.getPermissionsForUser.mockResolvedValue(new Set(['rfq.create', 'rfq.read']));

    await expect(guard.canActivate(ctx(mockUser))).resolves.toBe(true);
  });

  it('returns 403 when a single required permission is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(['po.approve']);
    permissions.getPermissionsForUser.mockResolvedValue(new Set(['po.read']));

    await expect(guard.canActivate(ctx(mockUser))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx(mockUser))).rejects.toThrow(/po\.approve/);
  });

  it('returns 403 when any required permission is missing (AND semantics)', async () => {
    reflector.getAllAndOverride.mockReturnValue(['po.approve', 'po.update']);
    permissions.getPermissionsForUser.mockResolvedValue(new Set(['po.approve']));

    await expect(guard.canActivate(ctx(mockUser))).rejects.toThrow(/po\.update/);
  });

  it('returns 403 when no authenticated user is on the request', async () => {
    reflector.getAllAndOverride.mockReturnValue(['rfq.create']);
    await expect(guard.canActivate(ctx(undefined))).rejects.toThrow(ForbiddenException);
  });

  it('passes the whole user (incl. customRoleId) to permission resolution (FOR-253)', async () => {
    reflector.getAllAndOverride.mockReturnValue(['po.read']);
    permissions.getPermissionsForUser.mockResolvedValue(new Set(['po.read']));
    const assigned: AuthenticatedUser = { ...mockUser, customRoleId: 'cr-1' };

    await expect(guard.canActivate(ctx(assigned))).resolves.toBe(true);
    expect(permissions.getPermissionsForUser).toHaveBeenCalledWith(assigned);
  });

  it('queries the DB on every call so revoking a permission denies the next request', async () => {
    reflector.getAllAndOverride.mockReturnValue(['rfq.create']);
    permissions.getPermissionsForUser
      .mockResolvedValueOnce(new Set(['rfq.create']))
      .mockResolvedValueOnce(new Set());

    await expect(guard.canActivate(ctx(mockUser))).resolves.toBe(true);
    await expect(guard.canActivate(ctx(mockUser))).rejects.toThrow(ForbiddenException);
    expect(permissions.getPermissionsForUser).toHaveBeenCalledTimes(2);
  });
});
