import { Buffer } from 'node:buffer';

import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';

import { GeminiService } from '../gemini.service';

/**
 * End-to-end smoke test for the Gemini multimodal pipeline.
 *
 * Skips automatically when GEMINI_API_KEY is not present so contributors
 * without a key (and CI without secrets) don't see false failures.
 *
 * Verifies that a tiny in-memory PDF — three BOM line items — round-trips
 * to Gemini and comes back as a JSON-structured response with the right
 * lines, quantities, and units of measure.
 */

const apiKey = process.env.GEMINI_API_KEY ?? '';
const describeIfKey = apiKey ? describe : describe.skip;

function buildSampleBomPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Bill of Materials — Project Alpha', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(12).text('Description                         Qty     UoM');
    doc.text('--------------------------------------------------------');
    doc.text('Portland cement bags 50kg            120     bag');
    doc.text('Reinforcement bar 12mm x 6m          300     length');
    doc.text('Concrete blocks 200mm                 75     each');

    doc.end();
  });
}

describeIfKey('GeminiService — multimodal smoke test', () => {
  // Real network call; allow plenty of time for the model.
  jest.setTimeout(60_000);

  let service: GeminiService;

  beforeAll(() => {
    const config = {
      get: jest.fn((key: string, defaultValue?: string) => process.env[key] ?? defaultValue),
    } as unknown as ConfigService;
    service = new GeminiService(config);
  });

  it('extracts structured BOM line items from a small PDF', async () => {
    const pdf = await buildSampleBomPdf();

    const result = await service.generate({
      prompt: [
        'You are a procurement assistant.',
        'Extract the line items from this Bill of Materials PDF.',
        'Return STRICTLY valid JSON with the schema:',
        '{ "items": [ { "description": string, "quantity": number, "unit": string } ] }',
        'Do not include any prose or markdown fences.',
      ].join(' '),
      documents: [{ mimeType: 'application/pdf', data: pdf }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    expect(result.text.length).toBeGreaterThan(0);

    const parsed = JSON.parse(result.text) as {
      items: Array<{ description: string; quantity: number; unit: string }>;
    };

    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items.length).toBeGreaterThanOrEqual(3);

    const joinedDescriptions = parsed.items.map((i) => i.description.toLowerCase()).join(' | ');
    expect(joinedDescriptions).toMatch(/cement/);
    expect(joinedDescriptions).toMatch(/reinforce|rebar|bar/);
    expect(joinedDescriptions).toMatch(/block/);

    const cement = parsed.items.find((i) => /cement/i.test(i.description));
    expect(cement?.quantity).toBe(120);
  });
});
