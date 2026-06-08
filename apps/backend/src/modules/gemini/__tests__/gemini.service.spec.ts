import { ConfigService } from '@nestjs/config';

import { GeminiService } from '../gemini.service';
import { GeminiError } from '../gemini.types';

const originalFetch = global.fetch;

function createService(env: Partial<Record<string, string>> = {}): GeminiService {
  const map: Record<string, string> = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_TIMEOUT_MS: '1000',
    ...env,
  };
  const config = {
    get: jest.fn((key: string, defaultValue?: string) => (key in map ? map[key] : defaultValue)),
  } as unknown as ConfigService;
  return new GeminiService(config);
}

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function errorResponse(status: number, message = 'oops'): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
    text: () => Promise.resolve(JSON.stringify({ error: { message } })),
  } as Response;
}

describe('GeminiService', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('returns false when no API key is set', () => {
      const service = createService({ GEMINI_API_KEY: '' });
      expect(service.isConfigured()).toBe(false);
    });

    it('returns true when API key is set', () => {
      const service = createService();
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('generate — happy path', () => {
    it('sends prompt + inline document and returns parsed text', async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue(
        okJson({
          candidates: [{ content: { parts: [{ text: 'Hello, world.' }] } }],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: 16 },
        }),
      );

      const result = await service.generate({
        prompt: 'Describe this PDF.',
        documents: [{ mimeType: 'application/pdf', data: Buffer.from('PDF-bytes') }],
      });

      expect(result.text).toBe('Hello, world.');
      expect(result.model).toBe('gemini-2.5-flash');
      expect(result.usage?.totalTokenCount).toBe(16);

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      );
      const headers = (init.headers ?? {}) as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe('test-key');
      const body = JSON.parse(init.body as string);
      expect(body.contents[0].parts[0]).toEqual({ text: 'Describe this PDF.' });
      expect(body.contents[0].parts[1]).toEqual({
        inlineData: {
          mimeType: 'application/pdf',
          data: Buffer.from('PDF-bytes').toString('base64'),
        },
      });
    });

    it('respects an overridden model on a per-call basis', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));

      await service.generate({ prompt: 'hi', model: 'gemini-2.5-pro' });

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('gemini-2.5-pro:generateContent');
    });

    it('forwards generationConfig (e.g. JSON mode) when provided', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }));

      await service.generate({
        prompt: 'json please',
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.generationConfig).toEqual({
        temperature: 0,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      });
    });

    it('disables thinking by default even when no generationConfig is passed', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));

      await service.generate({ prompt: 'hi' });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.generationConfig).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
    });

    it('honours a positive GEMINI_THINKING_BUDGET cap', async () => {
      const service = createService({ GEMINI_THINKING_BUDGET: '512' });
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));

      await service.generate({ prompt: 'hi' });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 512 });
    });

    it('leaves thinkingConfig unset (dynamic) when GEMINI_THINKING_BUDGET is -1', async () => {
      const service = createService({ GEMINI_THINKING_BUDGET: '-1' });
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));

      await service.generate({
        prompt: 'hi',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.generationConfig).toEqual({ responseMimeType: 'application/json' });
      expect(body.generationConfig.thinkingConfig).toBeUndefined();
    });
  });

  describe('generate — error mapping', () => {
    it('throws NOT_CONFIGURED when API key is missing', async () => {
      const service = createService({ GEMINI_API_KEY: '' });
      await expect(service.generate({ prompt: 'x' })).rejects.toMatchObject({
        code: 'NOT_CONFIGURED',
      });
    });

    it('throws INVALID_KEY on 401 without retrying', async () => {
      const service = createService();
      const fetchMock = jest.fn().mockResolvedValue(errorResponse(401, 'bad key'));
      global.fetch = fetchMock;

      const err = (await service.generate({ prompt: 'x' }).catch((e) => e)) as GeminiError;

      expect(err).toBeInstanceOf(GeminiError);
      expect(err.code).toBe('INVALID_KEY');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws INVALID_KEY on 403 without retrying', async () => {
      const service = createService();
      const fetchMock = jest.fn().mockResolvedValue(errorResponse(403));
      global.fetch = fetchMock;

      const err = (await service.generate({ prompt: 'x' }).catch((e) => e)) as GeminiError;

      expect(err.code).toBe('INVALID_KEY');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 and surfaces RATE_LIMITED after retries are exhausted', async () => {
      const service = createService();
      const fetchMock = jest.fn().mockResolvedValue(errorResponse(429));
      global.fetch = fetchMock;

      const err = (await service.generate({ prompt: 'x' }).catch((e) => e)) as GeminiError;

      expect(err.code).toBe('RATE_LIMITED');
      expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
    }, 5000);

    it('maps a 429 credit/quota-exhaustion 429 to QUOTA_EXHAUSTED without retrying', async () => {
      const service = createService();
      const message =
        'Your prepayment credits are depleted. Please go to AI Studio to manage billing.';
      const fetchMock = jest.fn().mockResolvedValue(errorResponse(429, message));
      global.fetch = fetchMock;

      const err = (await service.generate({ prompt: 'x' }).catch((e) => e)) as GeminiError;

      expect(err.code).toBe('QUOTA_EXHAUSTED');
      expect(err.message).toContain('prepayment credits are depleted');
      expect(fetchMock).toHaveBeenCalledTimes(1); // not retried — credits won't recover mid-request
    });

    it('surfaces the real Gemini error message on a transient RATE_LIMITED', async () => {
      const service = createService();
      const fetchMock = jest
        .fn()
        .mockResolvedValue(errorResponse(429, 'Too many requests, please slow down'));
      global.fetch = fetchMock;

      const err = (await service.generate({ prompt: 'x' }).catch((e) => e)) as GeminiError;

      expect(err.code).toBe('RATE_LIMITED');
      expect(err.message).toBe('Too many requests, please slow down');
      expect(fetchMock).toHaveBeenCalledTimes(3); // still retryable
    }, 5000);

    it('retries on 5xx then succeeds on the second attempt', async () => {
      const service = createService();
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(errorResponse(503))
        .mockResolvedValueOnce(okJson({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
      global.fetch = fetchMock;

      const result = await service.generate({ prompt: 'x' });

      expect(result.text).toBe('ok');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws MALFORMED_RESPONSE when prompt is blocked by safety', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }));

      const err = (await service.generate({ prompt: 'x' }).catch((e) => e)) as GeminiError;

      expect(err.code).toBe('MALFORMED_RESPONSE');
      expect(err.message).toContain('SAFETY');
    });

    it('throws MALFORMED_RESPONSE when there are no candidates', async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue(okJson({ candidates: [] }));

      const err = (await service.generate({ prompt: 'x' }).catch((e) => e)) as GeminiError;

      expect(err.code).toBe('MALFORMED_RESPONSE');
    });

    it('throws TIMEOUT when fetch aborts', async () => {
      const service = createService();
      const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
      const fetchMock = jest.fn().mockRejectedValue(abortError);
      global.fetch = fetchMock;

      const err = (await service.generate({ prompt: 'x' }).catch((e) => e)) as GeminiError;

      expect(err.code).toBe('TIMEOUT');
      expect(fetchMock).toHaveBeenCalledTimes(3); // retried as a retryable error
    }, 5000);
  });
});
