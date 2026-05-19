export const PDF_STYLES = {
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
  },
  layer: {
    header: '#f7f7f7',
    rowAlt: '#f0f0f0',
    totalRow: '#f7f7f7',
  },
  background: {
    page: '#ffffff',
    cell: '#ffffff',
  },
} as const;

export const PDF_COMPANY = {
  name: 'Forethread',
} as const;

export const PDF_TABLE = {
  /** Standard row height — enough for two lines of text */
  rowHeight: 36,
  /** Vertical text offset within a row */
  textPadding: 8,
  /** Horizontal cell padding */
  cellPadding: 6,
} as const;
