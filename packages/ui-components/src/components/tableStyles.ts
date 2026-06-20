/**
 * Shared table style primitives — Forethread design system
 * (Figma "Table cell" 4188-8547 / "Table" 4213-10394 / RFQ table 6329-175014).
 *
 * Class-string constants so hand-rolled `<table>`s and the shared `DataTable`
 * render with one consistent DS look: a light grey header (Gray-50 #F4F4F6) with
 * tertiary 12px labels, white body cells with primary 14px text, Gray-100
 * (#E8EAED) hairline borders, and a Gray-50 row hover. Urbanist throughout.
 *
 * The exact header colours are also wired into the `--table-header` /
 * `--table-header-foreground` CSS variables (see globals.css) so the many
 * `bg-[hsl(var(--table-header))]` headers pick up the same palette automatically.
 */

/** Outer wrapper for a table card (border + radius + clip). */
export const TABLE_CONTAINER = 'overflow-hidden rounded-[12px] border border-gray-100 bg-white';

/** Header row — light grey band with a hairline bottom border. */
export const TABLE_HEADER_ROW = 'border-b border-gray-100 bg-gray-50';

/** Header cell — tertiary 12px semibold label, left aligned, no wrap. */
export const TABLE_HEADER_CELL =
  'px-3 py-2.5 text-left text-[12px] font-semibold tracking-[0.3px] text-gray-700 whitespace-nowrap';

/** Body row — hairline divider + subtle hover; drop the last divider. */
export const TABLE_ROW =
  'border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50';

/** Selected body row tint. */
export const TABLE_ROW_SELECTED = 'bg-gray-50';

/** Body cell — primary 14px text, vertically centred. */
export const TABLE_CELL = 'px-3 py-3 align-middle text-[14px] text-gray-900';

/** Secondary caption text inside a cell (Gray-500). */
export const TABLE_CELL_CAPTION = 'text-[12px] text-gray-500';
