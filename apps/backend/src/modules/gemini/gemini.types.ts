export type GeminiMimeType =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

export interface GeminiInlinePart {
  inlineData: { mimeType: GeminiMimeType; data: string };
}

export interface GeminiTextPart {
  text: string;
}

export type GeminiPart = GeminiInlinePart | GeminiTextPart;

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'text/plain' | 'application/json';
  responseSchema?: Record<string, unknown>;
  /**
   * Controls Gemini 2.5 "thinking". A budget of 0 disables thinking entirely
   * (fastest, best for deterministic schema extraction); -1 lets the model
   * decide dynamically; a positive value caps the thinking tokens.
   */
  thinkingConfig?: { thinkingBudget?: number; includeThoughts?: boolean };
}

export interface GeminiGenerateOptions {
  prompt: string;
  documents?: Array<{ mimeType: GeminiMimeType; data: Buffer }>;
  generationConfig?: GeminiGenerationConfig;
  model?: string;
  signal?: AbortSignal;
}

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiGenerateResult {
  text: string;
  model: string;
  usage?: GeminiUsageMetadata;
}

export type GeminiErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_KEY'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'MALFORMED_RESPONSE'
  | 'UPSTREAM_ERROR';

export class GeminiError extends Error {
  constructor(
    public readonly code: GeminiErrorCode,
    message: string,
    public readonly status?: number,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}
