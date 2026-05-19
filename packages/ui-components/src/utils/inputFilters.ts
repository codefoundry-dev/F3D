import type { KeyboardEvent } from 'react';

const NAV_KEYS = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];

/** Allow only digits (0-9) — for integer inputs */
export const onDigitsOnly = (e: KeyboardEvent) => {
  if (!/[\d]/.test(e.key) && !NAV_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
  }
};

/** Allow digits and a single decimal point — for price/currency inputs */
export const onDecimalOnly = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === '.' || e.key === ',') {
    if (e.currentTarget.value.includes('.')) e.preventDefault();
    return;
  }
  if (!/[\d]/.test(e.key) && !NAV_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
  }
};

/** Allow digits, plus sign at start, dashes, spaces — for phone numbers */
export const onPhoneOnly = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === '+') {
    if (e.currentTarget.selectionStart !== 0 || e.currentTarget.value.includes('+')) {
      e.preventDefault();
    }
    return;
  }
  if (!/[\d\s\-()]/.test(e.key) && !NAV_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
  }
};
