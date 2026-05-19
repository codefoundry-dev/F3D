// Re-export from ui-components to avoid duplication
export { formatCurrency, formatDate } from '@forethread/ui-components';

export function formatPrice(value: number | string | undefined): string {
  if (!value) return '';
  const num = Number(value);
  return isNaN(num) ? '' : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}
