import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { of, throwError } from 'rxjs';

import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockClsService: jest.Mocked<ClsService>;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockClsService = {
      getId: jest.fn().mockReturnValue('corr-123'),
    } as unknown as jest.Mocked<ClsService>;

    interceptor = new LoggingInterceptor(mockClsService);

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createMockContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/test',
          ip: '127.0.0.1',
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  function createCallHandler(response: unknown): CallHandler {
    return {
      handle: () => of(response),
    };
  }

  function createErrorCallHandler(error: Error): CallHandler {
    return {
      handle: () => throwError(() => error),
    };
  }

  it('should log request details on successful response', (done) => {
    const context = createMockContext();
    const handler = createCallHandler({ data: 'test' });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(logSpy).toHaveBeenCalledTimes(1);
        const loggedMessage = logSpy.mock.calls[0][0];
        const parsed = JSON.parse(loggedMessage);

        expect(parsed.method).toBe('GET');
        expect(parsed.url).toBe('/api/test');
        expect(parsed.statusCode).toBe(200);
        expect(parsed.correlationId).toBe('corr-123');
        expect(parsed.ip).toBe('127.0.0.1');
        expect(typeof parsed.duration_ms).toBe('number');
        done();
      },
    });
  });

  it('should log warning on error response', (done) => {
    const context = createMockContext();
    const handler = createErrorCallHandler(new Error('fail'));

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const loggedMessage = warnSpy.mock.calls[0][0];
        const parsed = JSON.parse(loggedMessage);

        expect(parsed.method).toBe('GET');
        expect(parsed.url).toBe('/api/test');
        expect(parsed.correlationId).toBe('corr-123');
        expect(typeof parsed.duration_ms).toBe('number');
        done();
      },
    });
  });

  it('should pass through the response data unchanged', (done) => {
    const context = createMockContext();
    const responseData = { id: 1, name: 'test' };
    const handler = createCallHandler(responseData);

    interceptor.intercept(context, handler).subscribe({
      next: (value) => {
        expect(value).toEqual(responseData);
        done();
      },
    });
  });
});
