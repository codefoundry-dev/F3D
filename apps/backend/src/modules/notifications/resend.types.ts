export type ResendSendStatus = 'queued' | 'sent' | 'error';

export type ResendErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_KEY'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UNKNOWN';

export interface ResendAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface ResendSendOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  attachments?: ResendAttachment[];
  headers?: Record<string, string>;
}

export interface ResendSendSuccess {
  status: 'queued' | 'sent';
  id: string;
}

export interface ResendSendFailure {
  status: 'error';
  code: ResendErrorCode;
  message: string;
}

export type ResendSendResult = ResendSendSuccess | ResendSendFailure;
