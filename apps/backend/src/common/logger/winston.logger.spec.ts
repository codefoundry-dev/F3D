import { ClsService } from 'nestjs-cls';
import * as winston from 'winston';

import { WinstonLogger } from './winston.logger';

describe('WinstonLogger (production format)', () => {
  it('creates logger in production mode without errors', () => {
    const origEnv = process.env['NODE_ENV'];
    const origLevel = process.env['LOG_LEVEL'];
    process.env['NODE_ENV'] = 'production';
    delete process.env['LOG_LEVEL'];

    const mockCls = { getId: jest.fn().mockReturnValue(undefined) } as unknown as ClsService;
    const logger = new WinstonLogger(mockCls);

    // Should not throw; should create valid logger instance
    expect(logger).toBeDefined();
    logger.log('test production log');

    process.env['NODE_ENV'] = origEnv;
    if (origLevel !== undefined) process.env['LOG_LEVEL'] = origLevel;
  });

  it('uses LOG_LEVEL env var when set', () => {
    const origEnv = process.env['NODE_ENV'];
    const origLevel = process.env['LOG_LEVEL'];
    process.env['NODE_ENV'] = 'test';
    process.env['LOG_LEVEL'] = 'warn';

    const mockCls = { getId: jest.fn() } as unknown as ClsService;
    const logger = new WinstonLogger(mockCls);
    expect(logger).toBeDefined();

    process.env['NODE_ENV'] = origEnv;
    if (origLevel !== undefined) {
      process.env['LOG_LEVEL'] = origLevel;
    } else {
      delete process.env['LOG_LEVEL'];
    }
  });
});

describe('WinstonLogger', () => {
  let logger: WinstonLogger;
  let mockClsService: jest.Mocked<ClsService>;
  let mockWinstonLogger: jest.Mocked<
    Pick<winston.Logger, 'info' | 'error' | 'warn' | 'debug' | 'verbose'>
  >;

  beforeEach(() => {
    mockClsService = {
      getId: jest.fn().mockReturnValue('corr-456'),
    } as unknown as jest.Mocked<ClsService>;

    mockWinstonLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    logger = new WinstonLogger(mockClsService);

    // Replace the internal winston logger with our mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logger as any).logger = mockWinstonLogger;
  });

  describe('log', () => {
    it('should call winston info with message, context, and correlationId', () => {
      logger.log('Test message', 'TestContext');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test message', {
        context: 'TestContext',
        correlationId: 'corr-456',
      });
    });

    it('should call winston info without context when not provided', () => {
      logger.log('Test message');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test message', {
        context: undefined,
        correlationId: 'corr-456',
      });
    });
  });

  describe('error', () => {
    it('should call winston error with message, trace, context, and correlationId', () => {
      logger.error('Error occurred', 'stack trace here', 'ErrorContext');

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error occurred', {
        context: 'ErrorContext',
        trace: 'stack trace here',
        correlationId: 'corr-456',
      });
    });

    it('should call winston error without trace and context when not provided', () => {
      logger.error('Error occurred');

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error occurred', {
        context: undefined,
        trace: undefined,
        correlationId: 'corr-456',
      });
    });
  });

  describe('warn', () => {
    it('should call winston warn with message, context, and correlationId', () => {
      logger.warn('Warning message', 'WarnContext');

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Warning message', {
        context: 'WarnContext',
        correlationId: 'corr-456',
      });
    });
  });

  describe('debug', () => {
    it('should call winston debug with message, context, and correlationId', () => {
      logger.debug('Debug message', 'DebugContext');

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Debug message', {
        context: 'DebugContext',
        correlationId: 'corr-456',
      });
    });
  });

  describe('verbose', () => {
    it('should call winston verbose with message, context, and correlationId', () => {
      logger.verbose('Verbose message', 'VerboseContext');

      expect(mockWinstonLogger.verbose).toHaveBeenCalledWith('Verbose message', {
        context: 'VerboseContext',
        correlationId: 'corr-456',
      });
    });
  });

  describe('getContext (correlationId)', () => {
    it('should return empty object when ClsService throws', () => {
      mockClsService.getId.mockImplementation(() => {
        throw new Error('CLS not active');
      });

      // Should not throw; should log without correlationId
      logger.log('Test message', 'TestContext');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test message', {
        context: 'TestContext',
      });
    });

    it('should return empty object when ClsService returns falsy', () => {
      mockClsService.getId.mockReturnValue(undefined as unknown as string);

      logger.log('Test message', 'TestContext');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test message', {
        context: 'TestContext',
      });
    });
  });
});
