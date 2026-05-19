import { Global, Injectable, LoggerService, Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

function createWinstonLogger(): winston.Logger {
  const isProduction = process.env['NODE_ENV'] === 'production';

  return winston.createLogger({
    level: process.env['LOG_LEVEL'] ?? (isProduction ? 'info' : 'debug'),
    format: isProduction
      ? combine(errors({ stack: true }), timestamp(), json())
      : combine(errors({ stack: true }), timestamp(), colorize(), simple()),
    transports: [new winston.transports.Console()],
    exitOnError: false,
  });
}

@Injectable()
export class WinstonLogger implements LoggerService {
  private readonly logger: winston.Logger;

  constructor(private readonly cls: ClsService) {
    this.logger = createWinstonLogger();
  }

  private getContext(): Record<string, unknown> {
    try {
      const correlationId = this.cls.getId();
      return correlationId ? { correlationId } : {};
    } catch {
      return {};
    }
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context, ...this.getContext() });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { context, trace, ...this.getContext() });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context, ...this.getContext() });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context, ...this.getContext() });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context, ...this.getContext() });
  }
}

@Global()
@Module({
  providers: [WinstonLogger],
  exports: [WinstonLogger],
})
export class WinstonLoggerModule {}
