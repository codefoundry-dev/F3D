/**
 * Shared table styling for the Create-RFQ flow tables (Figma US 5.05, table
 * node 2980:42965). Keeps the four step tables — Select Vendors, Add Line
 * Items, Check Availability and Review & Send — visually consistent with the
 * design: bold, letter-spaced 12px header labels in the foreground colour,
 * regular 14px body cells, and visible column dividers in both the header and
 * the body.
 */

/** Header row: light fill + a right divider after every column (last flush). */
export const TABLE_HEADER_ROW =
  'text-left text-xs bg-muted/40 [&>th]:border-r [&>th]:border-border [&>th:last-child]:border-r-0';

/** Header cell label. Compose with column-width utilities via `cn`. */
export const TABLE_TH = 'font-bold leading-4 tracking-[0.6px] text-foreground py-3 px-3';

/** Body row: a horizontal divider above + a right divider after every cell. */
export const TABLE_BODY_ROW =
  'border-t border-border [&>td]:border-r [&>td]:border-border [&>td:last-child]:border-r-0';
