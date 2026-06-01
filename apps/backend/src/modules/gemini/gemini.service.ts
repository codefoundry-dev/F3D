import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  GeminiError,
  type GeminiGenerateOptions,
  type GeminiGenerateResult,
  type GeminiGenerationConfig,
  type GeminiPart,
  type GeminiUsageMetadata,
} from './gemini.types';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 60_000;
// Gemini 2.5 models enable "thinking" by default, which adds latency that
// pushes multimodal extraction past the timeout. 0 disables it (best for
// deterministic schema extraction); -1 restores dynamic thinking.
const DEFAULT_THINKING_BUDGET = 0;
const DEFAULT_MAX_RETRIES = 2;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: GeminiUsageMetadata;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly thinkingBudget: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
    this.defaultModel = this.config.get<string>('GEMINI_MODEL', DEFAULT_MODEL);
    this.timeoutMs = toFiniteNumber(
      this.config.get<string>('GEMINI_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS)),
      DEFAULT_TIMEOUT_MS,
    );
    this.thinkingBudget = toFiniteNumber(
      this.config.get<string>('GEMINI_THINKING_BUDGET', String(DEFAULT_THINKING_BUDGET)),
      DEFAULT_THINKING_BUDGET,
    );
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async generate(options: GeminiGenerateOptions): Promise<GeminiGenerateResult> {
    if (!this.isConfigured()) {
      throw new GeminiError('NOT_CONFIGURED', 'GEMINI_API_KEY is not set');
    }

    const model = options.model ?? this.defaultModel;
    const parts: GeminiPart[] = [
      { text: options.prompt },
      ...(options.documents ?? []).map((doc) => ({
        inlineData: { mimeType: doc.mimeType, data: doc.data.toString('base64') },
      })),
    ];

    const generationConfig = this.resolveGenerationConfig(options.generationConfig);
    const body = {
      contents: [{ role: 'user', parts }],
      ...(generationConfig ? { generationConfig } : {}),
    };

    const url = `${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;
    const response = await this.callWithRetry(url, body, options.signal);
    return this.parseResponse(response, model);
  }

  /**
   * Fold the configured thinking budget into the caller's generationConfig.
   * A negative budget means "let the model decide" (Gemini's dynamic default),
   * so we leave thinkingConfig unset and pass the caller's config through as-is.
   */
  private resolveGenerationConfig(
    caller: GeminiGenerationConfig | undefined,
  ): GeminiGenerationConfig | undefined {
    if (this.thinkingBudget < 0) return caller;
    return { ...caller, thinkingConfig: { thinkingBudget: this.thinkingBudget } };
  }

  private async callWithRetry(
    url: string,
    body: unknown,
    externalSignal: AbortSignal | undefined,
  ): Promise<GeminiApiResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
      try {
        return await this.callOnce(url, body, externalSignal);
      } catch (err) {
        lastError = err;
        if (
          !(err instanceof GeminiError) ||
          !this.isRetryable(err) ||
          attempt === DEFAULT_MAX_RETRIES
        ) {
          throw err;
        }
        const backoff = 250 * 2 ** attempt;
        this.logger.warn(
          `Gemini call failed (attempt ${attempt + 1}/${DEFAULT_MAX_RETRIES + 1}, ${err.code}); retrying in ${backoff}ms`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, backoff));
      }
    }
    throw lastError as Error;
  }

  private isRetryable(err: GeminiError): boolean {
    return err.code === 'RATE_LIMITED' || err.code === 'TIMEOUT' || err.code === 'UPSTREAM_ERROR';
  }

  private async callOnce(
    url: string,
    body: unknown,
    externalSignal: AbortSignal | undefined,
  ): Promise<GeminiApiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onExternalAbort = (): void => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort);

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

      return (await response.json()) as GeminiApiResponse;
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new GeminiError(
          'TIMEOUT',
          `Gemini request timed out after ${this.timeoutMs}ms`,
          undefined,
          err,
        );
      }
      throw new GeminiError('UPSTREAM_ERROR', 'Gemini request failed', undefined, err);
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }

  private mapHttpError(status: number, bodyText: string): GeminiError {
    if (status === 401 || status === 403) {
      return new GeminiError('INVALID_KEY', `Gemini rejected the API key (HTTP ${status})`, status);
    }
    if (status === 429) {
      return new GeminiError('RATE_LIMITED', 'Gemini rate limit exceeded', status);
    }
    if (status >= 500) {
      return new GeminiError(
        'UPSTREAM_ERROR',
        `Gemini upstream error (HTTP ${status}): ${bodyText.slice(0, 200)}`,
        status,
      );
    }
    return new GeminiError(
      'UPSTREAM_ERROR',
      `Gemini error (HTTP ${status}): ${bodyText.slice(0, 200)}`,
      status,
    );
  }

  private parseResponse(payload: GeminiApiResponse, model: string): GeminiGenerateResult {
    if (payload.promptFeedback?.blockReason) {
      throw new GeminiError(
        'MALFORMED_RESPONSE',
        `Gemini blocked the prompt: ${payload.promptFeedback.blockReason}`,
      );
    }
    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) {
      throw new GeminiError(
        'MALFORMED_RESPONSE',
        'Gemini response did not contain any text content',
      );
    }
    return { text, model, usage: payload.usageMetadata };
  }
}

/** Parse an env-sourced numeric string, falling back when it isn't a finite number. */
function toFiniteNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
