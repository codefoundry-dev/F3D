import { ConfigService } from '@nestjs/config';

import { OcrService } from '../ocr.service';
import { OcrError } from '../ocr.types';

const originalFetch = global.fetch;

function createService(env: Partial<Record<string, string>> = {}): OcrService {
  const map: Record<string, string> = {
    GOOGLE_VISION_API_KEY: 'test-key',
    OCR_TIMEOUT_MS: '1000',
    ...env,
  };
  const config = {
    get: jest.fn((key: string, defaultValue?: string) => (key in map ? map[key] : defaultValue)),
  } as unknown as ConfigService;
  return new OcrService(config);
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

async function expectOcrError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: 'OcrError', code });
}

describe('OcrService', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('isConfigured / supports', () => {
    it('returns false when no API key is set', () => {
      expect(createService({ GOOGLE_VISION_API_KEY: '' }).isConfigured()).toBe(false);
    });

    it('returns true when API key is set', () => {
      expect(createService().isConfigured()).toBe(true);
    });

    it('defaults the confidence threshold to 0.7 and reads the env override', () => {
      expect(createService().confidenceThreshold).toBe(0.7);
      expect(createService({ OCR_CONFIDENCE_THRESHOLD: '0.9' }).confidenceThreshold).toBe(0.9);
      expect(createService({ OCR_CONFIDENCE_THRESHOLD: 'garbage' }).confidenceThreshold).toBe(0.7);
    });

    it('supports PDFs and images, rejects office formats', () => {
      const service = createService();
      expect(service.supports('application/pdf')).toBe(true);
      expect(service.supports('image/jpeg')).toBe(true);
      expect(service.supports('image/png')).toBe(true);
      expect(service.supports('image/webp')).toBe(true);
      expect(
        service.supports('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ).toBe(false);
      expect(service.supports('text/csv')).toBe(false);
    });
  });

  describe('extractText — guards', () => {
    it('throws NOT_CONFIGURED without an API key', async () => {
      const service = createService({ GOOGLE_VISION_API_KEY: '' });
      await expectOcrError(service.extractText(Buffer.from('x'), 'image/png'), 'NOT_CONFIGURED');
    });

    it('throws UNSUPPORTED_MIME for non-OCR-able files', async () => {
      const service = createService();
      await expectOcrError(service.extractText(Buffer.from('x'), 'text/csv'), 'UNSUPPORTED_MIME');
    });
  });

  describe('extractText — images', () => {
    it('sends DOCUMENT_TEXT_DETECTION to images:annotate and aggregates the result', async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue(
        okJson({
          responses: [
            {
              fullTextAnnotation: {
                text: 'Policy No 12345\nExpires 2027-01-01',
                pages: [{ confidence: 0.9 }],
              },
            },
          ],
        }),
      );

      const result = await service.extractText(Buffer.from('img-bytes'), 'image/png');

      expect(result.text).toBe('Policy No 12345\nExpires 2027-01-01');
      expect(result.confidence).toBeCloseTo(0.9);
      expect(result.pageCount).toBe(1);

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://vision.googleapis.com/v1/images:annotate');
      expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
      const body = JSON.parse(init.body as string);
      expect(body.requests[0].image.content).toBe(Buffer.from('img-bytes').toString('base64'));
      expect(body.requests[0].features).toEqual([{ type: 'DOCUMENT_TEXT_DETECTION' }]);
    });

    it('returns empty text and null confidence for a blank scan', async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue(okJson({ responses: [{}] }));

      const result = await service.extractText(Buffer.from('x'), 'image/jpeg');

      expect(result).toEqual({ text: '', confidence: null, pageCount: 0 });
    });

    it('reports null confidence when Vision omits page confidences', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          okJson({ responses: [{ fullTextAnnotation: { text: 'hello', pages: [{}] } }] }),
        );

      const result = await service.extractText(Buffer.from('x'), 'image/jpeg');

      expect(result.text).toBe('hello');
      expect(result.confidence).toBeNull();
    });

    it('throws UPSTREAM_ERROR when the annotation carries a per-image error', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ responses: [{ error: { message: 'bad image' } }] }));

      await expectOcrError(service.extractText(Buffer.from('x'), 'image/png'), 'UPSTREAM_ERROR');
    });

    it('throws MALFORMED_RESPONSE when the payload has no responses array', async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue(okJson({}));

      await expectOcrError(
        service.extractText(Buffer.from('x'), 'image/png'),
        'MALFORMED_RESPONSE',
      );
    });
  });

  describe('extractText — PDFs', () => {
    it('sends inline content to files:annotate and merges the per-page annotations', async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue(
        okJson({
          responses: [
            {
              responses: [
                { fullTextAnnotation: { text: 'Page one', pages: [{ confidence: 0.8 }] } },
                { fullTextAnnotation: { text: 'Page two', pages: [{ confidence: 0.6 }] } },
              ],
              totalPages: 2,
            },
          ],
        }),
      );

      const result = await service.extractText(Buffer.from('pdf-bytes'), 'application/pdf');

      expect(result.text).toBe('Page one\n\nPage two');
      expect(result.confidence).toBeCloseTo(0.7);
      expect(result.pageCount).toBe(2);

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://vision.googleapis.com/v1/files:annotate');
      const body = JSON.parse(init.body as string);
      expect(body.requests[0].inputConfig).toEqual({
        content: Buffer.from('pdf-bytes').toString('base64'),
        mimeType: 'application/pdf',
      });
    });

    it('throws UPSTREAM_ERROR when Vision reports a file-level error', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ responses: [{ error: { message: 'corrupt PDF' } }] }));

      await expectOcrError(
        service.extractText(Buffer.from('x'), 'application/pdf'),
        'UPSTREAM_ERROR',
      );
    });

    it('throws MALFORMED_RESPONSE when the file response is missing', async () => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue(okJson({ responses: [] }));

      await expectOcrError(
        service.extractText(Buffer.from('x'), 'application/pdf'),
        'MALFORMED_RESPONSE',
      );
    });
  });

  describe('extractText — HTTP error mapping', () => {
    it.each([
      [401, 'INVALID_KEY'],
      [403, 'INVALID_KEY'],
      [500, 'UPSTREAM_ERROR'],
    ] as const)('maps HTTP %s to %s', async (status, code) => {
      const service = createService();
      global.fetch = jest.fn().mockResolvedValue(errorResponse(status));
      await expectOcrError(service.extractText(Buffer.from('x'), 'image/png'), code);
    });

    it('maps a 400 "API key not valid" body to INVALID_KEY', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValue(errorResponse(400, 'API key not valid. Please pass a valid API key.'));
      await expectOcrError(service.extractText(Buffer.from('x'), 'image/png'), 'INVALID_KEY');
    });

    it('maps a quota-exhausted 429 to QUOTA_EXHAUSTED and a plain 429 to RATE_LIMITED', async () => {
      const service = createService();
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(errorResponse(429, 'RESOURCE_EXHAUSTED: quota exceeded'))
        .mockResolvedValueOnce(errorResponse(429, 'slow down'));

      await expectOcrError(service.extractText(Buffer.from('x'), 'image/png'), 'QUOTA_EXHAUSTED');
      await expectOcrError(service.extractText(Buffer.from('x'), 'image/png'), 'RATE_LIMITED');
    });

    it('maps an abort to TIMEOUT', async () => {
      const service = createService();
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await expectOcrError(service.extractText(Buffer.from('x'), 'image/png'), 'TIMEOUT');
    });

    it('wraps network failures as UPSTREAM_ERROR', async () => {
      const service = createService();
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

      await expectOcrError(service.extractText(Buffer.from('x'), 'image/png'), 'UPSTREAM_ERROR');
    });
  });

  it('exposes a typed OcrError', () => {
    const err = new OcrError('TIMEOUT', 'timed out', undefined, new Error('inner'));
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('OcrError');
    expect(err.code).toBe('TIMEOUT');
  });
});
