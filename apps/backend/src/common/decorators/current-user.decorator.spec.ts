import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { AuthenticatedUser, CurrentUser } from './current-user.decorator';

describe('CurrentUser Decorator', () => {
  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'COMPANY_ADMIN' as AuthenticatedUser['role'],
    companyId: 'company-456',
  };

  function createMockExecutionContext(user: AuthenticatedUser | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  // Extract the real factory function from the decorator metadata
  function getFactory(): (data: unknown, ctx: ExecutionContext) => unknown {
    class TestClass {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      testMethod(@CurrentUser() _user: AuthenticatedUser) {
        /* noop */
      }
    }
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
    const key = Object.keys(metadata)[0];
    return metadata[key].factory;
  }

  describe('factory function (real decorator)', () => {
    let factory: (data: unknown, ctx: ExecutionContext) => unknown;

    beforeAll(() => {
      factory = getFactory();
    });

    it('returns the full user object when no data key is provided', () => {
      const ctx = createMockExecutionContext(mockUser);
      const result = factory(undefined, ctx);
      expect(result).toEqual(mockUser);
    });

    it('returns a specific user property when data key is provided', () => {
      const ctx = createMockExecutionContext(mockUser);
      expect(factory('id', ctx)).toBe('user-123');
      expect(factory('email', ctx)).toBe('test@example.com');
      expect(factory('role', ctx)).toBe('COMPANY_ADMIN');
      expect(factory('companyId', ctx)).toBe('company-456');
    });

    it('returns undefined when user is not set and data key is provided', () => {
      const ctx = createMockExecutionContext(undefined);
      const result = factory('id', ctx);
      expect(result).toBeUndefined();
    });

    it('returns undefined when user is not set and no data key', () => {
      const ctx = createMockExecutionContext(undefined);
      const result = factory(undefined, ctx);
      expect(result).toBeUndefined();
    });
  });

  describe('decorator metadata', () => {
    it('is defined as a function (parameter decorator)', () => {
      expect(typeof CurrentUser).toBe('function');
    });

    it('is callable with a data key', () => {
      expect(typeof CurrentUser('id')).toBe('function');
    });

    it('is callable without a data key', () => {
      expect(typeof CurrentUser()).toBe('function');
    });
  });
});
