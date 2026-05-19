import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ClsService } from 'nestjs-cls';

interface ErrorResponseBody {
  success: false;
  error: string;
  statusCode: number;
  correlationId?: string;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const correlationId = this.cls.getId();

    let status: number;
    let message: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const msg = (exceptionResponse as Record<string, unknown>)['message'];
        message = Array.isArray(msg) ? msg.join('; ') : String(msg);
        details =
          (exceptionResponse as Record<string, unknown>)['error'] ?? undefined;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      // Log the full error for 5xx — never expose internals to clients
      this.logger.error(
        `Unhandled exception [${correlationId}]: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      this.logger.error(`Unknown exception type [${correlationId}]:`, exception);
    }

    // Log 5xx as errors, 4xx as warnings
    if (status >= 500) {
      this.logger.error(`HTTP ${String(status)} [${correlationId}]: ${message}`);
    } else if (status >= 400) {
      this.logger.warn(`HTTP ${String(status)} [${correlationId}]: ${message}`);
    }

    const body: ErrorResponseBody = {
      success: false,
      error: message,
      statusCode: status,
      correlationId,
      ...(details !== undefined && { details }),
    };

    response.status(status).json(body);
  }
}
