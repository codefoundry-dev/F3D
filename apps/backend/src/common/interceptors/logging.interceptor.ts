import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const correlationId = this.cls.getId();
    const startTime = Date.now();

    const { method, url, ip } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            JSON.stringify({
              method,
              url,
              statusCode: response.statusCode,
              duration_ms: duration,
              correlationId,
              ip,
            }),
          );
        },
        error: () => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            JSON.stringify({
              method,
              url,
              statusCode: response.statusCode,
              duration_ms: duration,
              correlationId,
              ip,
            }),
          );
        },
      }),
    );
  }
}
