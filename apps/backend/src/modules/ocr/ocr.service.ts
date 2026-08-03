import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OCR_SUPPORTED_MIME_TYPES, OcrError, type OcrMimeType, type OcrResult } from './ocr.types';

const DEFAULT_TIMEOUT_MS = 30_000;
// Below this page-averaged confidence, consumers should distrust the OCR text
// and fall back to their LLM path. 0.7 is conservative for print documents —
// clean scans typically report >0.9; photographed/skewed ones drop well below.
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const BASE_URL = 'https://vision.googleapis.com/v1';

/** One annotated page/image: DOCUMENT_TEXT_DETECTION's full-text output. */
interface VisionAnnotateResponse {
  fullTextAnnotation?: {
    text?: string;
    pages?: Array<{ confidence?: number }>;
  };
  error?: { code?: number; message?: string };
}

interface VisionImagesApiResponse {
  responses?: VisionAnnotateResponse[];
}

interface VisionFilesApiResponse {
  responses?: Array<{
    responses?: VisionAnnotateResponse[];
    error?: { code?: number; message?: string };
    totalPages?: number;
  }>;
}

/**
 * Thin Google Cloud Vision OCR client (FOR-259). Follows the same house style
 * as GeminiService/GoogleService: plain `fetch` against the REST API with an
 * API-key header, config via ConfigService, and a typed error taxonomy so
 * callers can decide what is retryable/fallback-able.
 *
 * Deliberately has no retry logic: the one consumer (vendor-document
 * extraction) falls back to the multimodal LLM path on any OCR failure, so a
 * fast single attempt beats retrying a struggling upstream.
 */
@Injectable()
export class OcrService {
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  /** Page-averaged confidence below which OCR output should not be trusted. */
  readonly confidenceThreshold: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GOOGLE_VISION_API_KEY', '');
    this.timeoutMs = toFiniteNumber(
      this.config.get<string>('OCR_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS)),
      DEFAULT_TIMEOUT_MS,
    );
    this.confidenceThreshold = toFiniteNumber(
      this.config.get<string>('OCR_CONFIDENCE_THRESHOLD', String(DEFAULT_CONFIDENCE_THRESHOLD)),
      DEFAULT_CONFIDENCE_THRESHOLD,
    );
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  supports(mimeType: string): boolean {
    return OCR_SUPPORTED_MIME_TYPES.has(mimeType);
  }

  /**
   * OCR a document with DOCUMENT_TEXT_DETECTION. Empty text is a valid result
   * (a blank or unreadable scan), not an error — callers treat it as
   * low-confidence and fall back to the LLM.
   */
  async extractText(data: Buffer, mimeType: string): Promise<OcrResult> {
    if (!this.isConfigured()) {
      throw new OcrError('NOT_CONFIGURED', 'GOOGLE_VISION_API_KEY is not set');
    }
    if (!this.supports(mimeType)) {
      throw new OcrError('UNSUPPORTED_MIME', `OCR does not support ${mimeType}`);
    }

    const annotations =
      mimeType === 'application/pdf'
        ? await this.annotateFile(data, mimeType)
        : await this.annotateImage(data);

    return aggregateAnnotations(annotations);
  }

  /** Images (PNG/JPEG/WebP) — one `images:annotate` request, one response. */
  private async annotateImage(data: Buffer): Promise<VisionAnnotateResponse[]> {
    const body = {
      requests: [
        {
          image: { content: data.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };
    const payload = (await this.callOnce(
      `${BASE_URL}/images:annotate`,
      body,
    )) as VisionImagesApiResponse;
    if (!Array.isArray(payload.responses)) {
      throw new OcrError('MALFORMED_RESPONSE', 'Vision response did not contain any annotations');
    }
    return payload.responses;
  }

  /** PDFs — synchronous `files:annotate` with inline content. Vision returns
   *  one nested response per processed page (first 5 pages). */
  private async annotateFile(
    data: Buffer,
    mimeType: OcrMimeType,
  ): Promise<VisionAnnotateResponse[]> {
    const body = {
      requests: [
        {
          inputConfig: { content: data.toString('base64'), mimeType },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };
    const payload = (await this.callOnce(
      `${BASE_URL}/files:annotate`,
      body,
    )) as VisionFilesApiResponse;
    const fileResponse = payload.responses?.[0];
    if (!fileResponse) {
      throw new OcrError('MALFORMED_RESPONSE', 'Vision response did not contain any annotations');
    }
    if (fileResponse.error) {
      throw new OcrError(
        'UPSTREAM_ERROR',
        `Vision could not process the file: ${fileResponse.error.message ?? 'unknown error'}`,
      );
    }
    return fileResponse.responses ?? [];
  }

  private async callOnce(url: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw this.mapHttpError(response.status, text);
      }

      return await response.json();
    } catch (err) {
      if (err instanceof OcrError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new OcrError(
          'TIMEOUT',
          `OCR request timed out after ${this.timeoutMs}ms`,
          undefined,
          err,
        );
      }
      throw new OcrError('UPSTREAM_ERROR', 'OCR request failed', undefined, err);
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapHttpError(status: number, bodyText: string): OcrError {
    // Google reports an invalid key as HTTP 400 INVALID_ARGUMENT ("API key not
    // valid"), and a key that lacks access to the Vision API as 401/403.
    if (status === 401 || status === 403 || /API key not valid/i.test(bodyText)) {
      return new OcrError('INVALID_KEY', `Vision rejected the API key (HTTP ${status})`, status);
    }
    if (status === 429) {
      // Same overloading as Gemini: 429 covers both transient rate limits and
      // hard quota exhaustion; only the former is worth ever retrying.
      const exhausted = /RESOURCE_EXHAUSTED|quota|billing/i.test(bodyText);
      return new OcrError(
        exhausted ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED',
        exhausted ? 'Vision quota exhausted' : 'Vision rate limit exceeded',
        status,
      );
    }
    return new OcrError(
      'UPSTREAM_ERROR',
      `Vision error (HTTP ${status}): ${bodyText.slice(0, 200)}`,
      status,
    );
  }
}

/**
 * Merge per-page annotations into one document: pages joined by blank lines,
 * confidence averaged over the pages that report one (Vision omits it for
 * some inputs — null then, so callers can distinguish "unknown" from "low").
 */
function aggregateAnnotations(annotations: VisionAnnotateResponse[]): OcrResult {
  const failed = annotations.find((a) => a.error);
  if (failed) {
    throw new OcrError(
      'UPSTREAM_ERROR',
      `Vision could not process the document: ${failed.error?.message ?? 'unknown error'}`,
    );
  }

  const texts: string[] = [];
  const confidences: number[] = [];
  let pageCount = 0;

  for (const annotation of annotations) {
    const full = annotation.fullTextAnnotation;
    if (!full) continue;
    pageCount += 1;
    const text = full.text?.trim();
    if (text) texts.push(text);
    for (const page of full.pages ?? []) {
      if (typeof page.confidence === 'number') confidences.push(page.confidence);
    }
  }

  return {
    text: texts.join('\n\n'),
    confidence:
      confidences.length > 0
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
        : null,
    pageCount,
  };
}

/** Parse an env-sourced numeric string, falling back when it isn't a finite number. */
function toFiniteNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
