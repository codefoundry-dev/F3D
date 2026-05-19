/**
 * Forethread Design System — Typography Tokens
 *
 * Font: Urbanist (Google Fonts)
 * All line-heights are 140% unless noted otherwise.
 *
 * Naming convention:
 *   - Standard variant: Medium weight
 *   - Emphasis variant (-e): Bold weight
 */

export const fontFamily = {
  sans: "'Urbanist', 'Inter', 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// ─────────────────────────────────────────────
// Display — large hero text
// ─────────────────────────────────────────────

export const display = {
  l: { fontSize: 64, lineHeight: '140%', fontWeight: fontWeight.medium },
  'l-e': { fontSize: 64, lineHeight: '140%', fontWeight: fontWeight.bold },
  m: { fontSize: 52, lineHeight: '140%', fontWeight: fontWeight.medium },
  'm-e': { fontSize: 52, lineHeight: '140%', fontWeight: fontWeight.bold },
  s: { fontSize: 48, lineHeight: '140%', fontWeight: fontWeight.medium },
  's-e': { fontSize: 48, lineHeight: '140%', fontWeight: fontWeight.bold },
} as const;

// ─────────────────────────────────────────────
// Headline — section headings
// ─────────────────────────────────────────────

export const headline = {
  l: { fontSize: 44, lineHeight: '140%', fontWeight: fontWeight.medium },
  'l-e': { fontSize: 44, lineHeight: '140%', fontWeight: fontWeight.bold },
  m: { fontSize: 40, lineHeight: '140%', fontWeight: fontWeight.medium },
  'm-e': { fontSize: 40, lineHeight: '140%', fontWeight: fontWeight.bold },
  s: { fontSize: 32, lineHeight: '140%', fontWeight: fontWeight.medium },
  's-e': { fontSize: 32, lineHeight: '140%', fontWeight: fontWeight.bold },
} as const;

// ─────────────────────────────────────────────
// Title — card/page titles
// ─────────────────────────────────────────────

export const title = {
  l: { fontSize: 28, lineHeight: '140%', fontWeight: fontWeight.medium },
  'l-e': { fontSize: 28, lineHeight: '140%', fontWeight: fontWeight.bold },
  m: { fontSize: 24, lineHeight: '140%', fontWeight: fontWeight.medium },
  'm-e': { fontSize: 24, lineHeight: '140%', fontWeight: fontWeight.bold },
  s: { fontSize: 20, lineHeight: '140%', fontWeight: fontWeight.medium },
  's-e': { fontSize: 20, lineHeight: '140%', fontWeight: fontWeight.bold },
} as const;

// ─────────────────────────────────────────────
// Body — paragraph text
// ─────────────────────────────────────────────

export const body = {
  18: {
    bold: { fontSize: 18, lineHeight: '140%', fontWeight: fontWeight.bold },
    semibold: { fontSize: 18, lineHeight: '140%', fontWeight: fontWeight.semibold },
    medium: { fontSize: 18, lineHeight: '140%', fontWeight: fontWeight.medium },
    regular: { fontSize: 18, lineHeight: '140%', fontWeight: fontWeight.regular },
  },
  16: {
    bold: { fontSize: 16, lineHeight: '140%', fontWeight: fontWeight.bold },
    semibold: { fontSize: 16, lineHeight: '140%', fontWeight: fontWeight.semibold },
    medium: { fontSize: 16, lineHeight: '140%', fontWeight: fontWeight.medium },
    regular: { fontSize: 16, lineHeight: '140%', fontWeight: fontWeight.regular },
  },
  14: {
    bold: { fontSize: 14, lineHeight: '140%', fontWeight: fontWeight.bold },
    semibold: { fontSize: 14, lineHeight: '140%', fontWeight: fontWeight.semibold },
    medium: { fontSize: 14, lineHeight: '140%', fontWeight: fontWeight.medium },
    regular: { fontSize: 14, lineHeight: '140%', fontWeight: fontWeight.regular },
  },
  12: {
    bold: { fontSize: 12, lineHeight: '140%', fontWeight: fontWeight.bold },
    semibold: { fontSize: 12, lineHeight: '140%', fontWeight: fontWeight.semibold },
    medium: { fontSize: 12, lineHeight: '140%', fontWeight: fontWeight.medium },
    regular: { fontSize: 12, lineHeight: '140%', fontWeight: fontWeight.regular },
  },
} as const;

// ─────────────────────────────────────────────
// Input — form input text
// ─────────────────────────────────────────────

export const input = {
  l: { fontSize: 16, lineHeight: '140%', fontWeight: fontWeight.medium },
  m: { fontSize: 14, lineHeight: '140%', fontWeight: fontWeight.medium },
  s: { fontSize: 12, lineHeight: '140%', fontWeight: fontWeight.medium },
} as const;

// ─────────────────────────────────────────────
// Label & Button — labels, buttons, chips
// ─────────────────────────────────────────────

export const label = {
  l: { fontSize: 16, lineHeight: '100%', fontWeight: fontWeight.medium },
  m: { fontSize: 14, lineHeight: '100%', fontWeight: fontWeight.medium },
  s: { fontSize: 12, lineHeight: '100%', fontWeight: fontWeight.medium },
} as const;

// ─────────────────────────────────────────────
// Aggregated export
// ─────────────────────────────────────────────

export const typography = {
  fontFamily,
  fontWeight,
  display,
  headline,
  title,
  body,
  input,
  label,
} as const;

export type Typography = typeof typography;
