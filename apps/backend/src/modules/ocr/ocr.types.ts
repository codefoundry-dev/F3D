/** The file types Google Cloud Vision can OCR in this integration. Images go
 *  through `images:annotate`; PDFs go through the synchronous `files:annotate`
 *  (which processes the first 5 pages — plenty for vendor documents). */
export type OcrMimeType = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';

export const OCR_SUPPORTED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export interface OcrResult {
  /** Full plain text of the document, pages joined by blank lines. Empty when
   *  Vision found no text (e.g. a blank scan) — that is not an error. */
  text: string;
  /** Page-averaged OCR confidence in [0, 1]; null when Vision reports none. */
  confidence: number | null;
  /** Number of pages Vision returned annotations for. */
  pageCount: number;
}

export type OcrErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_KEY'
  | 'RATE_LIMITED'
  | 'QUOTA_EXHAUSTED'
  | 'TIMEOUT'
  | 'MALFORMED_RESPONSE'
  | 'UNSUPPORTED_MIME'
  | 'UPSTREAM_ERROR';

export class OcrError extends Error {
  constructor(
    public readonly code: OcrErrorCode,
    message: string,
    public readonly status?: number,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OcrError';
  }
}
