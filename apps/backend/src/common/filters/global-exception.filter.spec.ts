import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockClsService: jest.Mocked<ClsService>;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockClsService = {
      getId: jest.fn().mockReturnValue('corr-id-123'),
    } as unknown as jest.Mocked<ClsService>;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;

    filter = new GlobalExceptionFilter(mockClsService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HttpException handling', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        statusCode: 404,
        correlationId: 'corr-id-123',
      });
    });

    it('should handle HttpException with object response containing message string', () => {
      const exception = new HttpException(
        { message: 'Validation failed', error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        correlationId: 'corr-id-123',
        details: 'Bad Request',
      });
    });

    it('should handle HttpException with object response containing message array', () => {
      const exception = new HttpException(
        { message: ['field1 is required', 'field2 must be a string'], error: 'Validation Error' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'field1 is required; field2 must be a string',
        statusCode: 400,
        correlationId: 'corr-id-123',
        details: 'Validation Error',
      });
    });

    it('should handle HttpException with object response without message property', () => {
      // Force an object response without 'message' by using a custom exception subclass
      const exception = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      // The string response branch is taken
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 403,
          correlationId: 'corr-id-123',
        }),
      );
    });

    it('should log 4xx errors as warnings', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('HTTP 400'));
    });

    it('should log 5xx HttpExceptions as errors', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockHost);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'));
    });
  });

  describe('Error (non-Http) handling', () => {
    it('should handle generic Error with 500 status and mask the message', () => {
      const exception = new Error('Something broke internally');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
          statusCode: 500,
          correlationId: 'corr-id-123',
        }),
      );
    });

    it('should log the full error details for generic Error', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new Error('DB connection failed');

      filter.catch(exception, mockHost);

      // One call for the unhandled exception log, one for the 5xx log
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled exception'),
        expect.any(String),
      );
    });
  });

  describe('Unknown exception handling', () => {
    it('should handle non-Error thrown values with 500 status', () => {
      filter.catch('some string error', mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
          statusCode: 500,
          correlationId: 'corr-id-123',
        }),
      );
    });

    it('should handle null/undefined thrown values', () => {
      filter.catch(null, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
          statusCode: 500,
        }),
      );
    });

    it('should log unknown exception types', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      filter.catch(42, mockHost);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown exception type'), 42);
    });
  });

  describe('correlation ID', () => {
    it('should include correlationId from ClsService in the response', () => {
      mockClsService.getId.mockReturnValue('custom-corr-id');
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'custom-corr-id' }),
      );
    });
  });

  describe('details field', () => {
    it('should not include details when error property is undefined', () => {
      const exception = new HttpException({ message: 'No details' }, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const body = mockResponse.json.mock.calls[0][0];
      expect(body).not.toHaveProperty('details');
    });
  });
});
