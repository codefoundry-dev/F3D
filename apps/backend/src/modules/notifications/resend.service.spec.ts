const mockSend = jest.fn();
const mockResendCtor = jest.fn().mockImplementation(() => ({
  emails: { send: mockSend },
}));

jest.mock('resend', () => ({
  Resend: mockResendCtor,
}));

import { ConfigService } from '@nestjs/config';

import { ResendService } from './resend.service';

const buildConfig = (overrides: Record<string, unknown> = {}): jest.Mocked<ConfigService> =>
  ({
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM: 'sender@forethread.test',
        ...overrides,
      };
      return key in config ? config[key] : defaultValue;
    }),
  }) as unknown as jest.Mocked<ConfigService>;

describe('ResendService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('returns true when RESEND_API_KEY is set', () => {
      const service = new ResendService(buildConfig());
      expect(service.isConfigured()).toBe(true);
      expect(mockResendCtor).toHaveBeenCalledWith('re_test_key');
    });

    it('returns false when RESEND_API_KEY is empty', () => {
      const service = new ResendService(buildConfig({ RESEND_API_KEY: '' }));
      expect(service.isConfigured()).toBe(false);
      expect(mockResendCtor).not.toHaveBeenCalled();
    });
  });

  describe('send — guard rails', () => {
    it('returns NOT_CONFIGURED when API key is missing without calling the SDK', async () => {
      const service = new ResendService(buildConfig({ RESEND_API_KEY: '' }));

      const result = await service.send({
        to: 'user@test.com',
        subject: 'hi',
        html: '<p>hi</p>',
      });

      expect(result).toEqual({
        status: 'error',
        code: 'NOT_CONFIGURED',
        message: 'RESEND_API_KEY is not set',
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('returns INVALID_REQUEST when neither html nor text is provided', async () => {
      const service = new ResendService(buildConfig());

      const result = await service.send({
        to: 'user@test.com',
        subject: 'hi',
      });

      expect(result).toEqual({
        status: 'error',
        code: 'INVALID_REQUEST',
        message: 'Resend send requires either html or text content',
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('send — success', () => {
    it('returns status=queued with the Resend id on success', async () => {
      mockSend.mockResolvedValue({ data: { id: 'msg_abc123' }, error: null });
      const service = new ResendService(buildConfig());

      const result = await service.send({
        to: 'user@test.com',
        subject: 'hello',
        html: '<p>hello</p>',
      });

      expect(result).toEqual({ status: 'queued', id: 'msg_abc123' });
    });

    it('uses RESEND_FROM as the default sender address', async () => {
      mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
      const service = new ResendService(buildConfig());

      await service.send({ to: 'user@test.com', subject: 's', text: 'plain' });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'sender@forethread.test' }),
      );
    });

    it('honours an explicit from override', async () => {
      mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
      const service = new ResendService(buildConfig());

      await service.send({
        from: 'Custom <override@forethread.test>',
        to: 'user@test.com',
        subject: 's',
        html: '<p>x</p>',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'Custom <override@forethread.test>' }),
      );
    });

    it('passes through replyTo, headers, and attachments', async () => {
      mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
      const service = new ResendService(buildConfig());
      const pdf = Buffer.from('fake-pdf');

      await service.send({
        to: 'user@test.com',
        subject: 's',
        html: '<p>x</p>',
        replyTo: 'reply@forethread.test',
        headers: { 'X-Trace-Id': 'trace-1' },
        attachments: [{ filename: 'po.pdf', content: pdf, contentType: 'application/pdf' }],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'reply@forethread.test',
          headers: { 'X-Trace-Id': 'trace-1' },
          attachments: [{ filename: 'po.pdf', content: pdf, contentType: 'application/pdf' }],
        }),
      );
    });

    it('omits attachments key when none are supplied', async () => {
      mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
      const service = new ResendService(buildConfig());

      await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      const payload = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('attachments');
      expect(payload).not.toHaveProperty('replyTo');
      expect(payload).not.toHaveProperty('headers');
    });
  });

  describe('send — error handling', () => {
    it('maps invalid_api_key to INVALID_KEY', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { name: 'invalid_api_key', message: 'API key is invalid', statusCode: 401 },
      });
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toEqual({
        status: 'error',
        code: 'INVALID_KEY',
        message: 'API key is invalid',
      });
    });

    it('maps validation_error to INVALID_REQUEST', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { name: 'validation_error', message: 'Subject is required', statusCode: 422 },
      });
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toEqual({
        status: 'error',
        code: 'INVALID_REQUEST',
        message: 'Subject is required',
      });
    });

    it('maps invalid_from_address to INVALID_REQUEST', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { name: 'invalid_from_address', message: 'Sender not verified', statusCode: 422 },
      });
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toMatchObject({ status: 'error', code: 'INVALID_REQUEST' });
    });

    it('maps rate_limit_exceeded to RATE_LIMITED', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 },
      });
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toMatchObject({ status: 'error', code: 'RATE_LIMITED' });
    });

    it('maps daily_quota_exceeded to RATE_LIMITED', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { name: 'daily_quota_exceeded', message: 'Quota exhausted', statusCode: 429 },
      });
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toMatchObject({ status: 'error', code: 'RATE_LIMITED' });
    });

    it('maps internal_server_error to UPSTREAM_ERROR', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { name: 'internal_server_error', message: 'Boom', statusCode: 500 },
      });
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toMatchObject({ status: 'error', code: 'UPSTREAM_ERROR' });
    });

    it('maps unrecognised error names to UPSTREAM_ERROR', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { name: 'something_new', message: 'Unrecognised', statusCode: 500 },
      });
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toMatchObject({ status: 'error', code: 'UPSTREAM_ERROR' });
    });

    it('returns UNKNOWN when SDK returns neither data nor error', async () => {
      mockSend.mockResolvedValue({ data: null, error: null });
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toEqual({
        status: 'error',
        code: 'UNKNOWN',
        message: 'Resend returned no data and no error',
      });
    });

    it('catches thrown exceptions and maps them to UPSTREAM_ERROR', async () => {
      mockSend.mockRejectedValue(new Error('network down'));
      const service = new ResendService(buildConfig());

      const result = await service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });

      expect(result).toEqual({
        status: 'error',
        code: 'UPSTREAM_ERROR',
        message: 'network down',
      });
    });

    it('does not throw when SDK rejects — wrapper always resolves with a status', async () => {
      mockSend.mockRejectedValue(new Error('connection refused'));
      const service = new ResendService(buildConfig());

      await expect(
        service.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' }),
      ).resolves.toMatchObject({ status: 'error' });
    });
  });
});
