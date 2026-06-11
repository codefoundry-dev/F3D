import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend, type CreateEmailOptions, type ErrorResponse } from 'resend';

import type {
  ResendErrorCode,
  ResendSendFailure,
  ResendSendOptions,
  ResendSendResult,
} from './resend.types';

/**
 * Error codes worth retrying: a rate-limit (Resend allows ~2 requests/second by
 * default, so a burst of vendor invitations trips it) or a transient upstream
 * blip. Retrying these — rather than silently dropping the email — is what keeps
 * one vendor in a multi-recipient send from vanishing. Client errors
 * (INVALID_KEY / INVALID_REQUEST / NOT_CONFIGURED) are deterministic and never
 * retried.
 */
const RETRYABLE_CODES: ReadonlySet<ResendErrorCode> = new Set(['RATE_LIMITED', 'UPSTREAM_ERROR']);

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly apiKey: string;
  private readonly defaultFrom: string;
  private readonly client: Resend | null;
  /** Retries attempted after the first try before giving up. */
  private readonly maxRetries: number;
  /** First backoff delay; doubles each retry (500ms → 1s → 2s by default). */
  private readonly retryBaseMs: number;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY', '');
    this.defaultFrom = config.get<string>('RESEND_FROM', 'noreply@forethread.local');
    this.client = this.apiKey ? new Resend(this.apiKey) : null;
    this.maxRetries = config.get<number>('RESEND_MAX_RETRIES', 3);
    this.retryBaseMs = config.get<number>('RESEND_RETRY_BASE_MS', 500);
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
      ...(options.cc ? { cc: options.cc } : {}),
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

    // Attempt once, then retry transient failures with exponential backoff. A
    // rate-limited send waits out Resend's per-second window and almost always
    // succeeds on the next try instead of being silently dropped.
    const client = this.client;
    let lastFailure: ResendSendFailure = this.failure('UNKNOWN', 'Resend send was not attempted');
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const result = await this.attemptSend(client, payload);
      if (result.status !== 'error') {
        return result;
      }

      lastFailure = result;
      if (!RETRYABLE_CODES.has(result.code) || attempt === this.maxRetries) {
        return result;
      }

      const backoffMs = this.retryBaseMs * 2 ** attempt;
      this.logger.warn(
        `Resend send failed [${result.code}]: ${result.message} — retry ${attempt + 1}/${this.maxRetries} in ${backoffMs}ms`,
      );
      await this.delay(backoffMs);
    }

    return lastFailure;
  }

  /** A single Resend dispatch, mapping the SDK response into our result union. */
  private async attemptSend(
    client: Resend,
    payload: CreateEmailOptions,
  ): Promise<ResendSendResult> {
    try {
      const response = await client.emails.send(payload);

      if (response.error || !response.data) {
        return this.mapApiError(response.error);
      }

      this.logger.debug(`Resend send accepted: id=${response.data.id}`);
      return { status: 'queued', id: response.data.id };
    } catch (err) {
      return this.mapThrown(err);
    }
  }

  /** Promised setTimeout — isolated so tests can drive it with a zero base delay. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
