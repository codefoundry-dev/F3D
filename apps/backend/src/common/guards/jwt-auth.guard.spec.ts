import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from './jwt-auth.guard';

// Mock AuthGuard to provide a testable base class
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => {
    class MockAuthGuard {
      canActivate(_context: ExecutionContext): boolean {
        return true; // default passport behavior (will be spied on)
      }
    }
    return MockAuthGuard;
  },
}));

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new JwtAuthGuard(reflector);
  });

  function createMockContext(): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('should return true for public routes (decorated with @Public())', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should call super.canActivate for non-public routes', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext();

      // super.canActivate returns true from our mock
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should call super.canActivate when isPublic is undefined', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('handleRequest', () => {
    it('should return the user when user is valid and no error', () => {
      const user = { id: 'user-1', email: 'test@test.com' };

      const result = guard.handleRequest(null, user);

      expect(result).toBe(user);
    });

    it('should throw the original error when err is provided', () => {
      const error = new Error('Token expired');

      expect(() => guard.handleRequest(error, false)).toThrow(error);
    });

    it('should throw UnauthorizedException when user is false and no error', () => {
      expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, false)).toThrow('Authentication required');
    });

    it('should throw the error even when user is truthy if err is provided', () => {
      const error = new Error('Some auth error');
      const user = { id: 'user-1' };

      expect(() => guard.handleRequest(error, user)).toThrow(error);
    });
  });
});
