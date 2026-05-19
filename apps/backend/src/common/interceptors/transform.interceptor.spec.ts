import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
    mockContext = {} as ExecutionContext;
  });

  function createCallHandler(response: unknown): CallHandler {
    return {
      handle: () => of(response),
    };
  }

  it('should wrap plain data in { success: true, data } format', (done) => {
    const handler = createCallHandler({ id: 1, name: 'Test' });

    interceptor.intercept(mockContext, handler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: { id: 1, name: 'Test' },
        });
        done();
      },
    });
  });

  it('should wrap primitive data', (done) => {
    const handler = createCallHandler('hello');

    interceptor.intercept(mockContext, handler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: 'hello',
        });
        done();
      },
    });
  });

  it('should wrap null data', (done) => {
    const handler = createCallHandler(null);

    interceptor.intercept(mockContext, handler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: null,
        });
        done();
      },
    });
  });

  it('should wrap array data', (done) => {
    const handler = createCallHandler([1, 2, 3]);

    interceptor.intercept(mockContext, handler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: [1, 2, 3],
        });
        done();
      },
    });
  });

  it('should pass through data that already has a "success" property', (done) => {
    const alreadyWrapped = { success: true, data: { id: 1 }, meta: { page: 1 } };
    const handler = createCallHandler(alreadyWrapped);

    interceptor.intercept(mockContext, handler).subscribe({
      next: (result) => {
        expect(result).toEqual(alreadyWrapped);
        // Should not double-wrap
        expect(result).not.toHaveProperty('data.success');
        done();
      },
    });
  });

  it('should pass through error responses that have "success: false"', (done) => {
    const errorResponse = { success: false, error: 'Not found', statusCode: 404 };
    const handler = createCallHandler(errorResponse);

    interceptor.intercept(mockContext, handler).subscribe({
      next: (result) => {
        expect(result).toEqual(errorResponse);
        done();
      },
    });
  });

  it('should wrap undefined data', (done) => {
    const handler = createCallHandler(undefined);

    interceptor.intercept(mockContext, handler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: undefined,
        });
        done();
      },
    });
  });
});
