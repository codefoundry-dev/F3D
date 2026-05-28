import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend, type CreateEmailOptions, type ErrorResponse } from 'resend';

import type {
  ResendErrorCode,
  ResendSendFailure,
  ResendSendOptions,
  ResendSendResult,
} from './resend.types';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly apiKey: string;
  private readonly defaultFrom: string;
  private readonly client: Resend | null;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY', '');
    this.defaultFrom = config.get<string>('RESEND_FROM', 'noreply@forethread.local');
    this.client = this.apiKey ? new Resend(this.apiKey) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async send(options: ResendSendOptions): Promise<ResendSendResult> {
    if (!this.client) {
      return this.failure('NOT_CONFIGURED', 'RESEND_API_KEY is not set');
    }

    if (!options.html && !options.text) {
      return this.failure('INVALID_REQUEST', 'Resend send requires either html or text content');
    }

    const payload: CreateEmailOptions = {
      from: options.from ?? this.defaultFrom,
      to: options.to,
      subject: options.subject,
      ...(options.html ? { html: options.html } : {}),
      ...(options.text ? { text: options.text } : {}),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.attachments
        ? {
            attachments: options.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              ...(a.contentType ? { contentType: a.contentType } : {}),
            })),
          }
        : {}),
    } as CreateEmailOptions;

    try {
      const response = await this.client.emails.send(payload);

      if (response.error || !response.data) {
        const failure = this.mapApiError(response.error);
        this.logger.warn(`Resend send failed [${failure.code}]: ${failure.message}`);
        return failure;
      }

      this.logger.debug(`Resend send accepted: id=${response.data.id}`);
      return { status: 'queued', id: response.data.id };
    } catch (err) {
      const failure = this.mapThrown(err);
      this.logger.error(`Resend send threw [${failure.code}]: ${failure.message}`);
      return failure;
    }
  }

  private mapApiError(error: ErrorResponse | null): ResendSendFailure {
    if (!error) {
      return this.failure('UNKNOWN', 'Resend returned no data and no error');
    }
    return this.failure(this.classifyErrorName(error.name), error.message);
  }

  private mapThrown(err: unknown): ResendSendFailure {
    const message = err instanceof Error ? err.message : String(err);
    return this.failure('UPSTREAM_ERROR', message);
  }

  private classifyErrorName(name: ErrorResponse['name'] | undefined): ResendErrorCode {
    switch (name) {
      case 'missing_api_key':
      case 'invalid_api_key':
      case 'restricted_api_key':
        return 'INVALID_KEY';
      case 'validation_error':
      case 'missing_required_field':
      case 'invalid_from_address':
      case 'invalid_attachment':
      case 'invalid_parameter':
        return 'INVALID_REQUEST';
      case 'rate_limit_exceeded':
      case 'daily_quota_exceeded':
      case 'monthly_quota_exceeded':
        return 'RATE_LIMITED';
      case 'application_error':
      case 'internal_server_error':
        return 'UPSTREAM_ERROR';
      default:
        return 'UPSTREAM_ERROR';
    }
  }

  private failure(code: ResendErrorCode, message: string): ResendSendFailure {
    return { status: 'error', code, message };
  }
}
