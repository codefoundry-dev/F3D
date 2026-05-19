import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedUser } from '../decorators/current-user.decorator';

import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  function createMockContext(user?: AuthenticatedUser): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'COMPANY_ADMIN' as AuthenticatedUser['role'],
    companyId: 'company-1',
  };

  describe('no roles required', () => {
    it('should return true when no @Roles() decorator is present (undefined)', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockContext(mockUser);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should return true when @Roles() decorator has empty array', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockContext(mockUser);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('matching role', () => {
    it('should return true when user has one of the required roles', () => {
      reflector.getAllAndOverride.mockReturnValue(['COMPANY_ADMIN', 'SUPER_ADMIN']);
      const context = createMockContext(mockUser);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should return true when user has the exact single required role', () => {
      reflector.getAllAndOverride.mockReturnValue(['COMPANY_ADMIN']);
      const context = createMockContext(mockUser);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('non-matching role', () => {
    it('should throw ForbiddenException when user role does not match', () => {
      reflector.getAllAndOverride.mockReturnValue(['SUPER_ADMIN']);
      const context = createMockContext(mockUser);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Access denied. Required role(s): SUPER_ADMIN',
      );
    });

    it('should include all required roles in the error message', () => {
      reflector.getAllAndOverride.mockReturnValue(['SUPER_ADMIN', 'VENDOR']);
      const context = createMockContext(mockUser);

      expect(() => guard.canActivate(context)).toThrow(
        'Access denied. Required role(s): SUPER_ADMIN, VENDOR',
      );
    });
  });

  describe('no user on request', () => {
    it('should throw ForbiddenException when user is not present', () => {
      reflector.getAllAndOverride.mockReturnValue(['COMPANY_ADMIN']);
      const context = createMockContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Access denied');
    });
  });

  describe('reflector usage', () => {
    it('should call reflector with ROLES_KEY and handler/class', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockContext(mockUser);

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});
